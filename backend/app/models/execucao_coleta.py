from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.tipos import enum_texto


class TipoColeta(StrEnum):
    CATALOGO = "catalogo"
    PRECOS = "precos"
    # Carga de um histórico já coletado (CSV); fica à parte para não entrar na taxa de
    # sucesso da coleta diária.
    IMPORTACAO = "importacao"


class StatusExecucao(StrEnum):
    EM_ANDAMENTO = "em_andamento"
    SUCESSO = "sucesso"
    PARCIAL = "parcial"
    FALHA = "falha"


class ExecucaoColeta(Base):
    """Log de cada execução dos coletores (base da meta de ≥ 95% sem falha)."""

    __tablename__ = "execucao_coleta"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[TipoColeta] = mapped_column(enum_texto(TipoColeta, "tipo_coleta"))
    status: Mapped[StatusExecucao] = mapped_column(
        enum_texto(StatusExecucao, "status_execucao"),
        server_default=StatusExecucao.EM_ANDAMENTO.value,
    )
    iniciada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finalizada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    itens_ok: Mapped[int] = mapped_column(server_default="0")
    itens_falha: Mapped[int] = mapped_column(server_default="0")
    # Itens que entraram no catálogo nesta execução.
    itens_novos: Mapped[int] = mapped_column(server_default="0")
    erro: Mapped[str | None] = mapped_column(Text)

    falhas: Mapped[list["FalhaColeta"]] = relationship(
        back_populates="execucao", cascade="all, delete-orphan", order_by="FalhaColeta.id"
    )


class FalhaColeta(Base):
    """Um item que falhou numa execução, com o motivo.

    Guarda o nome, não o id do item: um item novo que falha sai do catálogo, e o registro
    da falha precisa continuar existindo.
    """

    __tablename__ = "falha_coleta"

    id: Mapped[int] = mapped_column(primary_key=True)
    execucao_id: Mapped[int] = mapped_column(
        ForeignKey("execucao_coleta.id", ondelete="CASCADE"), index=True
    )
    appid: Mapped[int]
    market_hash_name: Mapped[str] = mapped_column(String(255))
    motivo: Mapped[str] = mapped_column(Text)

    execucao: Mapped[ExecucaoColeta] = relationship(back_populates="falhas")
