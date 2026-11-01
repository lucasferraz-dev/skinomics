from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ModeloAtivo, ModeloVersao, PrecoDiario, Previsao
from app.schemas.previsao import PrevisaoItem


def buscar_previsao(sessao: Session, item_id: int, horizonte: int) -> PrevisaoItem:
    modelo = sessao.scalar(
        select(ModeloVersao)
        .join(ModeloAtivo, ModeloAtivo.modelo_id == ModeloVersao.id)
        .where(ModeloAtivo.horizonte == horizonte, ModeloVersao.horizonte == horizonte)
    )
    resposta = PrevisaoItem(item_id=item_id, horizonte=horizonte, disponivel=False)
    if modelo is None:
        resposta.motivo = "sem_modelo_ativo"
        return resposta
    resposta.modelo_versao = modelo.id
    resposta.modelo_nome = modelo.nome
    previsao = sessao.scalar(
        select(Previsao)
        .where(Previsao.item_id == item_id, Previsao.modelo_id == modelo.id)
        .order_by(Previsao.data_base.desc())
        .limit(1)
    )
    if previsao is None:
        resposta.motivo = "aguardando_previsao"
        return resposta
    hoje = datetime.now(UTC).date()
    ultimo_preco = sessao.scalar(
        select(func.max(PrecoDiario.data)).where(
            PrecoDiario.item_id == item_id, PrecoDiario.data < hoje
        )
    )
    resposta.disponivel = True
    resposta.data_base = previsao.data_base
    resposta.data_alvo = previsao.data_base + timedelta(days=horizonte)
    resposta.janela_inicio = resposta.data_alvo - timedelta(days=modelo.meia_janela)
    resposta.janela_fim = resposta.data_alvo + timedelta(days=modelo.meia_janela)
    resposta.preco_base = float(previsao.preco_base)
    resposta.preco_previsto = float(previsao.preco_previsto)
    if previsao.nivel_confianca is not None:
        resposta.intervalo_inferior = float(previsao.intervalo_inferior)
        resposta.intervalo_superior = float(previsao.intervalo_superior)
        resposta.nivel_confianca = float(previsao.nivel_confianca)
        cobertura = modelo.metadados.get("metrics", {}).get("interval_test", {}).get("coverage")
        if type(cobertura) in (int, float) and 0 <= cobertura <= 1:
            resposta.cobertura_teste = cobertura
    resposta.incerteza_elevada = previsao.incerteza_elevada or previsao.historico_curto
    resposta.variacao_prevista = float(previsao.preco_previsto / previsao.preco_base - 1)
    resposta.historico_curto = previsao.historico_curto
    resposta.desatualizada = previsao.data_base < hoje - timedelta(days=1) or (
        ultimo_preco is not None and previsao.data_base < ultimo_preco
    )
    resposta.gerada_em = previsao.gerada_em
    return resposta
