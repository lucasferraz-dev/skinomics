"""cria item_acompanhado

Revision ID: 22771a43d31a
Revises: 2a1b8fef8283
Create Date: 2026-10-30 16:47:59.104500
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "22771a43d31a"
down_revision: str | Sequence[str] | None = "2a1b8fef8283"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "item_acompanhado",
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("preco_inclusao", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column(
            "incluido_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["item.id"], name=op.f("fk_item_acompanhado_item_id_item")
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_item_acompanhado_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("usuario_id", "item_id", name=op.f("pk_item_acompanhado")),
    )


def downgrade() -> None:
    op.drop_table("item_acompanhado")
