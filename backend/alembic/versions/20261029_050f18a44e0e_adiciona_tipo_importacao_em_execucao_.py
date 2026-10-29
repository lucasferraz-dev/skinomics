"""adiciona tipo importacao em execucao_coleta

Revision ID: 050f18a44e0e
Revises: 78a81f87a76a
Create Date: 2026-10-29 13:53:04.494354
"""

from collections.abc import Sequence

from alembic import op

revision: str = "050f18a44e0e"
down_revision: str | Sequence[str] | None = "78a81f87a76a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CONSTRAINT = "ck_execucao_coleta_tipo_coleta"


def _trocar_tipos_aceitos(tipos: Sequence[str]) -> None:
    # O tipo é texto + CHECK (não um ENUM nativo), então basta recriar o CHECK.
    lista = ", ".join(f"'{tipo}'" for tipo in tipos)
    # op.f(): o nome já está completo; sem ele o Alembic aplicaria a convenção de nomes de novo.
    op.drop_constraint(op.f(CONSTRAINT), "execucao_coleta", type_="check")
    op.create_check_constraint(op.f(CONSTRAINT), "execucao_coleta", f"tipo in ({lista})")


def upgrade() -> None:
    _trocar_tipos_aceitos(["catalogo", "precos", "importacao"])


def downgrade() -> None:
    # Sem o tipo, as execuções de importação não teriam como ficar no log.
    op.execute("delete from execucao_coleta where tipo = 'importacao'")
    _trocar_tipos_aceitos(["catalogo", "precos"])
