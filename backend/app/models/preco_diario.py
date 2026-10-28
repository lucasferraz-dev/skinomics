from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PrecoDiario(Base):
    """Série histórica: preço e volume de um item em um dia (preços em USD)."""

    __tablename__ = "preco_diario"
    __table_args__ = (
        CheckConstraint("preco > 0", name="preco_positivo"),
        CheckConstraint("volume >= 0", name="volume_nao_negativo"),
    )

    # A chave (item_id, data) é o que impede duplicatas na série.
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id"), primary_key=True)
    data: Mapped[date] = mapped_column(primary_key=True, index=True)
    preco: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    volume: Mapped[int]
    # Dia sem negociação, preenchido com o último preço conhecido (o is_filled do CSV).
    preenchido: Mapped[bool]
    coletado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
