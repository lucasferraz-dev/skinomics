"""cria item, preco_diario e execucao_coleta

Revision ID: 78a81f87a76a
Revises:
Create Date: 2026-10-28 16:49:52.023969
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "78a81f87a76a"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "execucao_coleta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum(
                "catalogo",
                "precos",
                name="tipo_coleta",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "em_andamento",
                "sucesso",
                "parcial",
                "falha",
                name="status_execucao",
                native_enum=False,
                create_constraint=True,
                length=20,
            ),
            server_default="em_andamento",
            nullable=False,
        ),
        sa.Column(
            "iniciada_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finalizada_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("itens_ok", sa.Integer(), server_default="0", nullable=False),
        sa.Column("itens_falha", sa.Integer(), server_default="0", nullable=False),
        sa.Column("erro", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_execucao_coleta")),
    )
    op.create_table(
        "item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("appid", sa.Integer(), nullable=False),
        sa.Column("market_hash_name", sa.String(length=255), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("tipo", sa.String(length=100), nullable=True),
        sa.Column("qualidade", sa.String(length=100), nullable=True),
        sa.Column("raridade", sa.String(length=100), nullable=True),
        sa.Column("colecao", sa.String(length=255), nullable=True),
        sa.Column("icon_url", sa.String(length=500), nullable=True),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_item")),
        sa.UniqueConstraint(
            "appid", "market_hash_name", name=op.f("uq_item_appid_market_hash_name")
        ),
    )
    op.create_table(
        "preco_diario",
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("preco", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("volume", sa.Integer(), nullable=False),
        sa.Column("preenchido", sa.Boolean(), nullable=False),
        sa.Column(
            "coletado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("preco > 0", name=op.f("ck_preco_diario_preco_positivo")),
        sa.CheckConstraint("volume >= 0", name=op.f("ck_preco_diario_volume_nao_negativo")),
        sa.ForeignKeyConstraint(
            ["item_id"], ["item.id"], name=op.f("fk_preco_diario_item_id_item")
        ),
        sa.PrimaryKeyConstraint("item_id", "data", name=op.f("pk_preco_diario")),
    )
    op.create_index(op.f("ix_preco_diario_data"), "preco_diario", ["data"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_preco_diario_data"), table_name="preco_diario")
    op.drop_table("preco_diario")
    op.drop_table("item")
    op.drop_table("execucao_coleta")
