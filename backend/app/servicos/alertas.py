"""Checagem dos alertas de preço, rodada logo depois de cada coleta diária.

    uv run python -m app.servicos.alertas

Os preços mudam uma vez por dia, então não adianta checar mais vezes do que a coleta roda. Cada
alerta dispara uma vez só: o disparado fica marcado e sai da checagem até o usuário reativar.
"""

import logging
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.consultas.itens import resumo_dos_itens
from app.db.session import SessionLocal
from app.models import Alerta
from app.models.alerta import CondicaoAlerta

log = logging.getLogger(__name__)


def verificar_alertas(sessao: Session, agora: datetime | None = None) -> Sequence[Alerta]:
    """Dispara os alertas ativos cujo item chegou ao alvo no último preço. Devolve os disparados."""
    agora = agora or datetime.now(UTC)
    resumo = resumo_dos_itens()
    preco = resumo.c.preco_atual
    atingidos = sessao.execute(
        select(Alerta, preco, resumo.c.data_preco)
        .join(resumo, resumo.c.id == Alerta.item_id)
        .where(
            Alerta.ativo,
            Alerta.disparado_em.is_(None),
            preco.is_not(None),
            or_(
                and_(Alerta.condicao == CondicaoAlerta.ABAIXO, preco <= Alerta.preco_alvo),
                and_(Alerta.condicao == CondicaoAlerta.ACIMA, preco >= Alerta.preco_alvo),
            ),
        )
    ).all()

    disparados = []
    for alerta, preco_atual, data_preco in atingidos:
        alerta.disparado_em = agora
        alerta.preco_disparo = preco_atual
        alerta.data_preco_disparo = data_preco
        disparados.append(alerta)
    sessao.commit()
    return disparados


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
    with SessionLocal() as sessao:
        disparados = verificar_alertas(sessao)
    print(f"{len(disparados)} alertas disparados.")


if __name__ == "__main__":
    main()
