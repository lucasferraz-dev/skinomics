"""cria usuario e sessao_login

Revision ID: 2a1b8fef8283
Revises: 050f18a44e0e
Create Date: 2026-10-30 13:40:04.878050
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2a1b8fef8283"
down_revision: str | Sequence[str] | None = "050f18a44e0e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("steam_id", sa.BigInteger(), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "ultimo_login_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usuario")),
        sa.UniqueConstraint("steam_id", name=op.f("uq_usuario_steam_id")),
    )
    op.create_table(
        "sessao_login",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "criada_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_sessao_login_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessao_login")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sessao_login_token_hash")),
    )
    op.create_index(
        op.f("ix_sessao_login_usuario_id"), "sessao_login", ["usuario_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_sessao_login_usuario_id"), table_name="sessao_login")
    op.drop_table("sessao_login")
    op.drop_table("usuario")
