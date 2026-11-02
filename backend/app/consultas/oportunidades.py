from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import Date, cast, func, or_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from app.models import Item, ModeloAtivo, ModeloVersao, PrecoDiario, Previsao
from app.schemas.oportunidade import Oportunidade, RankingOportunidades
from app.schemas.previsao import HorizontePrevisao
from app.servicos.risco_oportunidade import PontoRisco, avaliar_risco


def listar_oportunidades(
    sessao: Session, horizonte: HorizontePrevisao, pagina: int, por_pagina: int
) -> RankingOportunidades:
    ontem = datetime.now(UTC).date() - timedelta(days=1)
    resposta = RankingOportunidades(
        itens=[], horizonte=horizonte, pagina=pagina, por_pagina=por_pagina
    )
    modelo = sessao.scalar(
        select(ModeloVersao)
        .join(ModeloAtivo, ModeloAtivo.modelo_id == ModeloVersao.id)
        .where(ModeloAtivo.horizonte == horizonte, ModeloVersao.horizonte == horizonte)
    )
    if modelo is None:
        resposta.motivo = "sem_modelo_ativo"
        return resposta
    resposta.modelo_versao = modelo.id
    # Só dias completos, inclusive no instante da coleta. Uma linha por item evita duplicatas.
    dia_coleta = cast(func.timezone("UTC", PrecoDiario.coletado_em), Date)
    ultimo = (
        select(PrecoDiario.item_id, PrecoDiario.data, PrecoDiario.preco)
        .where(PrecoDiario.data <= ontem, PrecoDiario.data < dia_coleta)
        .ext(distinct_on(PrecoDiario.item_id))
        .order_by(PrecoDiario.item_id, PrecoDiario.data.desc())
        .subquery()
    )
    catalogo = (
        select(Item.id)
        .join(ultimo, ultimo.c.item_id == Item.id)
        .where(Item.ativo.is_(True), Item.appid == 440)
    )
    total_catalogo = sessao.scalar(select(func.count()).select_from(catalogo.subquery())) or 0
    margem = (Previsao.preco_previsto / ultimo.c.preco - 1).label("margem")
    compativeis = (
        select(Item, Previsao, margem)
        .join(ultimo, ultimo.c.item_id == Item.id)
        .join(
            Previsao,
            (Previsao.item_id == Item.id)
            & (Previsao.modelo_id == modelo.id)
            & (Previsao.data_base == ultimo.c.data),
        )
        .where(
            Item.ativo.is_(True),
            Item.appid == 440,
            func.abs(Previsao.preco_base - ultimo.c.preco) <= Decimal("0.00000001"),
        )
    )
    quantidade = sessao.scalar(select(func.count()).select_from(compativeis.subquery())) or 0
    resposta.itens_sem_previsao_compativel = total_catalogo - quantidade
    if not quantidade:
        resposta.motivo = "aguardando_previsoes"
        return resposta
    consulta = compativeis.where(Previsao.preco_previsto > ultimo.c.preco)
    resumo = consulta.subquery()
    total, primeira_data, ultima_data, antigos = sessao.execute(
        select(
            func.count(),
            func.min(resumo.c.data_base),
            func.max(resumo.c.data_base),
            func.count().filter(resumo.c.data_base < ontem),
        ).select_from(resumo)
    ).one()
    resposta.total = total
    resposta.itens_desatualizados = antigos
    resposta.data_base = primeira_data if primeira_data == ultima_data else None
    if not resposta.total:
        resposta.motivo = "sem_margem_positiva"
        return resposta
    linhas = sessao.execute(
        consulta.order_by(margem.desc(), Item.id)
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
    ).all()
    historicos: dict[int, list[PontoRisco]] = defaultdict(list)
    if linhas:
        # Consulta única da janela de risco dos itens da página; sem consulta por linha.
        pontos = sessao.scalars(
            select(PrecoDiario).where(
                or_(
                    *[
                        (PrecoDiario.item_id == item.id)
                        & PrecoDiario.data.between(
                            previsao.data_base - timedelta(days=30), previsao.data_base
                        )
                        for item, previsao, _ in linhas
                    ]
                ),
                PrecoDiario.data < dia_coleta,
            )
        )
        for p in pontos:
            historicos[p.item_id].append(PontoRisco(p.data, float(p.preco), p.volume, p.preenchido))
    for posicao, (item, previsao, margem_item) in enumerate(
        linhas, start=(pagina - 1) * por_pagina + 1
    ):
        risco = avaliar_risco(
            historicos[item.id],
            data_base=previsao.data_base,
            preco_base=float(previsao.preco_base),
            preco_previsto=float(previsao.preco_previsto),
            inferior=float(previsao.intervalo_inferior)
            if previsao.intervalo_inferior is not None
            else None,
            superior=float(previsao.intervalo_superior)
            if previsao.intervalo_superior is not None
            else None,
            historico_curto=previsao.historico_curto,
            incerteza_elevada=previsao.incerteza_elevada,
        )
        alvo = previsao.data_base + timedelta(days=horizonte)
        resposta.itens.append(
            Oportunidade(
                posicao=posicao,
                item_id=item.id,
                nome=item.nome,
                tipo=item.tipo,
                icon_url=item.icon_url,
                preco_atual=float(previsao.preco_base),
                preco_previsto=float(previsao.preco_previsto),
                margem_estimada=float(margem_item),
                diferenca_estimada=float(previsao.preco_previsto - previsao.preco_base),
                risco=risco.nivel,
                motivos_risco=risco.motivos,
                volume_medio_7d=risco.volume_medio_7d,
                volatilidade_30d=risco.volatilidade_30d,
                data_base=previsao.data_base,
                desatualizada=previsao.data_base < ontem,
                data_alvo=alvo,
                janela_inicio=alvo - timedelta(days=modelo.meia_janela),
                janela_fim=alvo + timedelta(days=modelo.meia_janela),
                gerada_em=previsao.gerada_em,
            )
        )
    return resposta
