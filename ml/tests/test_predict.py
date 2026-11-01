from dataclasses import asdict
from io import BytesIO

import joblib
import numpy as np
import pytest

from ml.models import RatioBaseline
from ml.predict import load_artifact, predict_history
from ml.train import TrainingConfig, build_features, load_data, make_forecast


def artifact_for(history, csv_path):
    config = TrainingConfig()
    data = load_data(csv_path)
    features = build_features(data)
    return {
        "model": RatioBaseline().fit(features),
        "model_name": "ema_10",
        "config": asdict(config),
        "features": list(features.columns),
        "refit_end": "2020-06-01",
    }


def test_prediction_matches_training_features_without_refitting(history, csv_path, monkeypatch):
    artifact = artifact_for(history, csv_path)
    data = load_data(csv_path)
    features = build_features(data)
    latest = data.drop(columns="is_filled").join(features).groupby("market_hash_name").tail(1)
    expected = make_forecast(artifact["model"], latest, list(features), TrainingConfig())

    def fail(*args, **kwargs):
        pytest.fail("Inferência não pode chamar fit.")

    monkeypatch.setattr(RatioBaseline, "fit", fail)
    result = predict_history(artifact, history)
    np.testing.assert_allclose(result["preco_previsto"], expected["preco_previsto"])
    assert result["market_hash_name"].tolist() == expected["market_hash_name"].tolist()


def test_prediction_does_not_require_future_targets_and_flags_new_items(history, csv_path):
    artifact = artifact_for(history, csv_path)
    small = history.groupby("market_hash_name").tail(2).copy()
    small["days_since_first_obs"] = 1
    result = predict_history(artifact, small)
    assert len(result) == 3
    assert result["historico_curto"].all()


@pytest.mark.parametrize("refit_end", ["2030-01-01", "2020-08-25"])
def test_prediction_rejects_incompatible_features_and_historical_backcast(
    history, csv_path, refit_end
):
    artifact = artifact_for(history, csv_path)
    artifact["features"] = artifact["features"][::-1]
    with pytest.raises(ValueError, match="Features"):
        predict_history(artifact, history)
    artifact["features"] = artifact["features"][::-1]
    artifact["refit_end"] = refit_end
    with pytest.raises(ValueError, match="posteriores"):
        predict_history(artifact, history)


def test_prediction_rejects_nonfinite_prices(history, csv_path, monkeypatch):
    artifact = artifact_for(history, csv_path)
    monkeypatch.setattr(artifact["model"], "predict", lambda data: np.full(len(data), np.nan))
    with pytest.raises(ValueError, match="preços inválidos"):
        predict_history(artifact, history)


def test_loading_rejects_missing_metadata():
    stream = BytesIO()
    joblib.dump({"model": RatioBaseline()}, stream)
    stream.seek(0)
    with pytest.raises(ValueError, match="Artefato inválido"):
        load_artifact(stream)


def test_calibration_end_blocks_backcast_even_after_training_end(history, csv_path):
    artifact = artifact_for(history, csv_path)
    artifact["inference_after"] = "2020-09-01"
    with pytest.raises(ValueError, match="posteriores"):
        predict_history(artifact, history)


def test_legacy_artifact_keeps_interval_unavailable(history, csv_path):
    artifact = artifact_for(history, csv_path)
    artifact["config"].pop("calibration_days")
    result = predict_history(artifact, history)
    assert result["intervalo_inferior"].isna().all()
    assert result["nivel_confianca"].isna().all()
