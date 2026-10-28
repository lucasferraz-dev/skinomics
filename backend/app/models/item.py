from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Item(Base):
    """Catálogo: um item negociável do mercado da Steam."""

    __tablename__ = "item"
    __table_args__ = (UniqueConstraint("appid", "market_hash_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    appid: Mapped[int]
    # Identificador do item na Steam (é o nome usado nas URLs do mercado).
    market_hash_name: Mapped[str] = mapped_column(String(255))
    nome: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[str | None] = mapped_column(String(100))
    qualidade: Mapped[str | None] = mapped_column(String(100))
    raridade: Mapped[str | None] = mapped_column(String(100))
    colecao: Mapped[str | None] = mapped_column(String(255))
    icon_url: Mapped[str | None] = mapped_column(String(500))
    # Item inativo não é mais coletado, mas o histórico dele continua no banco.
    ativo: Mapped[bool] = mapped_column(server_default=true())
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
