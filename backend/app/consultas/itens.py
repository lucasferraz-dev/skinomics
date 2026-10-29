from collections.abc import Sequence
from datetime import date

from sqlalchemy import Row, Subquery, func, or_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session, aliased

from app.models import Item, PrecoDiario
from app.schemas.item import Direcao, FiltrosItens, Ordenacao

JANELA_DIAS = 7


def _resumo_dos_itens() -> Subquery:
    """Uma linha por item: catálogo + último preço, variação e volume da última semana.

    A semana é contada a partir do último dia com preço de cada item, não de hoje:
    assim um item com a coleta atrasada não aparece com variação vazia.
    """
    ultimo = (
        select(PrecoDiario.item_id, PrecoDiario.data, PrecoDiario.preco)
        # DISTINCT ON + ORDER BY data desc: só a linha mais recente de cada item.
        .ext(distinct_on(PrecoDiario.item_id))
        .order_by(PrecoDiario.item_id, PrecoDiario.data.desc())
        .subquery("ultimo")
    )

    anterior = aliased(PrecoDiario)
    preco_uma_semana_antes = (
        select(anterior.preco)
        .where(
            anterior.item_id == ultimo.c.item_id,
            anterior.data <= ultimo.c.data - JANELA_DIAS,
        )
        .order_by(anterior.data.desc())
        .limit(1)
        .scalar_subquery()
    )

    semana = aliased(PrecoDiario)
    volume_da_semana = (
        select(func.sum(semana.volume))
        .where(
            semana.item_id == ultimo.c.item_id,
            semana.data > ultimo.c.data - JANELA_DIAS,
        )
        .scalar_subquery()
    )

    return (
        select(
            Item.id,
            Item.appid,
            Item.market_hash_name,
            Item.nome,
            Item.tipo,
            Item.icon_url,
            ultimo.c.preco.label("preco_atual"),
            ultimo.c.data.label("data_preco"),
            (ultimo.c.preco / preco_uma_semana_antes - 1).label("variacao_7d"),
            volume_da_semana.label("volume_7d"),
        )
        # outer join: item recém-catalogado, ainda sem preço, também aparece.
        .outerjoin(ultimo, ultimo.c.item_id == Item.id)
        .subquery("resumo")
    )


def listar_itens(sessao: Session, filtros: FiltrosItens) -> tuple[Sequence[Row], int]:
    """Devolve a página pedida e o total de itens que passam nos filtros."""
    resumo = _resumo_dos_itens()
    consulta = select(resumo)

    if filtros.busca:
        consulta = consulta.where(
            or_(
                resumo.c.nome.icontains(filtros.busca, autoescape=True),
                resumo.c.market_hash_name.icontains(filtros.busca, autoescape=True),
            )
        )
    if filtros.tipo:
        consulta = consulta.where(resumo.c.tipo == filtros.tipo)
    if filtros.preco_min is not None:
        consulta = consulta.where(resumo.c.preco_atual >= filtros.preco_min)
    if filtros.preco_max is not None:
        consulta = consulta.where(resumo.c.preco_atual <= filtros.preco_max)

    total = sessao.scalar(select(func.count()).select_from(consulta.subquery()))

    coluna = {
        Ordenacao.NOME: resumo.c.nome,
        Ordenacao.PRECO: resumo.c.preco_atual,
        Ordenacao.VARIACAO_7D: resumo.c.variacao_7d,
        Ordenacao.VOLUME_7D: resumo.c.volume_7d,
    }[filtros.ordenar]
    ordem = coluna.desc() if filtros.direcao is Direcao.DESC else coluna.asc()

    pagina = sessao.execute(
        consulta
        # Itens sem o dado vão para o fim; o id desempata para a paginação não repetir itens.
        .order_by(ordem.nulls_last(), resumo.c.id)
        .limit(filtros.por_pagina)
        .offset((filtros.pagina - 1) * filtros.por_pagina)
    ).all()

    return pagina, total


def buscar_item(sessao: Session, item_id: int) -> Row | None:
    resumo = _resumo_dos_itens()
    return sessao.execute(select(resumo).where(resumo.c.id == item_id)).one_or_none()


def historico_do_item(
    sessao: Session, item_id: int, inicio: date | None, fim: date | None
) -> Sequence[PrecoDiario]:
    consulta = select(PrecoDiario).where(PrecoDiario.item_id == item_id)
    if inicio:
        consulta = consulta.where(PrecoDiario.data >= inicio)
    if fim:
        consulta = consulta.where(PrecoDiario.data <= fim)
    return sessao.scalars(consulta.order_by(PrecoDiario.data)).all()
