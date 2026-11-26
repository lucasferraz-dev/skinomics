"""modelo por jogo

Cada jogo (appid) tem os seus modelos e o seu modelo ativo por horizonte: o do CS2 não pode
substituir o do TF2. Os registros que já existem são do TF2 (440).

Revision ID: 8c41d2e6f0a3
Revises: 5b3e0c7d9a41
Create Date: 2026-11-26 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8c41d2e6f0a3"
down_revision: str | Sequence[str] | None = "5b3e0c7d9a41"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABELAS = ("modelo_versao", "modelo_ativo", "ativacao_modelo")


def upgrade() -> None:
    for tabela in TABELAS:
        op.add_column(
            tabela, sa.Column("appid", sa.Integer(), server_default="440", nullable=False)
        )
    op.drop_constraint("pk_modelo_ativo", "modelo_ativo", type_="primary")
    op.create_primary_key("pk_modelo_ativo", "modelo_ativo", ["appid", "horizonte"])
    op.drop_index("ix_ativacao_modelo_horizonte", table_name="ativacao_modelo")
    op.create_index("ix_ativacao_modelo_appid_horizonte", "ativacao_modelo", ["appid", "horizonte"])


def downgrade() -> None:
    # Volta a um modelo ativo por horizonte: só dá se houver modelos de um jogo só.
    op.execute("DELETE FROM modelo_ativo WHERE appid <> 440")
    op.drop_index("ix_ativacao_modelo_appid_horizonte", table_name="ativacao_modelo")
    op.create_index("ix_ativacao_modelo_horizonte", "ativacao_modelo", ["horizonte"])
    op.drop_constraint("pk_modelo_ativo", "modelo_ativo", type_="primary")
    op.create_primary_key("pk_modelo_ativo", "modelo_ativo", ["horizonte"])
    for tabela in TABELAS:
        op.drop_column(tabela, "appid")
