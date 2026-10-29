from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Connection, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import obter_sessao
from app.main import create_app

ALEMBIC_INI = Path(__file__).parents[1] / "alembic.ini"


@pytest.fixture(scope="session")
def conexao() -> Iterator[Connection]:
    """Banco `<nome>_test`, recriado pelas migrações a cada rodada de testes."""
    url = make_url(get_settings().database_url)
    url_teste = url.set(database=f"{url.database}_test")

    # CREATE DATABASE não roda dentro de transação, por isso o AUTOCOMMIT.
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as con:
        existe = con.scalar(
            text("select 1 from pg_database where datname = :nome"), {"nome": url_teste.database}
        )
        if not existe:
            con.execute(text(f'create database "{url_teste.database}"'))
    admin.dispose()

    alembic = Config(ALEMBIC_INI)
    alembic.set_main_option("sqlalchemy.url", url_teste.render_as_string(hide_password=False))
    # Descer e subir tudo também testa o downgrade das migrações.
    command.downgrade(alembic, "base")
    command.upgrade(alembic, "head")

    engine = create_engine(url_teste)
    with engine.connect() as con:
        yield con
    engine.dispose()


@pytest.fixture
def sessao(conexao: Connection) -> Iterator[Session]:
    """Sessão dentro de uma transação desfeita no fim do teste: um teste não vê o outro."""
    transacao = conexao.begin()
    with Session(bind=conexao, join_transaction_mode="create_savepoint") as s:
        yield s
    transacao.rollback()


@pytest.fixture
def cliente(sessao: Session) -> Iterator[TestClient]:
    """Cliente HTTP da API usando a sessão do teste: enxerga o que o teste gravou."""
    app = create_app()
    app.dependency_overrides[obter_sessao] = lambda: sessao
    with TestClient(app) as c:
        yield c
