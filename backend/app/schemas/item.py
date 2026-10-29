from datetime import date
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Preços saem como float: no JSON, um Decimal viraria texto ("2.2500") para o front-end.
# No banco eles continuam exatos (NUMERIC).


class Ordenacao(StrEnum):
    NOME = "nome"
    PRECO = "preco"
    VARIACAO_7D = "variacao_7d"
    VOLUME_7D = "volume_7d"


class Direcao(StrEnum):
    ASC = "asc"
    DESC = "desc"


class FiltrosItens(BaseModel):
    model_config = ConfigDict(extra="forbid")

    busca: str | None = Field(None, description="Parte do nome, sem diferenciar maiúsculas")
    tipo: str | None = Field(None, description='Tipo exato, ex.: "Level 1 Tool"')
    preco_min: float | None = Field(None, ge=0)
    preco_max: float | None = Field(None, ge=0)
    ordenar: Ordenacao = Ordenacao.NOME
    direcao: Direcao = Direcao.ASC
    pagina: int = Field(1, ge=1)
    por_pagina: int = Field(20, ge=1, le=100)

    @model_validator(mode="after")
    def _faixa_de_preco_valida(self) -> Self:
        sem_faixa = self.preco_min is None or self.preco_max is None
        if not sem_faixa and self.preco_min > self.preco_max:
            raise ValueError("preco_min não pode ser maior que preco_max")
        return self


class ItemResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    appid: int
    market_hash_name: str
    nome: str
    tipo: str | None
    icon_url: str | None
    # Os campos abaixo ficam nulos enquanto o item não tem preço coletado.
    preco_atual: float | None = Field(description="Último preço diário, em USD")
    data_preco: date | None = Field(description="Dia do último preço")
    variacao_7d: float | None = Field(
        description="Variação contra 7 dias antes, em fração (0.05 = +5%)"
    )
    volume_7d: int | None = Field(description="Unidades negociadas nos últimos 7 dias")


class PaginaItens(BaseModel):
    itens: list[ItemResumo]
    total: int
    pagina: int
    por_pagina: int


class PontoHistorico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    data: date
    preco: float
    volume: int
    preenchido: bool = Field(description="Dia sem negociação, repetindo o último preço")
