"""registra itens novos e falhas por item da coleta

Revision ID: fd4f7e211d7f
Revises: a874b9c120de
Create Date: 2026-11-04 15:11:27.545571
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "fd4f7e211d7f"
down_revision: str | Sequence[str] | None = "a874b9c120de"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "execucao_coleta",
        sa.Column("itens_novos", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_table(
        "falha_coleta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("execucao_id", sa.Integer(), nullable=False),
        sa.Column("appid", sa.Integer(), nullable=False),
        sa.Column("market_hash_name", sa.String(length=255), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["execucao_id"],
            ["execucao_coleta.id"],
            name=op.f("fk_falha_coleta_execucao_id_execucao_coleta"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_falha_coleta")),
    )
    op.create_index(
        op.f("ix_falha_coleta_execucao_id"), "falha_coleta", ["execucao_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_falha_coleta_execucao_id"), table_name="falha_coleta")
    op.drop_table("falha_coleta")
    op.drop_column("execucao_coleta", "itens_novos")
