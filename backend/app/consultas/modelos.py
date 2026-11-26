"""Modelos ativos e as métricas de teste guardadas nos metadados de cada versão."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ModeloAtivo, ModeloVersao
from app.schemas.modelo import ModeloAtivoResumo


def _numero(valor: Any) -> float | None:
    return float(valor) if type(valor) in (int, float) else None


def listar_modelos_ativos(sessao: Session) -> list[ModeloAtivoResumo]:
    consulta = (
        select(ModeloAtivo.appid, ModeloAtivo.horizonte, ModeloVersao)
        .join(ModeloVersao, ModeloVersao.id == ModeloAtivo.modelo_id)
        .order_by(ModeloAtivo.appid, ModeloAtivo.horizonte)
    )
    resumos = []
    for appid, horizonte, modelo in sessao.execute(consulta):
        metricas = (modelo.metadados or {}).get("metrics", {})
        # O teste compara vários modelos; a linha que interessa é a do modelo desta versão.
        teste = next(
            (linha for linha in metricas.get("test", []) if linha.get("model") == modelo.nome), {}
        )
        cobertura = _numero(metricas.get("interval_test", {}).get("coverage"))
        resumos.append(
            ModeloAtivoResumo(
                appid=appid,
                horizonte=horizonte,
                versao=modelo.id,
                nome=modelo.nome,
                treinado_em=(modelo.metadados or {}).get("trained_at"),
                mape_pct=_numero(teste.get("MAPE_%")),
                acerto_preco_pct=_numero(teste.get("acerto_preco_%")),
                acerto_direcao_pct=_numero(teste.get("acerto_direcao_%")),
                cobertura_intervalo=cobertura
                if cobertura is not None and 0 <= cobertura <= 1
                else None,
            )
        )
    return resumos
