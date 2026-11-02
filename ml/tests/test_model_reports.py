import copy
import json
import sys
from contextlib import nullcontext
from datetime import UTC, datetime
from types import SimpleNamespace

import numpy as np
import pytest
from sqlalchemy.exc import OperationalError

from ml import database, model_reports, registry, train


def test_price_accuracy_is_fraction_within_tolerance_not_one_minus_mape():
    result = train.price_metrics(np.zeros(4), np.log([1.15, 0.85, 1.16, 0.84]), np.ones(4))
    assert result["n"] == 4
    assert result["acerto_preco_%"] == 50
    assert result["MAPE_%"] == pytest.approx(15.5)
    assert np.isnan(result["acerto_direcao_%"])


def test_evaluation_fingerprint_ignores_order_but_detects_changed_targets(csv_path, config):
    labeled, _, _ = train.prepare_data(csv_path, config)
    _, test = train.temporal_split(labeled, config)
    original = train.evaluation_metadata(test)
    assert original == train.evaluation_metadata(test.sample(frac=1, random_state=42))
    changed = test.copy()
    changed.loc[changed.index[0], "target_price"] *= 1.01
    assert train.evaluation_metadata(changed)["test_sha256"] != original["test_sha256"]


def test_summary_uses_metrics_of_selected_model_and_preserves_missing_values():
    record = {
        "id": "version",
        "nome": "hgb",
        "horizonte": 7,
        "meia_janela": 2,
        "ativo": False,
        "criado_em": datetime.now(UTC),
        "metadados": {
            "metrics": {
                "test": [
                    {"model": "ingenuo", "MAE": 0.1},
                    {"model": "hgb", "MAE": 0.2, "acerto_direcao_%": None},
                ]
            }
        },
    }
    summary = model_reports.version_summary(record)
    assert summary["metrics"]["MAE"] == 0.2
    assert summary["metrics"]["acerto_direcao_%"] is None
    assert "N/D" in model_reports.render_versions([summary])
    record["metadados"] = {}
    legacy = model_reports.version_summary(record)
    assert legacy["metrics"] == {}
    assert "N/D" in model_reports.render_versions([legacy])


@pytest.fixture
def versions():
    first = {
        "version_id": "a",
        "model": "hgb",
        "horizon": 7,
        "target_half_window": 2,
        "target": "mean",
        "test_start": "2020-01-01",
        "test_end": "2020-06-01",
        "metrics": {"MAE": 0.1},
        "evaluation": {
            "test_sha256": "same",
            "price_accuracy_tolerance": 0.15,
            "price_band_basis": "preco_base_usd",
        },
    }
    return [first, {**copy.deepcopy(first), "version_id": "b"}]


@pytest.mark.parametrize(
    "change", ["horizon", "test_start", "fingerprint", "legacy", "tolerance", "bands"]
)
def test_comparison_warns_instead_of_ranking_incompatible_versions(monkeypatch, versions, change):
    second = versions[1]
    if change == "horizon":
        second["horizon"] = 30
    elif change == "test_start":
        second["test_start"] = "2019-01-01"
    elif change == "fingerprint":
        second["evaluation"]["test_sha256"] = "different"
    elif change == "tolerance":
        second["evaluation"]["price_accuracy_tolerance"] = 0.1
    elif change == "bands":
        second["evaluation"]["price_band_basis"] = "preco_futuro_usd"
    else:
        second["evaluation"] = {}
    monkeypatch.setattr(model_reports, "show_version", lambda engine, vid: versions[vid == "b"])
    comparison = model_reports.compare_versions(None, ["a", "b"])
    assert comparison["comparable"] is False
    assert comparison["warnings"]


def test_comparison_accepts_same_evaluation_and_rejects_duplicate_versions(monkeypatch, versions):
    monkeypatch.setattr(model_reports, "show_version", lambda engine, vid: versions[vid == "b"])
    assert model_reports.compare_versions(None, ["a", "b"])["comparable"] is True
    for values in (["a"], ["a", "a"]):
        with pytest.raises(ValueError, match="duas versões diferentes"):
            model_reports.compare_versions(None, values)


@pytest.mark.parametrize("command", ["list", "show", "compare"])
def test_registry_read_commands_emit_machine_readable_json(monkeypatch, capsys, command):
    engine = SimpleNamespace(dispose=lambda: None)
    monkeypatch.setattr(registry, "database_engine", lambda: engine)
    payload = {"test": None, "percent": 72.5}
    monkeypatch.setattr(model_reports, "list_versions", lambda *args, **kwargs: payload)
    monkeypatch.setattr(model_reports, "show_version", lambda *args, **kwargs: payload)
    monkeypatch.setattr(model_reports, "compare_versions", lambda *args, **kwargs: payload)
    arguments = [] if command == "list" else ["a"] if command == "show" else ["a", "b"]
    monkeypatch.setattr(sys, "argv", ["registry", command, *arguments, "--json"])
    registry.main()
    assert json.loads(capsys.readouterr().out) == payload


@pytest.mark.parametrize(
    ("arguments", "registered"),
    [([], False), (["--register"], True), (["--database", "--no-register"], False)],
)
def test_training_registration_options(monkeypatch, tmp_path, arguments, registered):
    calls = []
    engine = SimpleNamespace(dispose=lambda: None, connect=lambda: nullcontext(None))
    monkeypatch.setattr(database, "database_engine", lambda: engine)
    monkeypatch.setattr(database, "load_history", lambda connection: "history")
    monkeypatch.setattr(train, "train_and_save", lambda *args: {"version_id": "a"})
    monkeypatch.setattr(registry, "register_model", lambda *args: calls.append(args) or "a")
    monkeypatch.setattr(sys, "argv", ["train", "--output-dir", str(tmp_path), *arguments])
    train.main()
    assert len(calls) == int(registered)
    if registered:
        assert calls[0] == (engine, tmp_path / "a" / "price_model.joblib")


def test_failed_registration_preserves_artifact_and_explains_recovery(
    monkeypatch, tmp_path, capsys
):
    artifact = tmp_path / "a" / "price_model.joblib"
    disposed = []
    engine = SimpleNamespace(dispose=lambda: disposed.append(True))

    def train_success(*args):
        artifact.parent.mkdir()
        artifact.write_bytes(b"saved artifact")
        return {"version_id": "a"}

    def database_failure(*args):
        raise OperationalError("insert", {}, Exception("database unavailable"))

    monkeypatch.setattr(database, "database_engine", lambda: engine)
    monkeypatch.setattr(train, "train_and_save", train_success)
    monkeypatch.setattr(registry, "register_model", database_failure)
    monkeypatch.setattr(sys, "argv", ["train", "--register", "--output-dir", str(tmp_path)])
    with pytest.raises(SystemExit) as result:
        train.main()
    assert result.value.code == 2
    assert artifact.read_bytes() == b"saved artifact"
    assert disposed == [True]
    error = capsys.readouterr().err
    assert "cadastro falhou" in error
    assert "python -m ml.registry register" in error
    assert str(artifact) in error


def test_empty_registry_and_invalid_filters_do_not_require_a_database():
    assert "Nenhuma versão" in model_reports.render_versions([])
    for kwargs in ({"limit": 0}, {"horizon": -1}):
        with pytest.raises(ValueError, match="positivos"):
            model_reports.list_versions(None, **kwargs)
