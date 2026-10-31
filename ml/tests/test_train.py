"""Regressões para alvos, causalidade das features e treinamento completo."""

import json
import subprocess
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.base import clone, is_regressor
from sklearn.dummy import DummyRegressor
from threadpoolctl import threadpool_limits

from ml import train
from ml.models import EMABlend, RatioBaseline, get_models
from ml.train import (
    KEY_ITEM,
    TrainingConfig,
    build_features,
    build_targets,
    load_data,
    prepare_data,
    price_metrics,
    temporal_split,
    walk_forward_folds,
)


@pytest.fixture
def history():
    days = 240
    dates = pd.date_range("2020-01-01", periods=days)
    return pd.concat(
        [
            pd.DataFrame(
                {
                    "observation_date": dates,
                    "market_hash_name": item,
                    "price": scale * np.exp(0.04 * np.sin(np.arange(days) / 4 + index)),
                    "volume": 100 + np.arange(days) % 50,
                    "is_filled": 0,
                    "days_since_first_obs": np.arange(days),
                    "scrape_timestamp_utc": "2021-01-01T12:00:00Z",
                }
            )
            for index, (item, scale) in enumerate((("Case A", 0.5), ("Case B", 2), (KEY_ITEM, 10)))
        ],
        ignore_index=True,
    )


@pytest.fixture
def csv_path(tmp_path, history):
    path = tmp_path / "historico.csv"
    history.to_csv(path, index=False)
    return path


@pytest.fixture
def config():
    return TrainingConfig(test_days=30, cv_folds=2, fold_days=30, n_jobs=1)


def test_load_discards_invalid_partial_and_duplicate_rows(tmp_path, history):
    history.loc[0, "price"] = 0
    history.loc[1, "volume"] = -1
    history.loc[2, "scrape_timestamp_utc"] = "2020-01-03T12:00:00Z"
    history.loc[3, "price"] = np.inf
    history.loc[4, "observation_date"] = pd.NaT
    history = pd.concat([history, history.iloc[[5]]], ignore_index=True)
    path = tmp_path / "sujo.csv"
    history.to_csv(path, index=False)
    cleaned = load_data(path)
    assert len(cleaned) == len(history) - 6
    assert not cleaned.duplicated(["market_hash_name", "observation_date"]).any()
    assert cleaned["price"].gt(0).all()


def test_load_requires_base_columns(tmp_path):
    path = tmp_path / "incompleto.csv"
    pd.DataFrame({"price": [1]}).to_csv(path, index=False)
    with pytest.raises(ValueError, match="Colunas ausentes.*observation_date"):
        load_data(path)


def test_target_matches_future_window_and_rejects_gaps(csv_path):
    data = load_data(csv_path)
    config = TrainingConfig()
    targets = build_targets(data, config)
    item = targets[targets["market_hash_name"] == "Case A"]
    assert item.iloc[0]["target_price"] == pytest.approx(item.iloc[5:10]["price"].mean())
    assert item.iloc[0]["target_logret"] == pytest.approx(
        np.log(item.iloc[5:10]["price"].mean() / item.iloc[0]["price"])
    )
    assert item.tail(config.gap_days)["target_price"].isna().all()
    missing_day = data.drop(index=item.index[7]).reset_index(drop=True)
    broken = build_targets(missing_day, config)
    assert pd.isna(broken[broken["market_hash_name"] == "Case A"].iloc[0]["target_price"])


def test_single_day_target(csv_path):
    data = load_data(csv_path)
    targets = build_targets(data, TrainingConfig(horizon=3, target_half_window=0))
    item = targets[targets["market_hash_name"] == "Case A"]
    assert item.iloc[0]["target_price"] == item.iloc[3]["price"]


def test_features_do_not_use_future_prices_or_targets(csv_path):
    data = load_data(csv_path)
    original = build_features(data)
    cutoff = pd.Timestamp("2020-05-01")
    future = data["observation_date"] > cutoff
    data.loc[future, "price"] *= 10
    data.loc[future, "volume"] *= 100
    data["target_logret"] = 999
    changed = build_features(data)
    pd.testing.assert_frame_equal(original.loc[~future], changed.loc[~future])
    assert len(original.columns) == 35
    assert "target_logret" not in original
    assert "days_since_first_obs" not in original
    assert "market_hash_name" not in original


def test_market_features_are_aligned_by_date(csv_path):
    data = load_data(csv_path)
    features = build_features(data)
    day = data["observation_date"].eq(pd.Timestamp("2020-03-01"))
    key = data["market_hash_name"].eq(KEY_ITEM)
    expected_market = features.loc[day & ~key, "ret_7"].median()
    expected_key = features.loc[day & key, "ret_7"].iloc[0]
    assert features.loc[day, "mkt_ret_7"].eq(expected_market).all()
    assert features.loc[day, "key_ret_7"].eq(expected_key).all()
    without_key = build_features(data.loc[~key])
    assert without_key["key_ret_7"].isna().all()


def test_holdout_and_cv_keep_all_target_dates_before_validation(csv_path, config):
    labeled, _, _ = prepare_data(csv_path, config)
    training, test = temporal_split(labeled, config)
    gap = pd.Timedelta(days=config.gap_days)
    assert training["observation_date"].max() + gap < test["observation_date"].min()
    eval_indices = []
    folds = list(walk_forward_folds(training["observation_date"], config))
    assert len(folds) == config.cv_folds
    for _, fit_mask, eval_mask in folds:
        fit_dates = training.loc[fit_mask, "observation_date"]
        eval_dates = training.loc[eval_mask, "observation_date"]
        assert fit_dates.max() + gap < eval_dates.min()
        assert not (fit_mask & eval_mask).any()
        eval_indices.extend(eval_dates.index)
    assert len(eval_indices) == len(set(eval_indices))


def test_short_history_fails_with_actionable_error():
    dates = pd.Series(pd.date_range("2020-01-01", periods=40))
    with pytest.raises(ValueError, match="Histórico insuficiente no fold"):
        list(walk_forward_folds(dates, TrainingConfig()))


@pytest.mark.parametrize(
    "kwargs",
    [
        {"horizon": 0},
        {"target_half_window": 7},
        {"target_half_window": -1},
        {"ema_weight": 2},
        {"target_clip": 0},
        {"target_clip": np.inf},
        {"cv_folds": 0},
        {"test_days": 0},
        {"n_jobs": 0},
    ],
)
def test_invalid_config(kwargs):
    with pytest.raises(ValueError):
        TrainingConfig(**kwargs)


def test_blend_clips_training_target_and_is_cloneable(tmp_path):
    features = pd.DataFrame({"ema_10_rel": [0.0, 0.1, -0.1]})
    model = EMABlend(DummyRegressor(strategy="mean"), ema_weight=0.25, clip=0.7)
    fitted = clone(model).fit(features, [-10, 0, 20])
    assert is_regressor(fitted)
    np.testing.assert_allclose(fitted.model_.constant_, 0, atol=1e-15)
    np.testing.assert_allclose(fitted.predict(features), 0.25 * np.log1p(features["ema_10_rel"]))
    path = tmp_path / "blend.joblib"
    joblib.dump(fitted, path)
    restored = joblib.load(path)
    np.testing.assert_allclose(restored.predict(features), fitted.predict(features))
    assert not hasattr(model, "model_")


def test_constant_prices_have_defined_errors_and_no_direction():
    metrics = price_metrics(np.zeros(3), np.zeros(3), np.ones(3))
    assert metrics["MAE"] == 0
    assert metrics["MAPE_%"] == 0
    assert np.isnan(metrics["acerto_direcao_%"])
    assert np.isnan(train.percentage_gain(0, 0))


def test_full_training_exports_reusable_model_and_forecast(csv_path, tmp_path, config, monkeypatch):
    def small_models(*args, **kwargs):
        models = get_models(*args, **kwargs)
        for name, model in models.items():
            if name.startswith("hgb"):
                model.set_params(
                    estimator__max_iter=8,
                    estimator__min_samples_leaf=5,
                    estimator__early_stopping=False,
                )
            elif name.startswith("lightgbm"):
                model.set_params(estimator__n_estimators=8, estimator__min_child_samples=5)
        return models

    monkeypatch.setattr(train, "get_models", small_models)
    output = tmp_path / "artifacts"
    with threadpool_limits(limits=1):
        metadata = train.train_and_save(csv_path, output, config)
    artifact = joblib.load(output / "price_model.joblib")
    labeled, latest, features = prepare_data(csv_path, config)
    assert artifact["features"] == features
    assert artifact["labeled_rows"] == len(labeled)
    assert artifact["model_name"] == metadata["model_name"]
    assert artifact["config"]["horizon"] == 7
    assert json.loads((output / "metadata.json").read_text(encoding="utf-8")) == metadata
    assert metadata["model_name"] == pd.read_csv(output / "cv_summary.csv").iloc[0]["model"]
    assert set(pd.read_csv(output / "test_metrics.csv")["model"]) == set(get_models())
    assert len(pd.read_csv(output / "cv_folds.csv")) == 12
    assert len(pd.read_csv(output / "metrics_per_item.csv")) == 3
    forecast = pd.read_csv(output / "previsao_7d.csv").set_index("market_hash_name")
    with threadpool_limits(limits=1):
        expected = latest["price"] * np.exp(artifact["model"].predict(latest[features]))
    np.testing.assert_allclose(forecast.loc[latest["market_hash_name"], "preco_previsto"], expected)
    assert forecast["preco_previsto"].gt(0).all()
    target_delta = pd.to_datetime(forecast["data_alvo"]) - pd.to_datetime(forecast["data_base"])
    assert target_delta.eq(pd.Timedelta(days=7)).all()

    # Um processo novo deve resolver classes customizadas sem depender de __main__.
    script = "import joblib, sys; a = joblib.load(sys.argv[1]); print(a['model_name'])"
    reloaded = subprocess.run(
        [sys.executable, "-c", script, str(output / "price_model.joblib")],
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
        check=True,
    )
    assert reloaded.stdout.strip() == metadata["model_name"]


def test_forecast_marks_short_history(csv_path, config):
    _, latest, features = prepare_data(csv_path, config)
    latest.loc[latest.index[0], "days_since_first_obs"] = 2
    result = train.make_forecast(RatioBaseline(), latest, features, config)
    assert result["historico_curto"].sum() == 1


@pytest.mark.parametrize("entrypoint", [["-m", "ml.train"], ["ml/train.py"]])
def test_cli_help(entrypoint):
    result = subprocess.run(
        [sys.executable, *entrypoint, "--help"],
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "--horizon" in result.stdout
    assert "--output-dir" in result.stdout
