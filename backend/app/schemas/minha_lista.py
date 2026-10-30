from datetime import datetime

from pydantic import Field

from app.schemas.item import ItemResumo


class ItemAcompanhadoResumo(ItemResumo):
    preco_inclusao: float | None = Field(description="Preço quando o item entrou na lista, em USD")
    incluido_em: datetime
    variacao_desde_inclusao: float | None = Field(
        description="Preço atual contra o da inclusão, em fração (0.05 = +5%)"
    )
