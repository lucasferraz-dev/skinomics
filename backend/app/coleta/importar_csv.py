"""Importa para a base um histórico de preços já coletado, no formato de `tf2_historico.csv`.

Uso: `uv run python -m app.coleta.importar_csv <arquivo.csv>`
"""

import argparse
import csv
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy.orm import Session

from app.coleta.execucao import registrar_execucao
from app.coleta.gravacao import ItemCatalogo, PrecoDia, gravar_itens, gravar_precos
from app.db.session import SessionLocal
from app.models import TipoColeta

COLUNAS = (
    "scrape_timestamp_utc",
    "appid",
    "market_hash_name",
    "item_name",
    "item_type",
    "icon_url",
    "observation_date",
    "price",
    "volume",
    "is_filled",
)


@dataclass(frozen=True)
class _Linha:
    item: ItemCatalogo
    data: date
    preco: Decimal
    volume: int
    preenchido: bool
    coletado_em: datetime


@dataclass
class ResumoImportacao:
    itens: int = 0
    precos: int = 0
    descartes: Counter[str] = field(default_factory=Counter)


def importar_csv(sessao: Session, caminho: Path) -> ResumoImportacao:
    """Grava os itens e os preços do arquivo; importar o mesmo arquivo de novo não duplica nada."""
    with registrar_execucao(sessao, TipoColeta.IMPORTACAO) as execucao:
        linhas, descartes = _ler(caminho)
        if not linhas:
            raise ValueError(f"nenhuma linha válida em {caminho}")

        # Um item por chave: o mesmo item duas vezes no INSERT faria o ON CONFLICT falhar.
        itens = {(linha.item.appid, linha.item.market_hash_name): linha.item for linha in linhas}
        ids = gravar_itens(sessao, itens.values())
        gravar_precos(
            sessao,
            [
                PrecoDia(
                    item_id=ids[(linha.item.appid, linha.item.market_hash_name)],
                    data=linha.data,
                    preco=linha.preco,
                    volume=linha.volume,
                    preenchido=linha.preenchido,
                    coletado_em=linha.coletado_em,
                )
                for linha in linhas
            ],
        )
        execucao.itens_ok = len(ids)

    return ResumoImportacao(itens=len(ids), precos=len(linhas), descartes=descartes)


def _ler(caminho: Path) -> tuple[list[_Linha], Counter[str]]:
    descartes: Counter[str] = Counter()
    # Chave (item, dia): se o arquivo repetir um dia, vale a última linha.
    linhas: dict[tuple[int, str, date], _Linha] = {}

    with caminho.open(encoding="utf-8", newline="") as arquivo:
        leitor = csv.DictReader(arquivo)
        faltando = [coluna for coluna in COLUNAS if coluna not in (leitor.fieldnames or [])]
        if faltando:
            raise ValueError(f"colunas ausentes no CSV: {', '.join(faltando)}")

        for registro in leitor:
            try:
                linha = _converter(registro)
            # TypeError: linha com menos colunas que o cabeçalho (o csv completa com None).
            except (ValueError, TypeError, InvalidOperation):
                descartes["ilegível"] += 1
                continue

            if linha.preco <= 0 or linha.volume < 0:
                descartes["preço ou volume inválido"] += 1
            elif linha.data >= linha.coletado_em.date():
                # A Steam ainda está fechando o dia da coleta: o preço dele é parcial.
                descartes["dia da coleta (parcial)"] += 1
            else:
                chave = (linha.item.appid, linha.item.market_hash_name, linha.data)
                if chave in linhas:
                    descartes["dia repetido"] += 1
                linhas[chave] = linha

    return list(linhas.values()), descartes


def _converter(registro: dict[str, str]) -> _Linha:
    preco = Decimal(registro["price"])
    if not preco.is_finite():
        raise ValueError(f"preço não numérico: {registro['price']!r}")

    return _Linha(
        item=ItemCatalogo(
            appid=int(registro["appid"]),
            market_hash_name=registro["market_hash_name"],
            nome=registro["item_name"] or registro["market_hash_name"],
            tipo=registro["item_type"] or None,
            icon_url=registro["icon_url"] or None,
        ),
        data=date.fromisoformat(registro["observation_date"]),
        preco=preco,
        volume=int(registro["volume"]),
        preenchido=registro["is_filled"] == "1",
        coletado_em=datetime.fromisoformat(registro["scrape_timestamp_utc"]),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa um histórico de preços em CSV.")
    parser.add_argument("arquivo", type=Path, help="CSV no formato de tf2_historico.csv")
    args = parser.parse_args()

    with SessionLocal() as sessao:
        resumo = importar_csv(sessao, args.arquivo)

    print(f"{resumo.itens} itens e {resumo.precos} preços diários gravados.")
    for motivo, quantidade in resumo.descartes.most_common():
        print(f"  descartadas ({motivo}): {quantidade}")


if __name__ == "__main__":
    main()
