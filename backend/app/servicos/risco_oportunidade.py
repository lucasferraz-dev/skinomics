"""Critérios descritivos de risco, compartilhados pela API e validação retrospectiva."""

from dataclasses import dataclass
from datetime import date, timedelta
from math import log
from statistics import pstdev
from typing import Literal

NivelRisco = Literal["baixo", "moderado", "alto"]


@dataclass(frozen=True)
class PontoRisco:
    data: date
    preco: float
    volume: int
    preenchido: bool = False


@dataclass(frozen=True)
class RiscoOportunidade:
    nivel: NivelRisco
    motivos: list[str]
    volume_medio_7d: float | None
    volatilidade_30d: float | None


def avaliar_risco(
    pontos: list[PontoRisco],
    *,
    data_base: date,
    preco_base: float,
    preco_previsto: float,
    inferior: float | None,
    superior: float | None,
    historico_curto: bool = False,
    incerteza_elevada: bool = False,
) -> RiscoOportunidade:
    """Volume por dia calendário e desvio dos log-retornos diários, sem olhar o futuro."""
    janela = sorted(
        (p for p in pontos if data_base - timedelta(days=30) <= p.data <= data_base),
        key=lambda p: p.data,
    )
    semana = [p for p in janela if p.data > data_base - timedelta(days=7)]
    volume = sum(p.volume for p in semana) / 7 if len(semana) == 7 else None
    retornos = [
        log(atual.preco / anterior.preco)
        for anterior, atual in zip(janela, janela[1:], strict=False)
        if atual.data - anterior.data == timedelta(days=1)
        and not atual.preenchido
        and not anterior.preenchido
    ]
    volatilidade = pstdev(retornos) if len(retornos) >= 14 else None
    sinais: list[tuple[int, str]] = []
    if historico_curto or volume is None or volatilidade is None:
        sinais.append((2, "Histórico insuficiente para avaliar liquidez ou volatilidade."))
    if volume is not None:
        if volume < 10:
            sinais.append((2, "Baixa liquidez: menos de 10 negociações por dia."))
        elif volume < 100:
            sinais.append((1, "Liquidez moderada: menos de 100 negociações por dia."))
    if volatilidade is not None:
        if volatilidade >= 0.10:
            sinais.append((2, "Volatilidade diária elevada: pelo menos 10%."))
        elif volatilidade >= 0.05:
            sinais.append((1, "Volatilidade diária moderada: pelo menos 5%."))
    if inferior is None or superior is None:
        sinais.append((2, "Intervalo de previsão indisponível."))
    else:
        if incerteza_elevada or (superior - inferior) / preco_previsto > 0.5:
            sinais.append((2, "Incerteza elevada: faixa ampla para a média futura."))
        if inferior <= preco_base:
            sinais.append((1, "A faixa prevista inclui preços sem valorização."))
    intensidade = max((nivel for nivel, _ in sinais), default=0)
    nivel: NivelRisco = ("baixo", "moderado", "alto")[intensidade]
    motivos = [motivo for _, motivo in sorted(sinais, key=lambda s: -s[0])]
    return RiscoOportunidade(
        nivel,
        motivos or ["Liquidez, volatilidade e intervalo dentro dos limites de referência."],
        volume,
        volatilidade,
    )
