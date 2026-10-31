"""Benchmark opcional de ARIMA/SARIMA e regressores nas mesmas origens e alvos."""

import json
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path
from time import perf_counter

import numpy as np
import pandas as pd
from sklearn.base import clone

from ml.models import EMA, NAIVE, check_lightgbm_device, get_models
from ml.sarima import get_sarima_specs, rolling_predictions
from ml.train import (
    load_data,
    percentage_gain,
    prepare_data,
    price_metrics,
    temporal_split,
    walk_forward_folds,
)


def select_items(initial_training, max_items=5, items=None):
    """Amostra determinística por liquidez, usando somente o primeiro treino do CV."""
    if max_items < 0:
        raise ValueError("experiment-max-items deve ser >= 0 (0 = todos).")
    available = set(initial_training["market_hash_name"])
    if items:
        missing = set(items) - available
        if missing:
            raise ValueError(f"Itens ausentes no primeiro treino: {', '.join(sorted(missing))}")
        return list(dict.fromkeys(items))
    liquidity = (
        initial_training.groupby("market_hash_name")["volume"]
        .median()
        .rename("volume")
        .reset_index()
        .sort_values(["volume", "market_hash_name"])
    )
    count = len(liquidity) if max_items == 0 else min(max_items, len(liquidity))
    positions = np.linspace(0, len(liquidity) - 1, count, dtype=int)
    return liquidity.iloc[positions]["market_hash_name"].tolist()


def prediction_rows(name, evaluation, prediction, reasons, phase, period):
    rows = evaluation.reindex(
        columns=[
            "market_hash_name",
            "observation_date",
            "price",
            "target_price",
            "target_logret",
        ]
    ).copy()
    rows["model"] = name
    rows["phase"] = phase
    rows["periodo"] = period
    rows["prediction"] = np.asarray(prediction)
    rows["fallback_reason"] = np.asarray(reasons)
    rows["used_fallback"] = rows["fallback_reason"].ne("")
    return rows.reset_index(drop=True)


def evaluate_period(
    history, fit, evaluation, features, models, specs, config, sarima_config, phase, period
):
    if evaluation.empty:
        raise ValueError(f"Nenhuma observação dos itens selecionados no período {period}.")
    cutoff = fit["observation_date"].max()
    predictions, diagnostics = [], []
    for name, candidate in models.items():
        print(f"Experimento {phase}: {period} | {name}", flush=True)
        started = perf_counter()
        model = clone(candidate).fit(fit[features], fit["target_logret"])
        fit_seconds = perf_counter() - started
        started = perf_counter()
        prediction = model.predict(evaluation[features])
        predict_seconds = perf_counter() - started
        predictions.append(
            prediction_rows(
                name,
                evaluation,
                prediction,
                [""] * len(evaluation),
                phase,
                period,
            )
        )
        diagnostics.append(
            {
                "phase": phase,
                "periodo": period,
                "model": name,
                "market_hash_name": "__pooled__",
                "fit_status": "ok",
                "n_observations": len(fit),
                "n_missing": 0,
                "fit_seconds": fit_seconds,
                "predict_seconds": predict_seconds,
                "warning_count": 0,
                "forecast_failures": 0,
                "fallback_count": 0,
                "prediction_count": len(evaluation),
                "error": "",
            }
        )

    histories = {name: group for name, group in history.groupby("market_hash_name")}
    for name, spec in specs.items():
        for item, observations in evaluation.groupby("market_hash_name"):
            print(f"Experimento {phase}: {period} | {name} | {item}", flush=True)
            # No retreino final, preços são conhecidos até o último dia de cada item.
            item_cutoff = observations["observation_date"].max() if phase == "forecast" else cutoff
            result, diagnostic = rolling_predictions(
                histories[item],
                observations,
                item_cutoff,
                spec,
                config,
                sarima_config,
            )
            predictions.append(
                prediction_rows(
                    name,
                    observations,
                    result["prediction"],
                    result["fallback_reason"],
                    phase,
                    period,
                )
            )
            diagnostics.append(
                {
                    "phase": phase,
                    "periodo": period,
                    "model": name,
                    "market_hash_name": item,
                    **diagnostic,
                }
            )
    return pd.concat(predictions, ignore_index=True), pd.DataFrame(diagnostics)


def score_predictions(predictions):
    rows = []
    for name, group in predictions.groupby("model", sort=False):
        metrics = price_metrics(group["target_logret"], group["prediction"], group["price"])
        errors = (
            group.assign(
                error=(group["target_logret"] - group["prediction"]).abs(),
                naive_error=group["target_logret"].abs(),
            )
            .groupby("market_hash_name")[["error", "naive_error"]]
            .mean()
        )
        rows.append(
            {
                "model": name,
                **metrics,
                "itens_ok_pct": 100 * errors["error"].lt(errors["naive_error"]).mean(),
                "fallback_pct": 100 * group["used_fallback"].mean(),
                "observations": len(group),
            }
        )
    scores = pd.DataFrame(rows).set_index("model")
    for baseline, label in ((NAIVE, "ingenuo"), (EMA, "ema")):
        for metric, suffix in (("MAE", "preco"), ("MAE_logret", "logret")):
            denominator = scores.loc[baseline, metric]
            scores[f"ganho_vs_{label}_{suffix}_pct"] = scores[metric].map(
                lambda error, denominator=denominator: percentage_gain(error, denominator)
            )
    return scores.reset_index()


def summarize_cv(folds):
    summary = folds.groupby("model", sort=False).agg(
        mae_logret=("MAE_logret", "mean"),
        mae_logret_std=("MAE_logret", "std"),
        ganho_vs_ingenuo_pct=("ganho_vs_ingenuo_logret_pct", "mean"),
        itens_ok_pct=("itens_ok_pct", "mean"),
        fallback_pct=("fallback_pct", "mean"),
    )
    return summary.sort_values(
        ["ganho_vs_ingenuo_pct", "mae_logret"],
        ascending=[False, True],
        kind="stable",
    ).reset_index()


def run_experiment(csv_path, output_dir, config, sarima_config, *, max_items=5, items=None):
    started = perf_counter()
    labeled, latest, features = prepare_data(csv_path, config)
    history = load_data(csv_path)
    if config.start_date:
        history = history[history["observation_date"] >= pd.Timestamp(config.start_date)]
    training, test = temporal_split(labeled, config)
    folds = list(walk_forward_folds(training["observation_date"], config))
    selected = select_items(training.loc[folds[0][1]], max_items, items)
    print(f"Itens do experimento: {', '.join(selected)}", flush=True)
    models = get_models(
        config.random_state,
        ema_weight=config.ema_weight,
        target_clip=config.target_clip,
        n_jobs=config.n_jobs,
        device=config.device,
        gpu_platform_id=config.gpu_platform_id,
        gpu_device_id=config.gpu_device_id,
    )
    check_lightgbm_device(models["lightgbm"].estimator)
    specs = get_sarima_specs(sarima_config.seasonal_period)
    all_predictions, all_diagnostics, cv_scores = [], [], []
    for period, fit_mask, eval_mask in folds:
        evaluation = training.loc[eval_mask & training["market_hash_name"].isin(selected)]
        predictions, diagnostics = evaluate_period(
            history,
            training.loc[fit_mask],
            evaluation,
            features,
            models,
            specs,
            config,
            sarima_config,
            "cv",
            period,
        )
        all_predictions.append(predictions)
        all_diagnostics.append(diagnostics)
        cv_scores.append(score_predictions(predictions).assign(periodo=period))
    cv_folds = pd.concat(cv_scores, ignore_index=True)
    cv_summary = summarize_cv(cv_folds)
    best_name = cv_summary.iloc[0]["model"]
    best_sarima = cv_summary[cv_summary["model"].isin(specs)].iloc[0]["model"]
    print(f"\nEscolha no CV: {best_name}; melhor ARIMA/SARIMA: {best_sarima}", flush=True)

    # A seleção termina antes de acessar os erros do holdout.
    evaluation = test[test["market_hash_name"].isin(selected)]
    test_predictions, diagnostics = evaluate_period(
        history,
        training,
        evaluation,
        features,
        models,
        specs,
        config,
        sarima_config,
        "test",
        "holdout",
    )
    all_predictions.append(test_predictions)
    all_diagnostics.append(diagnostics)
    test_metrics = score_predictions(test_predictions)
    per_item = pd.concat(
        [
            score_predictions(group).assign(market_hash_name=item)
            for item, group in test_predictions.groupby("market_hash_name")
        ],
        ignore_index=True,
    )

    forecast, diagnostics = evaluate_period(
        history,
        labeled,
        latest[latest["market_hash_name"].isin(selected)],
        features,
        models,
        specs,
        config,
        sarima_config,
        "forecast",
        "latest",
    )
    all_diagnostics.append(diagnostics)
    forecast["preco_previsto"] = forecast["price"] * np.exp(forecast["prediction"])
    forecast["retorno_previsto_%"] = 100 * np.expm1(forecast["prediction"])
    forecast["data_alvo"] = forecast["observation_date"] + pd.Timedelta(days=config.horizon)
    forecast["selected_by_cv"] = forecast["model"].eq(best_name)
    forecast = forecast.rename(columns={"observation_date": "data_base", "price": "preco_atual"})
    forecast = forecast.drop(columns=["target_price", "target_logret", "phase", "periodo"])
    diagnostics = pd.concat(all_diagnostics, ignore_index=True)
    runtime = (
        diagnostics.assign(
            fit_failure=diagnostics["fit_status"].isin(["fit_failed", "non_convergence"]),
            insufficient_history=diagnostics["fit_status"].eq("insufficient_history"),
        )
        .groupby(["phase", "model"], sort=False)
        .agg(
            fits=("fit_status", "size"),
            fit_failures=("fit_failure", "sum"),
            insufficient_history=("insufficient_history", "sum"),
            forecast_failures=("forecast_failures", "sum"),
            fit_seconds=("fit_seconds", "sum"),
            predict_seconds=("predict_seconds", "sum"),
            fallback_count=("fallback_count", "sum"),
            prediction_count=("prediction_count", "sum"),
        )
        .reset_index()
    )
    runtime["fallback_pct"] = 100 * runtime["fallback_count"] / runtime["prediction_count"]
    runtime["total_seconds"] = runtime["fit_seconds"] + runtime["predict_seconds"]
    metadata = {
        "experimental": True,
        "selected_by_cv": best_name,
        "selected_sarima_by_cv": best_sarima,
        "items": selected,
        "item_selection": "explicit" if items else "quantis de volume no primeiro treino do CV",
        "training_config": asdict(config),
        "sarima_config": asdict(sarima_config),
        "sarima_specs": specs,
        "train_end": str(training["observation_date"].max().date()),
        "test_start": str(test["observation_date"].min().date()),
        "test_end": str(test["observation_date"].max().date()),
        "parameter_policy": "fit antes do intervalo de embargo; parâmetros fixos em cada fold",
        "state_policy": "atualiza com observações disponíveis até cada data-base, inclusive",
        "price_conversion": "média de exp(mu + variância/2) em H-W..H+W",
        "pooled_training": "todos os itens; avaliação apenas nos itens selecionados",
        "fallback": "EMA 10; falhas e histórico insuficiente entram nas métricas",
        "elapsed_seconds": perf_counter() - started,
        "versions": {
            package: version(package)
            for package in (
                "numpy",
                "pandas",
                "scikit-learn",
                "lightgbm",
                "statsmodels",
            )
        },
    }
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    for filename, table in {
        "cv_folds.csv": cv_folds,
        "cv_summary.csv": cv_summary,
        "test_metrics.csv": test_metrics,
        "metrics_per_item.csv": per_item,
        "predictions.csv": pd.concat(all_predictions, ignore_index=True),
        "diagnostics.csv": diagnostics,
        "runtime.csv": runtime,
        f"previsao_{config.horizon}d.csv": forecast,
    }.items():
        table.to_csv(output_dir / filename, index=False)
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\n{cv_summary.to_string(index=False)}\n\n{test_metrics.to_string(index=False)}")
    print(f"\nExperimento salvo em {output_dir.resolve()}", flush=True)
    return metadata
