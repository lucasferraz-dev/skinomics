from datetime import date, datetime
from enum import IntEnum
from typing import Literal

from pydantic import BaseModel, Field


class HorizontePrevisao(IntEnum):
    SEMANA = 7
    QUINZENA = 15
    MES = 30


class PrevisaoItem(BaseModel):
    item_id: int
    horizonte: HorizontePrevisao
    disponivel: bool
    motivo: Literal["sem_modelo_ativo", "aguardando_previsao"] | None = None
    modelo_versao: str | None = None
    modelo_nome: str | None = None
    moeda: Literal["USD"] = "USD"
    data_base: date | None = None
    data_alvo: date | None = None
    janela_inicio: date | None = None
    janela_fim: date | None = None
    preco_base: float | None = None
    preco_previsto: float | None = None
    intervalo_inferior: float | None = None
    intervalo_superior: float | None = None
    nivel_confianca: Literal[0.8] | None = Field(
        default=None, description="Cobertura nominal da faixa da média futura; não é garantia."
    )
    incerteza_elevada: bool = False
    cobertura_teste: float | None = Field(
        default=None, ge=0, le=1, description="Cobertura observada no teste temporal do modelo."
    )
    # Fração, como nas demais variações da API: 0.10 = 10%.
    variacao_prevista: float | None = None
    historico_curto: bool = False
    desatualizada: bool = False
    gerada_em: datetime | None = None
