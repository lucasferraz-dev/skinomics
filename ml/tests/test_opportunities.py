from dataclasses import asdict
from types import SimpleNamespace

import numpy as np
import pandas as pd
import pytest

from ml.evaluate_opportunities import evaluate_sample
from ml.train import TrainingConfig, build_features, clean_history


@pytest.fixture
def artifact(history):
    return {
        "model": SimpleNamespace(predict=lambda features: np.full(len(features), 0.1)),
        "model_name": "test",
        "config": asdict(TrainingConfig()),
        "features": list(build_features(clean_history(history)).columns),
        "refit_end": "2020-04-01",
        "inference_after": "2020-05-01",
        "test_start": "2020-06-01",
        "test_end": "2020-07-01",
    }


def test_sample_has_ranked_outcomes_and_separate_risk(artifact, history):
    result = evaluate_sample(artifact, history, sample_dates=3, top_k=2)
    assert result["oportunidades"] == result["avaliadas"] == 6
    assert result["dates"] == ["2020-06-01", "2020-06-16", "2020-07-01"]
    assert all(row["posicao"] in (1, 2) for row in result["rows"])
    assert 0 <= result["acerto_margem_positiva"] <= 1
    assert result["por_risco"]["alto"]["avaliadas"] == 6  # Sem intervalo no artefato legado.


def test_future_changes_outcome_but_not_selection_prediction_or_risk(artifact, history):
    artifact["test_end"] = artifact["test_start"]
    before = evaluate_sample(artifact, history, sample_dates=1, top_k=3)
    changed = history.copy()
    future = changed["observation_date"] > pd.Timestamp(artifact["test_start"])
    changed.loc[future, "price"] *= 10
    changed.loc[future, "volume"] = 1
    after = evaluate_sample(artifact, changed, sample_dates=1, top_k=3)
    for original, modified in zip(before["rows"], after["rows"], strict=True):
        for key in (
            "item",
            "posicao",
            "preco_previsto",
            "margem_estimada",
            "risco",
            "motivos_risco",
        ):
            assert original[key] == modified[key]
        assert modified["preco_real"] == pytest.approx(original["preco_real"] * 10)


def test_sample_rejects_model_that_saw_holdout(artifact, history):
    artifact["refit_end"] = artifact["test_end"]
    with pytest.raises(ValueError, match="posterior"):
        evaluate_sample(artifact, history)


def test_missing_outcomes_are_reported_not_removed_from_ranking(artifact, history):
    truncated = history[history["observation_date"] <= pd.Timestamp(artifact["test_end"])]
    result = evaluate_sample(artifact, truncated, sample_dates=2, top_k=2)
    assert result["oportunidades"] == 4
    assert result["avaliadas"] == 2
    assert result["sem_alvo_completo"] == 2
