"""Integração real entre as migrações, o ambiente ML e a API."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from app.db.session import obter_sessao  # noqa: E402
from app.main import create_app  # noqa: E402

from backend.tests.conftest import conexao as conexao  # noqa: E402
from ml.tests.conftest import config as config  # noqa: E402
from ml.tests.conftest import csv_path as csv_path  # noqa: E402
from ml.tests.conftest import history as history  # noqa: E402


@pytest.fixture
def database(conexao):
    engine = conexao.engine
    assert engine.url.database.endswith("_test")
    with engine.begin() as connection:
        for table in (
            "previsao",
            "execucao_previsao",
            "ativacao_modelo",
            "modelo_ativo",
            "modelo_versao",
            "preco_diario",
            "item_acompanhado",
            "item",
            "execucao_coleta",
        ):
            connection.execute(text(f"DELETE FROM {table}"))
    return engine


@pytest.fixture
def api(database):
    app = create_app()

    def session():
        with Session(database) as value:
            yield value

    app.dependency_overrides[obter_sessao] = session
    with TestClient(app) as client:
        yield client
