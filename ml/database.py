"""Contrato SQL com as tabelas mantidas pelas migrações do backend."""

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

ML_DIR = Path(__file__).resolve().parent


def database_engine():
    return create_engine(
        os.environ.get(
            "SKINOMICS_DATABASE_URL",
            "postgresql+psycopg://skinomics:skinomics@localhost:55432/skinomics",
        ),
        pool_pre_ping=True,
    )


def artifact_root() -> Path:
    return Path(os.environ.get("SKINOMICS_MODEL_DIR", ML_DIR / "artifacts")).resolve()


def closed_day():
    return datetime.now(UTC).date() - timedelta(days=1)


def load_history(connection, cutoff=None):
    """Carrega todo o mercado TF2, inclusive a Key, para preservar as features globais.

    Nunca recorta somente o item consultado nem trunca o histórico das EMAs/ATH/ATL.
    Dias parciais são descartados; preserva os preenchimentos registrados pela coleta.
    """
    cutoff = cutoff or closed_day()
    data = pd.read_sql_query(
        text("""
            SELECT i.id AS item_id, i.market_hash_name, i.ativo,
                   p.data AS observation_date, p.preco AS price, p.volume,
                   p.preenchido AS is_filled, p.coletado_em AS scrape_timestamp_utc
            FROM item i JOIN preco_diario p ON p.item_id = i.id
            WHERE i.appid = 440 AND p.data <= :cutoff
              AND p.data < (p.coletado_em AT TIME ZONE 'UTC')::date
            ORDER BY i.market_hash_name, p.data
        """),
        connection,
        params={"cutoff": cutoff},
        parse_dates=["observation_date", "scrape_timestamp_utc"],
    )
    if data.empty:
        raise ValueError("O banco não contém histórico TF2 completo para previsão.")
    # A idade usa a primeira observação real do item, não o início de uma janela de consulta.
    data["days_since_first_obs"] = (
        data["observation_date"] - data.groupby("item_id")["observation_date"].transform("min")
    ).dt.days
    return data


def latest_collection(connection):
    return connection.scalar(
        text("""
        SELECT id FROM execucao_coleta
        WHERE tipo IN ('precos', 'importacao') AND status IN ('sucesso', 'parcial')
        ORDER BY finalizada_em DESC, id DESC LIMIT 1
    """)
    )
