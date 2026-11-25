from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.tipos import enum_texto


class CondicaoAlerta(StrEnum):
    # Para quem quer comprar: avisa quando o preço cair até o alvo.
    ABAIXO = "abaixo"
    # Para quem quer vender: avisa quando o preço subir até o alvo.
    ACIMA = "acima"


class Alerta(Base):
    """Alerta de preço de um usuário, conferido depois de cada coleta diária.

    Dispara uma vez só: depois de disparado, fica parado até o usuário reativar (o que pede um
    alvo que ainda não foi atingido). `visto_em` é o que apaga o aviso do sino no header.
    """

    __tablename__ = "alerta"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("item.id"))
    condicao: Mapped[CondicaoAlerta] = mapped_column(enum_texto(CondicaoAlerta, "condicao_alerta"))
    preco_alvo: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    # Preço de quando o alerta foi criado (ou reativado): base do "quanto falta" na tela.
    preco_criacao: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    # Pausado é ativo = False: não dispara, mas fica guardado.
    ativo: Mapped[bool] = mapped_column(server_default="true")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    disparado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    preco_disparo: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    data_preco_disparo: Mapped[date | None] = mapped_column(Date)
    visto_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
