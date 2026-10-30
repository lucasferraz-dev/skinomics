from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ItemAcompanhado(Base):
    """Watchlist: um item que o usuário acompanha."""

    __tablename__ = "item_acompanhado"

    # A chave dupla é o que impede o mesmo item duas vezes na lista.
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id"), primary_key=True)
    # Preço do item quando entrou na lista: base da "variação desde a inclusão".
    # Nulo se o item ainda não tinha preço coletado.
    preco_inclusao: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    incluido_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
