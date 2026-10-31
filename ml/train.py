"""Treino e previsão extraídos de notebooks/previsao_precos.ipynb.

Execute na raiz: uv run --project ml python -m ml.train --help
Ou em ml/: uv run python train.py --help
"""

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from importlib.metadata import version
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)

# Mantém ml.models como caminho de importação no artefato, inclusive via python train.py.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.models import EMA, NAIVE, get_models

ML_DIR = Path(__file__).resolve().parent
KEY_ITEM = "Mann Co. Supply Crate Key"
REQUIRED_COLUMNS = (
    "observation_date",
    "market_hash_name",
    "price",
    "volume",
    "is_filled",
    "days_since_first_obs",
    "scrape_timestamp_utc",
)


@dataclass(frozen=True)
class TrainingConfig:
    horizon: int = 7
    target_half_window: int = 2
    target_clip: float = 0.7
    ema_weight: float = 0.5
    test_days: int = 180
    cv_folds: int = 4
    fold_days: int = 180
    min_history: int = 30
    start_date: str | None = "2016-01-01"
    random_state: int = 42
    n_jobs: int = -1

    def __post_init__(self):
        for name in ("horizon", "test_days", "cv_folds", "fold_days"):
            if getattr(self, name) <= 0:
                raise ValueError(f"{name} deve ser positivo.")
        if not 0 <= self.target_half_window < self.horizon:
            raise ValueError("target_half_window deve estar entre 0 e horizon - 1.")
        if self.min_history < 0:
            raise ValueError("min_history não pode ser negativo.")
        if not np.isfinite(self.target_clip) or self.target_clip <= 0:
            raise ValueError("target_clip deve ser finito e positivo.")
        if not 0 <= self.ema_weight <= 1:
            raise ValueError("ema_weight deve estar entre 0 e 1.")
        if self.n_jobs == 0:
            raise ValueError("n_jobs não pode ser zero.")
        if self.start_date is not None and pd.isna(pd.Timestamp(self.start_date)):
            raise ValueError("start_date deve ser uma data válida.")

    @property
    def gap_days(self):
        return self.horizon + self.target_half_window


def load_data(csv_path: Path) -> pd.DataFrame:
    """Lê as colunas-base; descarta dias parciais, duplicatas e dados inválidos."""
    raw = pd.read_csv(csv_path, low_memory=False)
    missing = set(REQUIRED_COLUMNS) - set(raw.columns)
    if missing:
        raise ValueError(f"Colunas ausentes no CSV: {', '.join(sorted(missing))}")
    raw = raw[list(REQUIRED_COLUMNS)].copy()
    raw["observation_date"] = (
        pd.to_datetime(raw["observation_date"], errors="coerce", utc=True)
        .dt.tz_localize(None)
        .dt.normalize()
    )
    scrape_date = (
        pd.to_datetime(raw["scrape_timestamp_utc"], errors="coerce", utc=True)
        .dt.tz_localize(None)
        .dt.normalize()
    )
    for column in ("price", "volume", "days_since_first_obs"):
        raw[column] = pd.to_numeric(raw[column], errors="coerce")
    raw["is_filled"] = (
        raw["is_filled"]
        .astype(str)
        .str.lower()
        .map({"true": 1.0, "false": 0.0, "1": 1.0, "0": 0.0, "1.0": 1.0, "0.0": 0.0})
    )
    valid = (
        (raw["observation_date"] < scrape_date)
        & np.isfinite(raw[["price", "volume", "days_since_first_obs"]]).all(axis=1)
        & (raw["price"] > 0)
        & (raw["volume"] >= 0)
        & (raw["days_since_first_obs"] >= 0)
        & raw["is_filled"].notna()
        & raw["market_hash_name"].notna()
    )
    data = (
        raw.loc[valid]
        .drop(columns="scrape_timestamp_utc")
        .drop_duplicates(["market_hash_name", "observation_date"])
        .sort_values(["market_hash_name", "observation_date"])
        .reset_index(drop=True)
    )
    if data.empty:
        raise ValueError("O CSV não contém observações válidas e completas.")
    return data


def build_targets(data: pd.DataFrame, config: TrainingConfig) -> pd.DataFrame:
    """Alvo médio em t+H-W..t+H+W; lacunas de calendário invalidam a janela."""
    data = data.copy()
    by_item = data.groupby("market_hash_name")
    window = 2 * config.target_half_window + 1
    window_mean = by_item["price"].transform(lambda s: s.rolling(window).mean())
    data["target_price"] = window_mean.groupby(data["market_hash_name"]).shift(-config.gap_days)
    window_end = by_item["observation_date"].shift(-config.gap_days)
    consecutive = (window_end - data["observation_date"]).dt.days == config.gap_days
    data.loc[~consecutive, "target_price"] = np.nan
    data["target_logret"] = np.log(data["target_price"] / data["price"])
    return data


def build_features(data: pd.DataFrame) -> pd.DataFrame:
    """As 35 features do notebook, calculadas apenas com dados até o dia-base."""
    item = data["market_hash_name"]
    price = data["price"]
    log_price = np.log(price)
    volume = data["volume"].astype(float)
    grouped = price.groupby(item)
    grouped_log = log_price.groupby(item)
    grouped_volume = volume.groupby(item)

    def roll(group, window, operation):
        return group.transform(lambda s: getattr(s.rolling(window, min_periods=1), operation)())

    features = pd.DataFrame(index=data.index)
    features["log_price"] = log_price
    for window in (1, 3, 7, 14, 30):
        features[f"ret_{window}"] = log_price - grouped_log.shift(window)
    for window in (3, 7, 14, 30, 60):
        features[f"ma_{window}_rel"] = roll(grouped, window, "mean") / price - 1
    for window in (7, 30):
        features[f"med_{window}_rel"] = roll(grouped, window, "median") / price - 1
    for span in (5, 10, 30):
        features[f"ema_{span}_rel"] = (
            grouped.transform(lambda s, span=span: s.ewm(span=span, adjust=False).mean()) / price
            - 1
        )
    daily = grouped_log.diff().groupby(item)
    for window in (7, 30):
        features[f"vol_{window}"] = daily.transform(
            lambda s, window=window: s.rolling(window, min_periods=2).std()
        )
        features[f"min_{window}_rel"] = roll(grouped, window, "min") / price - 1
        features[f"max_{window}_rel"] = roll(grouped, window, "max") / price - 1
    features["z_30"] = -features["ma_30_rel"] / (features["vol_30"] + 1e-9)
    features["ath_rel"] = price / grouped.cummax() - 1
    features["atl_rel"] = price / grouped.cummin() - 1
    features["log_vol"] = np.log1p(volume)
    for window in (7, 30):
        features[f"log_vol_ma_{window}"] = np.log1p(roll(grouped_volume, window, "mean"))
    features["vol_trend"] = features["log_vol_ma_7"] - features["log_vol_ma_30"]
    features["vol_today_rel"] = features["log_vol"] - features["log_vol_ma_7"]
    features["is_filled"] = data["is_filled"].astype(float)

    dates = data["observation_date"]
    is_key = item.eq(KEY_ITEM)
    market = features.loc[~is_key, ["ret_1", "ret_7"]].groupby(dates[~is_key]).median()
    features["mkt_ret_1"] = dates.map(market["ret_1"])
    features["mkt_ret_7"] = dates.map(market["ret_7"])
    features["key_ret_7"] = dates.map(features.loc[is_key, "ret_7"].set_axis(dates[is_key]))
    features["rel_to_mkt_7"] = features["ret_7"] - features["mkt_ret_7"]
    return features.replace([np.inf, -np.inf], np.nan)


def prepare_data(csv_path: Path, config: TrainingConfig):
    data = build_targets(load_data(csv_path), config)
    features = build_features(data)
    data = data.drop(columns="is_filled").join(features)
    # Inclui itens novos na previsão e os sinaliza, como no notebook.
    latest = data.groupby("market_hash_name").tail(1).copy()
    eligible = data["days_since_first_obs"] >= config.min_history
    if config.start_date:
        eligible &= data["observation_date"] >= pd.Timestamp(config.start_date)
    labeled = data.loc[eligible].dropna(subset=["target_logret"]).reset_index(drop=True)
    if labeled.empty:
        raise ValueError("Não há alvos completos após os filtros de histórico e data inicial.")
    return labeled, latest, list(features.columns)


def temporal_split(labeled: pd.DataFrame, config: TrainingConfig):
    test_start = labeled["observation_date"].max() - pd.Timedelta(days=config.test_days - 1)
    train_end = test_start - pd.Timedelta(days=config.gap_days)
    train = labeled[labeled["observation_date"] < train_end].sort_values("observation_date")
    test = labeled[labeled["observation_date"] >= test_start].sort_values("observation_date")
    if train.empty or test.empty:
        raise ValueError(
            "Histórico insuficiente para separar treino e teste com o intervalo do alvo."
        )
    return train, test


def walk_forward_folds(dates: pd.Series, config: TrainingConfig):
    gap = pd.Timedelta(days=config.gap_days)
    anchor = dates.max() + pd.Timedelta(days=1)
    for fold in range(config.cv_folds, 0, -1):
        end = anchor - pd.Timedelta(days=config.fold_days * (fold - 1))
        start = end - pd.Timedelta(days=config.fold_days)
        fit_mask = dates < start - gap
        eval_mask = (dates >= start) & (dates < end)
        label = f"{start.date()} .. {(end - pd.Timedelta(days=1)).date()}"
        if not fit_mask.any() or not eval_mask.any():
            raise ValueError(
                f"Histórico insuficiente no fold {label}; reduza cv_folds/fold_days/test_days "
                "ou forneça mais dados."
            )
        yield label, fit_mask, eval_mask


def percentage_gain(error, baseline):
    """Ganho indefinido quando a baseline já tem erro zero."""
    return 100 * (1 - error / baseline) if baseline > 0 else np.nan


def eval_models(train, features, config, models):
    rows = []
    # Verifica todos os folds antes de começar os treinos mais demorados.
    folds = list(walk_forward_folds(train["observation_date"], config))
    for label, fit_mask, eval_mask in folds:
        actual = train.loc[eval_mask, "target_logret"].to_numpy()
        items = train.loc[eval_mask, "market_hash_name"].to_numpy()
        for name, candidate in models.items():
            print(f"Validação: {label} | {name}", flush=True)
            model = clone(candidate).fit(
                train.loc[fit_mask, features], train.loc[fit_mask, "target_logret"]
            )
            prediction = model.predict(train.loc[eval_mask, features])
            error, naive_error = np.abs(actual - prediction), np.abs(actual)
            rows.append(
                {
                    "periodo": label,
                    "model": name,
                    "mae_logret": error.mean(),
                    "ganho_vs_ingenuo_%": percentage_gain(error.mean(), naive_error.mean()),
                    "itens_ok_%": 100
                    * np.mean(
                        [
                            error[items == item].mean() < naive_error[items == item].mean()
                            for item in np.unique(items)
                        ]
                    ),
                }
            )
    details = pd.DataFrame(rows)
    summary = details.groupby("model", sort=False).agg(
        mae_logret=("mae_logret", "mean"),
        mae_logret_std=("mae_logret", "std"),
        ganho_vs_ingenuo_pct=("ganho_vs_ingenuo_%", "mean"),
        itens_ok_pct=("itens_ok_%", "mean"),
    )
    # Cada período tem o mesmo peso. MAE desempata e cobre baselines com erro zero.
    summary = summary.sort_values(
        ["ganho_vs_ingenuo_pct", "mae_logret"], ascending=[False, True], kind="stable"
    )
    return details, summary.reset_index()


def price_metrics(y_true, y_pred, price_now) -> dict:
    y_true, y_pred, price_now = map(np.asarray, (y_true, y_pred, price_now))
    true_price = price_now * np.exp(y_true)
    predicted_price = price_now * np.exp(y_pred)
    moved = y_true != 0
    direction = np.nan
    if moved.any() and not np.allclose(y_pred, 0):
        direction = 100 * np.mean(np.sign(y_pred[moved]) == np.sign(y_true[moved]))
    return {
        "MAE": mean_absolute_error(true_price, predicted_price),
        "RMSE": np.sqrt(mean_squared_error(true_price, predicted_price)),
        "MAPE_%": 100 * mean_absolute_percentage_error(true_price, predicted_price),
        "MAE_logret": mean_absolute_error(y_true, y_pred),
        "R2_retorno": r2_score(y_true, y_pred) if len(y_true) > 1 else np.nan,
        "acerto_direcao_%": direction,
    }


def eval_final(train, test, features, models):
    predictions, rows = {}, {}
    for name, candidate in models.items():
        print(f"Teste: {name}", flush=True)
        model = clone(candidate).fit(train[features], train["target_logret"])
        predictions[name] = model.predict(test[features])
        rows[name] = price_metrics(test["target_logret"], predictions[name], test["price"])
    results = pd.DataFrame.from_dict(rows, orient="index").rename_axis("model")
    for baseline, column in ((NAIVE, "ganho_vs_ingenuo_%"), (EMA, "ganho_vs_ema_%")):
        results[column] = results["MAE"].map(
            lambda error, baseline=baseline: percentage_gain(error, results.loc[baseline, "MAE"])
        )
    return results.reset_index(), predictions


def eval_per_item(test, predictions, best_name):
    rows = []
    evaluation = test[["market_hash_name", "price", "volume", "target_price"]].copy()
    evaluation["pred_price"] = test["price"].to_numpy() * np.exp(predictions[best_name])
    evaluation["ema_price"] = test["price"].to_numpy() * np.exp(predictions[EMA])
    for item, group in evaluation.groupby("market_hash_name"):
        actual = group["target_price"]
        error = mean_absolute_error(actual, group["pred_price"])
        naive_error = mean_absolute_error(actual, group["price"])
        ema_error = mean_absolute_error(actual, group["ema_price"])
        rows.append(
            {
                "market_hash_name": item,
                "volume_mediano": group["volume"].median(),
                "MAE_modelo": error,
                "MAE_ingenuo": naive_error,
                "MAE_ema": ema_error,
                "MAPE_modelo_%": 100 * mean_absolute_percentage_error(actual, group["pred_price"]),
                "ganho_vs_ingenuo_%": percentage_gain(error, naive_error),
                "ganho_vs_ema_%": percentage_gain(error, ema_error),
            }
        )
    return pd.DataFrame(rows).sort_values("ganho_vs_ingenuo_%", ascending=False)


def make_forecast(model, latest, features, config):
    forecast = latest[["market_hash_name", "observation_date", "price", "volume"]].copy()
    log_return = model.predict(latest[features])
    forecast["retorno_previsto_%"] = 100 * np.expm1(log_return)
    forecast["preco_previsto"] = latest["price"] * np.exp(log_return)
    forecast["data_alvo"] = latest["observation_date"] + pd.Timedelta(days=config.horizon)
    forecast["historico_curto"] = latest["days_since_first_obs"] < config.min_history
    return (
        forecast.rename(columns={"observation_date": "data_base", "price": "preco_atual"})
        .sort_values("retorno_previsto_%", ascending=False)
        .reset_index(drop=True)
    )


def train_and_save(csv_path: Path, output_dir: Path, config: TrainingConfig):
    labeled, latest, features = prepare_data(csv_path, config)
    train, test = temporal_split(labeled, config)
    print(f"{len(features)} features | treino: {len(train)} | teste: {len(test)}", flush=True)
    models = get_models(
        config.random_state,
        ema_weight=config.ema_weight,
        target_clip=config.target_clip,
        n_jobs=config.n_jobs,
    )
    cv_details, cv_summary = eval_models(train, features, config, models)
    best_name = cv_summary.iloc[0]["model"]
    print(f"\n{cv_summary.to_string(index=False)}\nModelo escolhido no CV: {best_name}")
    test_metrics, predictions = eval_final(train, test, features, models)
    per_item = eval_per_item(test, predictions, best_name)
    print(f"\n{test_metrics.to_string(index=False)}")

    # A escolha precede o teste. Só depois da avaliação retreina com todos os alvos.
    final_model = clone(models[best_name]).fit(labeled[features], labeled["target_logret"])
    forecast = make_forecast(final_model, latest, features, config)
    metadata = {
        "model_name": best_name,
        "features": features,
        "config": asdict(config),
        "target": "log(media_preco_t+H-W_a_t+H+W / preco_atual)",
        "selection_metric": "ganho médio de MAE de log-retorno vs ingênuo no walk-forward",
        "data_path": str(Path(csv_path).resolve()),
        "labeled_rows": len(labeled),
        "train_end": str(train["observation_date"].max().date()),
        "test_start": str(test["observation_date"].min().date()),
        "test_end": str(test["observation_date"].max().date()),
        "refit_end": str(labeled["observation_date"].max().date()),
        "versions": {
            package: version(package)
            for package in ("numpy", "pandas", "scikit-learn", "lightgbm", "joblib")
        },
    }
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    cv_details.to_csv(output_dir / "cv_folds.csv", index=False)
    cv_summary.to_csv(output_dir / "cv_summary.csv", index=False)
    test_metrics.to_csv(output_dir / "test_metrics.csv", index=False)
    per_item.to_csv(output_dir / "metrics_per_item.csv", index=False)
    forecast.to_csv(output_dir / f"previsao_{config.horizon}d.csv", index=False)
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    joblib.dump({"model": final_model, **metadata}, output_dir / "price_model.joblib")
    print(f"\nModelo, métricas e previsões salvos em {output_dir.resolve()}")
    return metadata


def main():
    defaults = TrainingConfig()
    parser = argparse.ArgumentParser(description="Treina e compara previsores de preços de TF2.")
    parser.add_argument("--data", type=Path, default=ML_DIR / "data" / "tf2_historico.csv")
    parser.add_argument("--output-dir", type=Path, default=ML_DIR / "artifacts")
    for option in (
        "horizon",
        "target_half_window",
        "test_days",
        "cv_folds",
        "fold_days",
        "min_history",
        "random_state",
        "n_jobs",
    ):
        parser.add_argument(
            f"--{option.replace('_', '-')}", type=int, default=getattr(defaults, option)
        )
    parser.add_argument("--target-clip", type=float, default=defaults.target_clip)
    parser.add_argument("--ema-weight", type=float, default=defaults.ema_weight)
    parser.add_argument(
        "--start-date",
        default=defaults.start_date,
        help="Data inicial (AAAA-MM-DD); use 'none' para todo o histórico.",
    )
    args = vars(parser.parse_args())
    csv_path, output_dir = args.pop("data"), args.pop("output_dir")
    if args["start_date"].lower() == "none":
        args["start_date"] = None
    try:
        train_and_save(csv_path, output_dir, TrainingConfig(**args))
    except (ValueError, FileNotFoundError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
