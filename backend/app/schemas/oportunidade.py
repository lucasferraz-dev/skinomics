from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.previsao import HorizontePrevisao
from app.servicos.risco_oportunidade import NivelRisco


class Oportunidade(BaseModel):
    posicao: int
    item_id: int
    nome: str
    tipo: str | None
    icon_url: str | None
    preco_atual: float = Field(description="Preço disponível na data-base, que pode ser histórica.")
    preco_previsto: float
    margem_estimada: float = Field(description="Margem bruta como fração: 0.10 = 10%; sem taxas.")
    diferenca_estimada: float = Field(description="Preço previsto menos preço-base, em USD.")
    risco: NivelRisco
    motivos_risco: list[str]
    volume_medio_7d: float | None
    volatilidade_30d: float | None = Field(
        description="Desvio dos log-retornos diários, sem anualizar."
    )
    data_base: date
    desatualizada: bool = Field(description="Data-base anterior a ontem em UTC.")
    data_alvo: date
    janela_inicio: date
    janela_fim: date
    gerada_em: datetime


class RankingOportunidades(BaseModel):
    itens: list[Oportunidade]
    horizonte: HorizontePrevisao
    moeda: Literal["USD"] = "USD"
    total: int = 0
    pagina: int
    por_pagina: int
    modelo_versao: str | None = None
    data_base: date | None = None
    itens_sem_previsao_compativel: int = 0
    itens_desatualizados: int = 0
    motivo: Literal["sem_modelo_ativo", "aguardando_previsoes", "sem_margem_positiva"] | None = None
