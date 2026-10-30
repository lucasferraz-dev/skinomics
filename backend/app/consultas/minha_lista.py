from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy import Row, delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.consultas.itens import resumo_dos_itens
from app.models import ItemAcompanhado

# Teto por usuário: a lista é para acompanhar de perto, não para copiar o catálogo inteiro.
LIMITE_ITENS = 100


class ListaCheiaError(Exception):
    pass


def listar(sessao: Session, usuario_id: int) -> Sequence[Row]:
    """Itens da lista com o resumo de mercado, os mais recentes primeiro."""
    resumo = resumo_dos_itens()
    return sessao.execute(
        select(
            resumo,
            ItemAcompanhado.preco_inclusao,
            ItemAcompanhado.incluido_em,
            (resumo.c.preco_atual / ItemAcompanhado.preco_inclusao - 1).label(
                "variacao_desde_inclusao"
            ),
        )
        .join(ItemAcompanhado, ItemAcompanhado.item_id == resumo.c.id)
        .where(ItemAcompanhado.usuario_id == usuario_id)
        .order_by(ItemAcompanhado.incluido_em.desc(), resumo.c.id)
    ).all()


def adicionar(sessao: Session, usuario_id: int, item_id: int, preco_atual: Decimal | None) -> None:
    """Adicionar de novo um item que já está na lista não muda nada, nem o preço de inclusão."""
    ja_esta = sessao.get(ItemAcompanhado, (usuario_id, item_id)) is not None
    if not ja_esta:
        quantidade = sessao.scalar(
            select(func.count()).where(ItemAcompanhado.usuario_id == usuario_id)
        )
        if quantidade >= LIMITE_ITENS:
            raise ListaCheiaError
    # ON CONFLICT: dois cliques simultâneos não viram erro de chave duplicada.
    sessao.execute(
        insert(ItemAcompanhado)
        .values(usuario_id=usuario_id, item_id=item_id, preco_inclusao=preco_atual)
        .on_conflict_do_nothing()
    )
    sessao.commit()


def remover(sessao: Session, usuario_id: int, item_id: int) -> None:
    sessao.execute(
        delete(ItemAcompanhado).where(
            ItemAcompanhado.usuario_id == usuario_id, ItemAcompanhado.item_id == item_id
        )
    )
    sessao.commit()
