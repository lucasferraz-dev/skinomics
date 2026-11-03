"""Acrescenta ao catálogo os itens populares do mercado de TF2 acima de um preço mínimo.

Uso, dentro de backend/:
    uv run python -m app.coleta.catalogo_steam [--itens 300] [--preco-minimo 1.00]

Percorre a busca do mercado dos mais populares para os menos (10 itens por requisição) e
grava os que custam pelo menos o preço mínimo. Não precisa de login. O histórico de preços
dos itens novos vem depois, com `app.coleta.historico_steam`.
"""

import argparse
import logging
from dataclasses import dataclass, field
from decimal import Decimal

import httpx2 as httpx
from sqlalchemy.orm import Session

from app.coleta.execucao import registrar_execucao
from app.coleta.gravacao import ItemCatalogo, gravar_itens
from app.coleta.steam import (
    ITENS_POR_PAGINA,
    TF2,
    ColetaInterrompidaError,
    ItemAnunciado,
    MercadoSteam,
)
from app.db.session import SessionLocal
from app.models import TipoColeta

log = logging.getLogger(__name__)


@dataclass
class ResumoCatalogo:
    vistos: int = 0
    gravados: list[ItemAnunciado] = field(default_factory=list)
    interrompida_por: str | None = None


def atualizar_catalogo(
    sessao: Session, mercado: MercadoSteam, itens: int, preco_minimo: Decimal
) -> ResumoCatalogo:
    """Grava os itens acima do preço mínimo; num 429, fica com as páginas já lidas."""
    resumo = ResumoCatalogo()

    with registrar_execucao(sessao, TipoColeta.CATALOGO) as execucao:
        for inicio in range(0, itens, ITENS_POR_PAGINA):
            try:
                pagina = mercado.catalogo(TF2, inicio)
            except ColetaInterrompidaError as erro:
                if not resumo.vistos:
                    raise
                resumo.interrompida_por = str(erro)
                break
            if not pagina:
                break
            resumo.vistos += len(pagina)
            resumo.gravados += [i for i in pagina if i.menor_preco_usd >= preco_minimo]
            log.info("%d itens lidos, %d acima do mínimo", resumo.vistos, len(resumo.gravados))

        gravar_itens(
            sessao,
            # dict: a popularidade muda durante a varredura e um item pode vir em duas páginas.
            {
                i.market_hash_name: ItemCatalogo(
                    appid=TF2,
                    market_hash_name=i.market_hash_name,
                    nome=i.nome,
                    tipo=i.tipo,
                    icon_url=i.icon_url,
                )
                for i in resumo.gravados
            }.values(),
        )
        execucao.itens_ok = len(resumo.gravados)
        execucao.erro = resumo.interrompida_por

    return resumo


def main() -> None:
    parser = argparse.ArgumentParser(description="Acrescenta itens populares de TF2 ao catálogo.")
    parser.add_argument("--itens", type=int, default=300, help="quantos itens varrer (padrão: 300)")
    parser.add_argument(
        "--preco-minimo", type=Decimal, default=Decimal("1.00"), help="em USD (padrão: 1.00)"
    )
    parser.add_argument(
        "--intervalo", type=float, default=20.0, help="segundos entre requisições (padrão: 20)"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")

    with httpx.Client(timeout=30) as cliente, SessionLocal() as sessao:
        mercado = MercadoSteam(cliente, intervalo=args.intervalo)
        resumo = atualizar_catalogo(sessao, mercado, args.itens, args.preco_minimo)

    print(f"{resumo.vistos} itens lidos, {len(resumo.gravados)} gravados no catálogo:")
    for item in sorted(resumo.gravados, key=lambda i: -i.menor_preco_usd):
        print(f"  US$ {item.menor_preco_usd:>8}  {item.anuncios:>6} anúncios  {item.nome}")
    if resumo.interrompida_por:
        print(f"Varredura interrompida: {resumo.interrompida_por}")


if __name__ == "__main__":
    main()
