from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TipoColeta(StrEnum):
    CATALOGO = "catalogo"
    PRECOS = "precos"


class StatusExecucao(StrEnum):
    EM_ANDAMENTO = "em_andamento"
    SUCESSO = "sucesso"
    PARCIAL = "parcial"
    FALHA = "falha"


def _enum_texto(enum: type[StrEnum], nome: str) -> Enum:
    # Guarda o valor como texto + CHECK, em vez de um ENUM nativo do Postgres,
    # que é difícil de alterar em migrações.
    return Enum(
        enum,
        name=nome,
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda membros: [m.value for m in membros],
    )


class ExecucaoColeta(Base):
    """Log de cada execução dos coletores (base da meta de ≥ 95% sem falha)."""

    __tablename__ = "execucao_coleta"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[TipoColeta] = mapped_column(_enum_texto(TipoColeta, "tipo_coleta"))
    status: Mapped[StatusExecucao] = mapped_column(
        _enum_texto(StatusExecucao, "status_execucao"),
        server_default=StatusExecucao.EM_ANDAMENTO.value,
    )
    iniciada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finalizada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    itens_ok: Mapped[int] = mapped_column(server_default="0")
    itens_falha: Mapped[int] = mapped_column(server_default="0")
    erro: Mapped[str | None] = mapped_column(Text)
