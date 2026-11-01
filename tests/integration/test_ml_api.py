from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
import pytest
from app.coleta.importar_csv import importar_csv
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from threadpoolctl import threadpool_limits

from ml import predict, train, worker
from ml.database import load_history
from ml.models import get_models
from ml.registry import activate_model, register_model


@pytest.fixture
def trained(database, history, csv_path, tmp_path, config, monkeypatch):
    # Percorre o mesmo importador da aplicação, sem escrever diretamente nas tabelas de preço.
    imported = history.assign(
        appid=440,
        item_name=history["market_hash_name"],
        item_type="Case",
        icon_url="",
        price=history["price"].round(4),  # Mesma precisão de preco_diario (USD).
    )
    imported.to_csv(csv_path, index=False)
    with Session(database) as session:
        importar_csv(session, csv_path)
    with database.connect() as connection:
        data = load_history(connection)
    pd.testing.assert_frame_equal(
        train.build_features(train.load_data(csv_path)),
        train.build_features(train.clean_history(data)),
    )

    def small_models(*args, **kwargs):
        models = get_models(*args, **kwargs)
        for name, model in models.items():
            if name.startswith("hgb"):
                model.set_params(estimator__max_iter=4, estimator__min_samples_leaf=5)
            elif name.startswith("lightgbm"):
                model.set_params(estimator__n_estimators=4, estimator__min_child_samples=5)
        return models

    monkeypatch.setattr(train, "get_models", small_models)
    root = tmp_path / "models"
    monkeypatch.setenv("SKINOMICS_MODEL_DIR", str(root))
    with threadpool_limits(limits=1):
        metadata = train.train_and_save(data, root, config)
    path = root / metadata["version_id"] / "price_model.joblib"
    model_id = register_model(database, path, root)
    assert register_model(database, path, root) == model_id
    assert metadata["metrics"]["price_ranges"]
    assert metadata["data_path"] == "postgresql:TF2"
    activate_model(database, model_id, reason="Validação de integração", root=root)
    return model_id, path, data


def count(database, table):
    with database.connect() as connection:
        return connection.scalar(text(f"SELECT count(*) FROM {table}"))


def test_import_train_register_predict_and_api(database, trained, api):
    model_id, path, data = trained
    with threadpool_limits(limits=1):
        result = predict.run_batch(database)
        expected = predict.predict_history(predict.load_artifact(path), data).set_index(
            "market_hash_name"
        )
    assert result["itens"] == 3
    assert count(database, "modelo_versao") == 1
    with database.connect() as connection:
        items = connection.execute(text("SELECT id, market_hash_name FROM item")).all()
    for item_id, name in items:
        payload = api.get(f"/itens/{item_id}/previsao").json()
        assert payload["disponivel"] is True
        assert payload["modelo_versao"] == model_id
        assert payload["desatualizada"] is True  # Histórico de 2020, não apresenta como atual.
        assert payload["preco_previsto"] == pytest.approx(
            expected.loc[name, "preco_previsto"], abs=1e-8
        )
        assert "artefato" not in payload
        assert payload["nivel_confianca"] == 0.8
        assert payload["intervalo_inferior"] == pytest.approx(
            expected.loc[name, "intervalo_inferior"], abs=1e-8
        )
        assert payload["intervalo_superior"] == pytest.approx(
            expected.loc[name, "intervalo_superior"], abs=1e-8
        )
        assert payload["incerteza_elevada"] == bool(expected.loc[name, "incerteza_elevada"])
    with threadpool_limits(limits=1):
        predict.run_batch(database)
    assert count(database, "previsao") == 3
    assert count(database, "execucao_previsao") == 2
    assert predict.run_batch(database, only_pending=True) is None


def test_worker_runs_after_collection_and_preserves_previous_version(database, trained, api):
    model_id, path, _data = trained
    with threadpool_limits(limits=1):
        assert worker.tick(database) == 0
        assert worker.tick(database) == 0
    assert count(database, "execucao_previsao") == 1
    with database.begin() as connection:
        connection.execute(
            text("""
            INSERT INTO execucao_coleta (tipo, status, finalizada_em)
            VALUES ('precos', 'sucesso', now())
        """)
        )
    with threadpool_limits(limits=1):
        assert worker.tick(database) == 0
    assert count(database, "execucao_previsao") == 2
    new_artifact = joblib.load(path)
    new_artifact["version_id"] = str(uuid4())
    new_path = Path(path).parent / "candidate.joblib"
    joblib.dump(new_artifact, new_path)
    new_id = register_model(database, new_path)
    activate_model(database, new_id, reason="Promover candidata")
    with database.connect() as connection:
        item_id = connection.scalar(text("SELECT id FROM item LIMIT 1"))
    assert api.get(f"/itens/{item_id}/previsao").json()["motivo"] == "aguardando_previsao"
    with threadpool_limits(limits=1):
        worker.tick(database)
    assert api.get(f"/itens/{item_id}/previsao").json()["modelo_versao"] == new_id
    assert activate_model(database, rollback=True, reason="Reverter candidata") == model_id
    assert api.get(f"/itens/{item_id}/previsao").json()["modelo_versao"] == model_id
    assert count(database, "ativacao_modelo") == 3
    assert count(database, "previsao") == 6


def test_hash_failure_is_logged_and_previous_forecasts_survive(database, trained):
    _, path, _ = trained
    with threadpool_limits(limits=1):
        predict.run_batch(database)
    path.write_bytes(b"arquivo alterado")
    with pytest.raises(ValueError, match="SHA-256"):
        predict.run_batch(database)
    assert count(database, "previsao") == 3
    with database.connect() as connection:
        failure = (
            connection.execute(text("SELECT * FROM execucao_previsao WHERE status = 'falha'"))
            .mappings()
            .one()
        )
    assert failure["finalizada_em"] is not None
    assert "SHA-256" in failure["erro"]


def test_concurrent_batch_does_not_duplicate_work(database, trained):
    with database.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(442, 7)"))
        try:
            assert predict.run_batch(database) is None
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(442, 7)"))
    assert count(database, "execucao_previsao") == 0


def test_worker_recovers_interrupted_run_even_when_a_valid_batch_exists(database, trained):
    model_id, _, _ = trained
    with threadpool_limits(limits=1):
        predict.run_batch(database)
    interrupted_id = str(uuid4())
    with database.begin() as connection:
        connection.execute(
            text("""
            INSERT INTO execucao_previsao (id, modelo_id, data_limite)
            VALUES (:id, :model, CURRENT_DATE)
        """),
            {"id": interrupted_id, "model": model_id},
        )
    assert predict.run_batch(database, only_pending=True) is None
    with database.connect() as connection:
        row = connection.execute(
            text("SELECT status, erro FROM execucao_previsao WHERE id = :id"),
            {"id": interrupted_id},
        ).one()
    assert row.status == "falha"
    assert "interrompido" in row.erro
    assert count(database, "previsao") == 3


def test_failed_write_rolls_back_entire_batch(database, trained, monkeypatch):
    with threadpool_limits(limits=1):
        predict.run_batch(database)
    with database.connect() as connection:
        before = connection.execute(
            text("SELECT item_id, preco_previsto FROM previsao ORDER BY item_id")
        ).all()
    original = predict.predict_history

    def invalid(*args):
        result = original(*args)
        result.loc[result.index[0], "preco_previsto"] = 100
        result.loc[result.index[-1], "preco_previsto"] = -1
        return result

    monkeypatch.setattr(predict, "predict_history", invalid)
    with threadpool_limits(limits=1), pytest.raises(IntegrityError):
        predict.run_batch(database)
    with database.connect() as connection:
        after = connection.execute(
            text("SELECT item_id, preco_previsto FROM previsao ORDER BY item_id")
        ).all()
        assert (
            connection.scalar(text("SELECT count(*) FROM execucao_previsao WHERE status='falha'"))
            == 1
        )
    np.testing.assert_equal(before, after)


@pytest.mark.parametrize("horizon", [15, 30])
def test_independent_horizons_train_calibrate_and_publish(database, trained, api, config, horizon):
    original_id, path, history = trained
    root = path.parent.parent
    with threadpool_limits(limits=1):
        metadata = train.train_and_save(
            history, root, replace(config, horizon=horizon, cv_folds=1, fold_days=10)
        )
        new_id = register_model(database, root / metadata["version_id"] / "price_model.joblib")
        activate_model(database, new_id, reason="Validar horizonte independente")
        worker.tick(database)
    with database.connect() as connection:
        item_id = connection.scalar(text("SELECT id FROM item LIMIT 1"))
    seven = api.get(f"/itens/{item_id}/previsao?horizonte=7").json()
    other = api.get(f"/itens/{item_id}/previsao?horizonte={horizon}").json()
    assert seven["modelo_versao"] == original_id
    assert other["modelo_versao"] == new_id
    assert other["horizonte"] == horizon
    assert other["nivel_confianca"] == seven["nivel_confianca"] == 0.8
    assert other["intervalo_inferior"] <= other["preco_previsto"] <= other["intervalo_superior"]
    assert (pd.Timestamp(other["data_alvo"]) - pd.Timestamp(other["data_base"])).days == horizon
    assert count(database, "previsao") == 6
