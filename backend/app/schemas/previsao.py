from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class PrevisaoItem(BaseModel):
    item_id: int
    horizonte: int
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
    # Fração, como nas demais variações da API: 0.10 = 10%.
    variacao_prevista: float | None = None
    historico_curto: bool = False
    desatualizada: bool = False
    gerada_em: datetime | None = None
