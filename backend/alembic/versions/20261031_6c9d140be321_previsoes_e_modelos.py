"""Versões de modelos, ativação e previsões em lote.

Revision ID: 6c9d140be321
Revises: 22771a43d31a
"""

import sqlalchemy as sa
from alembic import op

revision = "6c9d140be321"
down_revision = "22771a43d31a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "modelo_versao",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("nome", sa.String(100), nullable=False),
        sa.Column("horizonte", sa.Integer(), nullable=False),
        sa.Column("meia_janela", sa.Integer(), nullable=False),
        sa.Column("artefato", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False, unique=True),
        sa.Column("metadados", sa.JSON(), nullable=False),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("horizonte > 0", name="horizonte_positivo"),
        sa.CheckConstraint("meia_janela >= 0 AND meia_janela < horizonte", name="janela_valida"),
    )
    op.create_table(
        "modelo_ativo",
        sa.Column("horizonte", sa.Integer(), primary_key=True),
        sa.Column("modelo_id", sa.String(36), sa.ForeignKey("modelo_versao.id"), nullable=False),
    )
    op.create_table(
        "ativacao_modelo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("horizonte", sa.Integer(), nullable=False, index=True),
        sa.Column("modelo_id", sa.String(36), sa.ForeignKey("modelo_versao.id"), nullable=False),
        sa.Column("anterior_id", sa.String(36), sa.ForeignKey("modelo_versao.id")),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column(
            "criada_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "execucao_previsao",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("modelo_id", sa.String(36), sa.ForeignKey("modelo_versao.id"), nullable=False),
        sa.Column("coleta_id", sa.Integer(), sa.ForeignKey("execucao_coleta.id")),
        sa.Column("data_limite", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), server_default="em_andamento", nullable=False),
        sa.Column("itens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("erro", sa.Text()),
        sa.Column(
            "iniciada_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("finalizada_em", sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('em_andamento', 'sucesso', 'falha')", name="status_valido"),
    )
    op.create_index("ix_execucao_previsao_modelo_id", "execucao_previsao", ["modelo_id"])
    op.create_table(
        "previsao",
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("item.id"), primary_key=True),
        sa.Column("modelo_id", sa.String(36), sa.ForeignKey("modelo_versao.id"), primary_key=True),
        sa.Column("data_base", sa.Date(), primary_key=True),
        sa.Column("preco_base", sa.Numeric(20, 8), nullable=False),
        sa.Column("preco_previsto", sa.Numeric(20, 8), nullable=False),
        sa.Column("historico_curto", sa.Boolean(), nullable=False),
        sa.Column(
            "execucao_id", sa.String(36), sa.ForeignKey("execucao_previsao.id"), nullable=False
        ),
        sa.Column(
            "gerada_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("preco_base > 0 AND preco_previsto > 0", name="precos_positivos"),
    )


def downgrade() -> None:
    for tabela in (
        "previsao",
        "execucao_previsao",
        "ativacao_modelo",
        "modelo_ativo",
        "modelo_versao",
    ):
        op.drop_table(tabela)
