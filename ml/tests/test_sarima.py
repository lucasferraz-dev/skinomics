import json
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest
from threadpoolctl import threadpool_limits

from ml import experiments, sarima
from ml.experiments import run_experiment, select_items
from ml.models import RatioBaseline, get_models
from ml.sarima import (
    ItemSarima,
    SarimaConfig,
    daily_log_prices,
    forecast_log_return,
    get_sarima_specs,
    rolling_predictions,
)
from ml.train import TrainingConfig, prepare_data


def test_daily_calendar_keeps_missing_days_and_separates_items(history):
    item = history[history["market_hash_name"] == "Case A"].copy()
    missing_date = item.iloc[40]["observation_date"]
    series = daily_log_prices(item.drop(item.index[40]))
    assert len(series) == len(item)
    assert np.isnan(series.loc[missing_date])
    assert series.index.freqstr == "D"
    with pytest.raises(ValueError, match="exatamente um item"):
        daily_log_prices(history)


@pytest.mark.parametrize("horizon,window", [(1, 0), (7, 2), (15, 2), (30, 2)])
def test_price_target_uses_correct_days_and_lognormal_correction(horizon, window):
    def get_forecast(steps):
        assert steps == horizon + window
        return SimpleNamespace(
            predicted_mean=np.log(np.arange(1, steps + 1)),
            var_pred_mean=np.repeat(0.2, steps),
        )

    result = SimpleNamespace(get_forecast=get_forecast)
    prediction = forecast_log_return(result, 2, horizon, window)
    expected_price = np.arange(horizon - window, horizon + window + 1).mean() * np.exp(0.1)
    assert prediction == pytest.approx(np.log(expected_price / 2))


def test_fit_excludes_future_and_state_update_consumes_only_known_days(monkeypatch):
    dates = pd.date_range("2020-01-01", periods=150)
    series = pd.Series(np.linspace(0, 1, 150), index=dates)
    series.iloc[106] = np.nan
    captured = {}

    class Result:
        mle_retvals = {"converged": True}
        params = [1.0]

        def extend(self, observations):
            captured["update"] = observations
            return self

        def get_forecast(self, steps):
            return SimpleNamespace(predicted_mean=np.zeros(steps), var_pred_mean=np.zeros(steps))

    def factory(sample, **kwargs):
        captured["fit"] = sample
        return SimpleNamespace(fit=lambda **kwargs: Result())

    monkeypatch.setattr(sarima, "SARIMAX", factory)
    config = SarimaConfig(history_days=100, min_observations=30)
    model = ItemSarima(*get_sarima_specs()["arima_111"], config).fit(series, dates[100])
    prediction, reason = model.predict_at(series, dates[110], 1, 7, 2, 0.5)
    assert reason == ""
    assert prediction == 0
    assert captured["fit"].index.min() == dates[1]
    assert captured["fit"].index.max() == dates[100]
    assert captured["update"].index.min() == dates[101]
    assert captured["update"].index.max() == dates[110]
    assert captured["update"].isna().sum() == 1
    with pytest.raises(ValueError, match="posteriores"):
        model.predict_at(series, dates[109], 1, 7, 2, 0.5)


def test_actual_arima_forecasts_unchanged_when_future_prices_change():
    rng = np.random.default_rng(42)
    prices = np.exp(2 + np.cumsum(rng.normal(0.001, 0.02, 220)))
    history = pd.DataFrame(
        {
            "market_hash_name": "item",
            "observation_date": pd.date_range("2020-01-01", periods=220),
            "price": prices,
        }
    )
    observations = history.iloc[180:185].assign(ema_10_rel=0.0)
    spec = ((0, 1, 0), (0, 0, 0, 0))
    args = (
        observations,
        history.iloc[150]["observation_date"],
        spec,
        TrainingConfig(),
        SarimaConfig(),
    )
    first, diagnostic = rolling_predictions(history, *args)
    assert diagnostic["fit_status"] == "ok"
    assert diagnostic["fallback_count"] == 0
    history.loc[history.index >= 185, "price"] *= 100
    changed, _ = rolling_predictions(history, *args)
    pd.testing.assert_frame_equal(first, changed)


@pytest.mark.parametrize("failure", ["insufficient_history", "non_convergence", "fit_failed"])
def test_failed_fits_fall_back_to_ema_without_dropping_predictions(
    csv_path, config, monkeypatch, failure
):
    labeled, _, _ = prepare_data(csv_path, config)
    observations = labeled[labeled["market_hash_name"] == "Case A"].tail(4)
    history = pd.read_csv(csv_path, parse_dates=["observation_date"])
    history = history[history["market_hash_name"] == "Case A"]

    def factory(*args, **kwargs):
        if failure == "fit_failed":
            raise ValueError("falha numérica simulada")
        return SimpleNamespace(
            fit=lambda **kwargs: SimpleNamespace(mle_retvals={"converged": False})
        )

    monkeypatch.setattr(sarima, "SARIMAX", factory)
    min_obs = 500 if failure == "insufficient_history" else 30
    predictions, diagnostics = rolling_predictions(
        history,
        observations,
        pd.Timestamp("2020-05-01"),
        get_sarima_specs()["arima_111"],
        config,
        SarimaConfig(min_observations=min_obs),
    )
    assert diagnostics["fit_status"] == failure
    assert diagnostics["fallback_count"] == len(observations)
    assert predictions["fallback_reason"].eq(failure).all()
    np.testing.assert_allclose(predictions["prediction"], RatioBaseline().predict(observations))


def test_invalid_forecast_uses_fallback():
    series = pd.Series(0.0, index=pd.date_range("2020-01-01", periods=30))
    model = ItemSarima(*get_sarima_specs()["arima_111"], SarimaConfig())
    model.last_date = series.index[-1]
    model.result = SimpleNamespace(
        get_forecast=lambda steps: SimpleNamespace(
            predicted_mean=np.full(steps, np.nan),
            var_pred_mean=np.ones(steps),
        )
    )
    prediction, reason = model.predict_at(series, series.index[-1], 1, 7, 2, 0.123)
    assert prediction == 0.123
    assert reason == "forecast_failed"


def test_item_selection_spans_training_liquidity():
    training = pd.DataFrame(
        {"market_hash_name": ["a", "b", "c", "d", "e"], "volume": [1, 5, 10, 50, 100]}
    )
    assert select_items(training, 3) == ["a", "c", "e"]
    assert len(select_items(training, 0)) == 5
    assert select_items(training, items=["b", "a", "b"]) == ["b", "a"]
    with pytest.raises(ValueError, match="ausentes"):
        select_items(training, items=["novo"])


@pytest.mark.parametrize(
    "kwargs",
    [
        {"seasonal_period": 1},
        {"maxiter": 0},
        {"min_observations": 1},
        {"history_days": 10},
        {"history_days": 50, "min_observations": 100},
    ],
)
def test_invalid_sarima_config(kwargs):
    with pytest.raises(ValueError):
        SarimaConfig(**kwargs)


def test_experiment_compares_same_samples_and_writes_separate_reports(
    csv_path, tmp_path, config, monkeypatch
):
    def small_models(*args, **kwargs):
        models = get_models(*args, **kwargs)
        for name, model in models.items():
            if name.startswith("hgb"):
                model.set_params(
                    estimator__max_iter=4,
                    estimator__min_samples_leaf=5,
                    estimator__early_stopping=False,
                )
            elif name.startswith("lightgbm"):
                model.set_params(estimator__n_estimators=4, estimator__min_child_samples=5)
        return models

    monkeypatch.setattr(experiments, "get_models", small_models)
    # O caminho numérico real é exercitado; a grade completa permanece no relatório.
    output = tmp_path / "experiment"
    with threadpool_limits(limits=1):
        metadata = run_experiment(csv_path, output, config, SarimaConfig(maxiter=20), max_items=2)
    saved = json.loads((output / "metadata.json").read_text(encoding="utf-8"))
    assert saved["experimental"] is True
    assert len(saved["items"]) == 2
    cv = pd.read_csv(output / "cv_summary.csv")
    assert saved["selected_by_cv"] == cv.iloc[0]["model"]
    assert saved["selected_sarima_by_cv"] in get_sarima_specs()
    predictions = pd.read_csv(output / "predictions.csv")
    expected_models = set(get_models()) | set(get_sarima_specs())
    for _, group in predictions.groupby(["phase", "periodo"]):
        assert set(group["model"]) == expected_models
        assert group.groupby("model").size().nunique() == 1
        counts = group.groupby(["market_hash_name", "observation_date"])["model"].nunique()
        assert counts.eq(len(expected_models)).all()
    test = pd.read_csv(output / "test_metrics.csv")
    assert set(test["model"]) == expected_models
    runtime = pd.read_csv(output / "runtime.csv")
    test_runtime = runtime[runtime["phase"] == "test"].set_index("model")
    np.testing.assert_allclose(
        test.set_index("model").sort_index()["fallback_pct"],
        test_runtime.sort_index()["fallback_pct"],
    )
    forecast = pd.read_csv(output / "previsao_7d.csv")
    assert len(forecast) == 2 * len(expected_models)
    assert forecast["preco_previsto"].gt(0).all()
    assert not (output / "price_model.joblib").exists()
    assert metadata["selected_by_cv"] == saved["selected_by_cv"]
