from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.alerta import CondicaoAlerta
from app.schemas.item import ItemResumo

# Teto do preço-alvo: bem acima do item mais caro do mercado, só para barrar erro de digitação.
PRECO_MAXIMO = 100_000

EstadoAlerta = Literal["aguardando", "disparado", "pausado"]


class NovoAlerta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: int
    condicao: CondicaoAlerta
    preco_alvo: float = Field(gt=0, le=PRECO_MAXIMO, description="Em USD")


class MudancaAlerta(BaseModel):
    """Trocar o alvo ou reativar um alerta disparado o arma de novo; `ativo` pausa e retoma."""

    model_config = ConfigDict(extra="forbid")

    preco_alvo: float | None = Field(None, gt=0, le=PRECO_MAXIMO)
    ativo: bool | None = None


class AlertaResumo(BaseModel):
    id: int
    item: ItemResumo
    condicao: CondicaoAlerta
    preco_alvo: float
    preco_criacao: float | None = Field(
        description="Preço quando o alerta foi criado ou rearmado, base do quanto falta"
    )
    estado: EstadoAlerta
    criado_em: datetime
    disparado_em: datetime | None
    preco_disparo: float | None
    data_preco_disparo: date | None = Field(description="Dia do preço que disparou o alerta")
    visto: bool = Field(description="Falso enquanto o aviso do disparo está no sino")
