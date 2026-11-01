"""Registro de modelos, publicação por horizonte e resultados de inferência."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ModeloVersao(Base):
    __tablename__ = "modelo_versao"
    __table_args__ = (
        CheckConstraint("horizonte > 0", name="horizonte_positivo"),
        CheckConstraint("meia_janela >= 0 AND meia_janela < horizonte", name="janela_valida"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    nome: Mapped[str] = mapped_column(String(100))
    horizonte: Mapped[int]
    meia_janela: Mapped[int]
    artefato: Mapped[str] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    metadados: Mapped[dict] = mapped_column(JSON)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModeloAtivo(Base):
    __tablename__ = "modelo_ativo"

    horizonte: Mapped[int] = mapped_column(primary_key=True)
    modelo_id: Mapped[str] = mapped_column(ForeignKey("modelo_versao.id"))


class AtivacaoModelo(Base):
    __tablename__ = "ativacao_modelo"

    id: Mapped[int] = mapped_column(primary_key=True)
    horizonte: Mapped[int] = mapped_column(index=True)
    modelo_id: Mapped[str] = mapped_column(ForeignKey("modelo_versao.id"))
    anterior_id: Mapped[str | None] = mapped_column(ForeignKey("modelo_versao.id"))
    motivo: Mapped[str] = mapped_column(Text)
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExecucaoPrevisao(Base):
    __tablename__ = "execucao_previsao"
    __table_args__ = (
        CheckConstraint("status IN ('em_andamento', 'sucesso', 'falha')", name="status_valido"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    modelo_id: Mapped[str] = mapped_column(ForeignKey("modelo_versao.id"), index=True)
    coleta_id: Mapped[int | None] = mapped_column(ForeignKey("execucao_coleta.id"))
    data_limite: Mapped[date]
    status: Mapped[str] = mapped_column(String(20), server_default="em_andamento")
    itens: Mapped[int] = mapped_column(server_default="0")
    erro: Mapped[str | None] = mapped_column(Text)
    iniciada_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finalizada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Previsao(Base):
    __tablename__ = "previsao"
    __table_args__ = (
        CheckConstraint("preco_base > 0 AND preco_previsto > 0", name="precos_positivos"),
    )

    item_id: Mapped[int] = mapped_column(ForeignKey("item.id"), primary_key=True)
    modelo_id: Mapped[str] = mapped_column(ForeignKey("modelo_versao.id"), primary_key=True)
    data_base: Mapped[date] = mapped_column(primary_key=True)
    preco_base: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    preco_previsto: Mapped[Decimal] = mapped_column(Numeric(20, 8))
    historico_curto: Mapped[bool]
    execucao_id: Mapped[str] = mapped_column(ForeignKey("execucao_previsao.id"))
    gerada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
