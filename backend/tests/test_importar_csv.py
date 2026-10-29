import csv
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.coleta.importar_csv import COLUNAS, importar_csv
from app.models import ExecucaoColeta, Item, PrecoDiario, StatusExecucao, TipoColeta

KEY = "Mann Co. Supply Crate Key"
CAIXA = "Winter 2025 Cosmetic Case"
# A coleta foi no dia 15: esse dia é parcial e não deve entrar na base.
COLETA = "2026-10-15T23:08:33.540452+00:00"


def _linha(item: str, dia: str, preco: str = "2.25", **outros: str) -> dict[str, str]:
    return {
        "scrape_timestamp_utc": COLETA,
        "appid": "440",
        "market_hash_name": item,
        "item_name": item,
        "item_type": "Level 5 Tool" if item == KEY else "",
        "icon_url": "",
        "observation_date": dia,
        "price": preco,
        "volume": "100",
        "is_filled": "0",
        **outros,
    }


def _csv(pasta: Path, linhas: list[dict[str, str]], colunas: tuple[str, ...] = COLUNAS) -> Path:
    caminho = pasta / "historico.csv"
    with caminho.open("w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=colunas, extrasaction="ignore")
        escritor.writeheader()
        escritor.writerows(linhas)
    return caminho


def _precos(sessao: Session, item: str) -> dict[date, PrecoDiario]:
    consulta = select(PrecoDiario).join(Item).where(Item.market_hash_name == item)
    return {preco.data: preco for preco in sessao.scalars(consulta)}


def _ultima_execucao(sessao: Session) -> ExecucaoColeta:
    return sessao.scalars(select(ExecucaoColeta).order_by(ExecucaoColeta.id.desc())).first()


def test_grava_itens_e_precos(sessao: Session, tmp_path: Path) -> None:
    arquivo = _csv(
        tmp_path,
        [
            _linha(KEY, "2026-10-13", "2.2500"),
            _linha(KEY, "2026-10-14", "2.3010", is_filled="1"),
            _linha(CAIXA, "2026-10-14", "0.1680"),
        ],
    )

    resumo = importar_csv(sessao, arquivo)

    assert (resumo.itens, resumo.precos) == (2, 3)
    key = sessao.scalars(select(Item).where(Item.market_hash_name == KEY)).one()
    assert (key.appid, key.nome, key.tipo) == (440, KEY, "Level 5 Tool")
    precos = _precos(sessao, KEY)
    assert precos[date(2026, 10, 14)].preco == Decimal("2.3010")
    assert precos[date(2026, 10, 14)].preenchido is True
    assert precos[date(2026, 10, 14)].coletado_em.isoformat() == "2026-10-15T23:08:33.540452+00:00"


def test_descarta_linhas_que_nao_podem_entrar_na_base(sessao: Session, tmp_path: Path) -> None:
    arquivo = _csv(
        tmp_path,
        [
            _linha(KEY, "2026-10-13"),
            _linha(KEY, "2026-10-15"),
            _linha(KEY, "2026-10-12", "0"),
            _linha(KEY, "2026-10-11", "-1"),
            _linha(KEY, "2026-10-10", "abc"),
            _linha(KEY, "2026-10-09", volume=""),
            _linha(KEY, "2026-10-08", "2.10"),
            _linha(KEY, "2026-10-08", "2.20"),
        ],
    )

    resumo = importar_csv(sessao, arquivo)

    assert resumo.descartes == {
        "dia da coleta (parcial)": 1,
        "preço ou volume inválido": 2,
        "ilegível": 2,
        "dia repetido": 1,
    }
    precos = _precos(sessao, KEY)
    assert sorted(precos) == [date(2026, 10, 8), date(2026, 10, 13)]
    assert precos[date(2026, 10, 8)].preco == Decimal("2.20")


def test_importar_de_novo_nao_duplica_e_atualiza_o_preco(sessao: Session, tmp_path: Path) -> None:
    importar_csv(sessao, _csv(tmp_path, [_linha(KEY, "2026-10-14", "2.25")]))

    importar_csv(sessao, _csv(tmp_path, [_linha(KEY, "2026-10-14", "2.40")]))

    assert sessao.scalar(select(func.count()).select_from(Item)) == 1
    assert _precos(sessao, KEY)[date(2026, 10, 14)].preco == Decimal("2.40")


def test_dado_vazio_nao_apaga_o_que_o_item_ja_tinha(sessao: Session, tmp_path: Path) -> None:
    importar_csv(sessao, _csv(tmp_path, [_linha(KEY, "2026-10-14")]))

    importar_csv(sessao, _csv(tmp_path, [_linha(KEY, "2026-10-14", item_type="")]))

    key = sessao.scalars(select(Item).where(Item.market_hash_name == KEY)).one()
    assert key.tipo == "Level 5 Tool"


def test_registra_a_importacao_no_log_de_execucoes(sessao: Session, tmp_path: Path) -> None:
    importar_csv(sessao, _csv(tmp_path, [_linha(KEY, "2026-10-14"), _linha(CAIXA, "2026-10-14")]))

    execucao = _ultima_execucao(sessao)
    assert execucao.tipo is TipoColeta.IMPORTACAO
    assert execucao.status is StatusExecucao.SUCESSO
    assert (execucao.itens_ok, execucao.itens_falha) == (2, 0)
    assert execucao.finalizada_em is not None


@pytest.mark.parametrize(
    ("colunas", "linhas", "erro"),
    [
        (COLUNAS[:-1], [_linha(KEY, "2026-10-14")], "colunas ausentes no CSV: is_filled"),
        (COLUNAS, [_linha(KEY, "2026-10-15")], "nenhuma linha válida"),
    ],
)
def test_arquivo_invalido_fica_como_falha_e_nao_grava_nada(
    sessao: Session,
    tmp_path: Path,
    colunas: tuple[str, ...],
    linhas: list[dict[str, str]],
    erro: str,
) -> None:
    with pytest.raises(ValueError, match=erro):
        importar_csv(sessao, _csv(tmp_path, linhas, colunas))

    execucao = _ultima_execucao(sessao)
    assert execucao.status is StatusExecucao.FALHA
    assert erro in execucao.erro
    assert sessao.scalar(select(func.count()).select_from(Item)) == 0
