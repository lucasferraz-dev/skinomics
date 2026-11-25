"""cria alerta

Revision ID: 5b3e0c7d9a41
Revises: fd4f7e211d7f
Create Date: 2026-11-26 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5b3e0c7d9a41"
down_revision: str | Sequence[str] | None = "fd4f7e211d7f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alerta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column(
            "condicao",
            sa.Enum(
                "abaixo",
                "acima",
                name="condicao_alerta",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("preco_alvo", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("preco_criacao", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("ativo", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("disparado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("preco_disparo", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("data_preco_disparo", sa.Date(), nullable=True),
        sa.Column("visto_em", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["item_id"], ["item.id"], name=op.f("fk_alerta_item_id_item")),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_alerta_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_alerta")),
    )
    op.create_index(op.f("ix_alerta_usuario_id"), "alerta", ["usuario_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_alerta_usuario_id"), table_name="alerta")
    op.drop_table("alerta")
