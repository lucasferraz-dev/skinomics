from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Item, PrecoDiario

# Linhas por comando: mantém cada INSERT bem abaixo do limite de parâmetros do Postgres.
TAMANHO_DO_LOTE = 5_000


@dataclass(frozen=True)
class ItemCatalogo:
    appid: int
    market_hash_name: str
    nome: str
    tipo: str | None = None
    icon_url: str | None = None


@dataclass(frozen=True)
class PrecoDia:
    item_id: int
    data: date
    preco: Decimal
    volume: int
    preenchido: bool
    coletado_em: datetime


def gravar_itens(sessao: Session, itens: Iterable[ItemCatalogo]) -> dict[tuple[int, str], int]:
    """Cria os itens novos e atualiza os existentes; devolve o id de cada (appid, nome)."""
    valores = [asdict(item) for item in itens]
    if not valores:
        return {}

    comando = insert(Item).values(valores)
    comando = comando.on_conflict_do_update(
        index_elements=[Item.appid, Item.market_hash_name],
        set_={
            "nome": comando.excluded.nome,
            # Um dado vazio na fonte não apaga o que já se sabia do item.
            "tipo": func.coalesce(comando.excluded.tipo, Item.tipo),
            "icon_url": func.coalesce(comando.excluded.icon_url, Item.icon_url),
            "atualizado_em": func.now(),
        },
    ).returning(Item.appid, Item.market_hash_name, Item.id)

    return {(appid, nome): id_ for appid, nome, id_ in sessao.execute(comando)}


def gravar_precos(sessao: Session, precos: Sequence[PrecoDia]) -> None:
    """Grava a série diária; um dia que já existe é sobrescrito pelo dado mais novo."""
    comando = insert(PrecoDiario)
    comando = comando.on_conflict_do_update(
        index_elements=[PrecoDiario.item_id, PrecoDiario.data],
        set_={
            "preco": comando.excluded.preco,
            "volume": comando.excluded.volume,
            "preenchido": comando.excluded.preenchido,
            "coletado_em": comando.excluded.coletado_em,
        },
    )
    for inicio in range(0, len(precos), TAMANHO_DO_LOTE):
        lote = precos[inicio : inicio + TAMANHO_DO_LOTE]
        sessao.execute(comando, [asdict(preco) for preco in lote])
