"""Intervalos de previsão de 80%, mantendo resultados legados sem intervalo.

Revision ID: a874b9c120de
Revises: 6c9d140be321
"""

import sqlalchemy as sa
from alembic import op

revision = "a874b9c120de"
down_revision = "6c9d140be321"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("previsao", sa.Column("intervalo_inferior", sa.Numeric(20, 8)))
    op.add_column("previsao", sa.Column("intervalo_superior", sa.Numeric(20, 8)))
    op.add_column("previsao", sa.Column("nivel_confianca", sa.Numeric(3, 2)))
    op.add_column(
        "previsao",
        sa.Column("incerteza_elevada", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_check_constraint(
        "intervalo_valido",
        "previsao",
        "(intervalo_inferior IS NULL AND intervalo_superior IS NULL "
        "AND nivel_confianca IS NULL) OR "
        "(intervalo_inferior IS NOT NULL AND intervalo_superior IS NOT NULL "
        "AND nivel_confianca IS NOT NULL AND nivel_confianca = 0.8 "
        "AND intervalo_inferior > 0 AND intervalo_inferior <= preco_previsto "
        "AND intervalo_superior >= preco_previsto AND intervalo_superior < 1000000000000)",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_previsao_intervalo_valido"), "previsao", type_="check")
    for column in (
        "incerteza_elevada",
        "nivel_confianca",
        "intervalo_superior",
        "intervalo_inferior",
    ):
        op.drop_column("previsao", column)
