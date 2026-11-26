"""Baixa da Steam o histórico completo de preços dos itens ativos e regrava a série diária.

Uso, dentro de backend/:
    uv run python -m app.coleta.historico_steam [--moeda BRL] [--intervalo 20] [--variacao 0]
        [--itens NOME ...] [--arquivo app/coleta/itens_tf2.txt] [--pendentes] [--appid 730]

Cada execução cuida de um jogo só (`--appid`, padrão TF2): para o CS2, passe `--appid 730` e a
lista app/coleta/itens_cs2.txt.

Com `--pendentes`, só os itens cuja série ainda não chega a ontem: rodar de novo no mesmo dia não
pede nada à Steam, e uma coleta interrompida (429) continua de onde parou na próxima vez. É o modo
da coleta diária agendada (scripts/coleta_diaria.ps1).

Código de saída: 0 coletou tudo (ou nada a coletar); 1 erro inesperado; 10 a Steam pediu uma pausa
(429), o resto fica para a próxima vez; 11 precisa de alguém: cookie vencido ou conta em outra
moeda. (O 2 fica com o argparse, para opção inválida.)

Serve para tapar lacunas e corrigir a série: a de cada item é trocada inteira pela que a
Steam devolve. Precisa do cookie de login em `SKINOMICS_STEAM_LOGIN_SECURE` (ver config.py);
são uma requisição por item, espaçadas pelo intervalo, e a coleta para no primeiro 429.
"""

import argparse
import logging
import sys
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import httpx2 as httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.coleta.execucao import anotar_falha, registrar_execucao
from app.coleta.gravacao import (
    ItemCatalogo,
    PrecoDia,
    gravar_itens,
    ja_no_catalogo,
    substituir_serie,
)
from app.coleta.steam import (
    CS2,
    FORMATO_DA_MOEDA,
    TF2,
    ColetaInterrompidaError,
    LimiteDaSteamError,
    MercadoSteam,
    PontoHistorico,
)
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Item, PrecoDiario, TipoColeta

log = logging.getLogger(__name__)

# Mesma precisão de preco_diario.preco.
_CASAS = Decimal("0.0001")


@dataclass
class ResumoHistorico:
    itens_ok: int = 0
    precos: int = 0
    falhas: dict[str, str] = field(default_factory=dict)
    interrompida_por: str | None = None
    interrupcao: ColetaInterrompidaError | None = None


def baixar_historico(
    sessao: Session,
    mercado: MercadoSteam,
    agora: datetime | None = None,
    somente: Sequence[str] = (),
    appid: int = TF2,
) -> ResumoHistorico:
    """Regrava a série de cada item ativo, ou só dos itens em `somente` (market_hash_name).

    Um item de `somente` que não está no catálogo é criado nele; se a Steam não tiver
    vendas dele (nome errado, por exemplo), ele sai de novo. Um item que falha sozinho é
    pulado. Se a Steam recusar a coleta toda (429, login, moeda), os itens já baixados são
    gravados e o resto fica para a próxima execução.
    """
    agora = agora or datetime.now(UTC)
    resumo = ResumoHistorico()

    with registrar_execucao(sessao, TipoColeta.PRECOS) as execucao:
        novos = _criar_os_que_faltam(sessao, somente, appid)
        consulta = select(Item).where(Item.appid == appid).order_by(Item.id)
        if somente:
            consulta = consulta.where(Item.market_hash_name.in_(somente))
        else:
            consulta = consulta.where(Item.ativo)
        itens = sessao.scalars(consulta).all()
        if not itens:
            raise ValueError("nenhum item ativo no catálogo")

        for posicao, item in enumerate(itens):
            try:
                pontos = mercado.historico(item.appid, item.market_hash_name)
            except ColetaInterrompidaError as erro:
                if not resumo.itens_ok:
                    # Nada gravado: a execução fica como falha, não como parcial.
                    raise
                resumo.interrompida_por = str(erro)
                resumo.interrupcao = erro
                resumo.falhas.update((i.market_hash_name, "não coletado") for i in itens[posicao:])
                break
            except (httpx.HTTPError, ValueError) as erro:
                resumo.falhas[item.market_hash_name] = f"{type(erro).__name__}: {erro}"
                log.warning("%s: %s", item.market_hash_name, resumo.falhas[item.market_hash_name])
                continue

            serie = serie_diaria(item.id, pontos, agora)
            if not serie:
                resumo.falhas[item.market_hash_name] = "nenhuma venda antes de hoje"
                continue
            substituir_serie(sessao, item.id, serie)
            resumo.itens_ok += 1
            resumo.precos += len(serie)
            log.info(
                "%d/%d %s: %d dias (%s a %s)",
                posicao + 1,
                len(itens),
                item.market_hash_name,
                len(serie),
                serie[0].data,
                serie[-1].data,
            )

        for item in itens:
            if item.id in novos and item.market_hash_name in resumo.falhas:
                sessao.delete(item)
                novos.discard(item.id)
        if somente and not resumo.interrompida_por:
            _buscar_icones(mercado, [i for i in itens if i.market_hash_name not in resumo.falhas])

        if not resumo.itens_ok:
            raise ValueError(f"nenhum item coletado: {resumo.falhas}")
        execucao.itens_ok = resumo.itens_ok
        execucao.itens_novos = len(novos)
        for nome, motivo in resumo.falhas.items():
            anotar_falha(execucao, appid, nome, motivo)
        execucao.erro = resumo.interrompida_por

    return resumo


def itens_pendentes(
    sessao: Session, ultimo_dia: date, nomes: Sequence[str] = (), appid: int = TF2
) -> list[str]:
    """Itens ativos (ou os de `nomes`) cuja série não chega a `ultimo_dia`, na ordem do catálogo.

    Um nome de `nomes` que ainda não está no catálogo também é pendente: a coleta o cria.
    """
    ultima_data = (
        select(PrecoDiario.item_id, func.max(PrecoDiario.data).label("ate"))
        .group_by(PrecoDiario.item_id)
        .subquery()
    )
    consulta = (
        select(Item.market_hash_name, ultima_data.c.ate)
        .outerjoin(ultima_data, ultima_data.c.item_id == Item.id)
        .where(Item.appid == appid)
        .order_by(Item.id)
    )
    consulta = (
        consulta.where(Item.market_hash_name.in_(nomes)) if nomes else consulta.where(Item.ativo)
    )
    em_dia = {
        nome for nome, ate in sessao.execute(consulta) if ate is not None and ate >= ultimo_dia
    }
    if nomes:
        return [nome for nome in dict.fromkeys(nomes) if nome not in em_dia]
    return [nome for nome, _ in sessao.execute(consulta) if nome not in em_dia]


def _buscar_icones(mercado: MercadoSteam, itens: Sequence[Item]) -> None:
    """Completa a imagem de quem entrou no catálogo pelo histórico, que não a traz.

    Sem imagem o item ainda funciona; por isso uma falha aqui não derruba a coleta.
    """
    for item in itens:
        if item.icon_url:
            continue
        try:
            item.icon_url = mercado.icone(item.appid, item.market_hash_name)
        except ColetaInterrompidaError as erro:
            log.warning("ícones interrompidos: %s", erro)
            return
        except httpx.HTTPError as erro:
            log.warning("%s: sem ícone (%s)", item.market_hash_name, erro)


def _criar_os_que_faltam(sessao: Session, nomes: Sequence[str], appid: int) -> set[int]:
    """Cria no catálogo os nomes que ainda não existem; devolve o id dos criados."""
    chaves = {(appid, nome): None for nome in nomes}  # dict: sem repetir, na ordem dada
    existentes = ja_no_catalogo(sessao, chaves)
    # Sem nome de exibição melhor à mão, usa o do mercado; o catálogo pode trocá-lo depois.
    faltando = [
        ItemCatalogo(appid, nome, nome) for _, nome in chaves if (appid, nome) not in existentes
    ]
    return set(gravar_itens(sessao, faltando).values())


def serie_diaria(item_id: int, pontos: Sequence[PontoHistorico], agora: datetime) -> list[PrecoDia]:
    """Um preço por dia, do primeiro dia com venda até ontem, no formato de tf2_historico.csv.

    O preço do dia é a média dos pontos ponderada pelo volume, e o volume é a soma. Um dia
    sem venda repete o último preço com volume 0 (`preenchido`). Hoje fica de fora porque
    a Steam ainda está fechando o dia.
    """
    hoje = agora.astimezone(UTC).date()
    por_dia: dict[date, list[PontoHistorico]] = defaultdict(list)
    for ponto in pontos:
        if ponto.momento.date() < hoje:
            por_dia[ponto.momento.date()].append(ponto)
    if not por_dia:
        return []

    serie: list[PrecoDia] = []
    dia = min(por_dia)
    while dia < hoje:
        vendas = por_dia.get(dia)
        if vendas:
            preco = _media_ponderada(vendas)
        serie.append(
            PrecoDia(
                item_id=item_id,
                data=dia,
                preco=preco,
                volume=sum(p.volume for p in vendas) if vendas else 0,
                preenchido=not vendas,
                coletado_em=agora,
            )
        )
        dia += timedelta(days=1)
    return serie


def _media_ponderada(pontos: Sequence[PontoHistorico]) -> Decimal:
    total = sum(p.volume for p in pontos)
    if total:
        media = sum(p.preco * p.volume for p in pontos) / total
    else:
        media = sum(p.preco for p in pontos) / len(pontos)
    return media.quantize(_CASAS, ROUND_HALF_UP)


def ler_lista(caminho: Path) -> list[str]:
    """Os market_hash_name de um arquivo, um por linha; ignora linhas vazias e comentários (#).

    O # só abre comentário no começo da linha ou depois de um espaço, porque há nomes com #
    no mercado (Mann Co. Supply Munition Series #91).
    """
    nomes = []
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        nome = linha.strip()
        if nome.startswith("#"):
            continue
        nome = nome.split(" # ", 1)[0].strip()
        if nome:
            nomes.append(nome)
    return nomes


def main() -> None:
    parser = argparse.ArgumentParser(description="Regrava o histórico de preços pela Steam.")
    parser.add_argument(
        "--intervalo", type=float, default=20.0, help="segundos entre requisições (padrão: 20)"
    )
    parser.add_argument(
        "--variacao",
        type=float,
        default=0.0,
        help="até quantos segundos a mais, sorteados a cada requisição (padrão: 0)",
    )
    parser.add_argument(
        "--pendentes",
        action="store_true",
        help="só os itens cuja série ainda não chega a ontem (coleta diária e retomada)",
    )
    parser.add_argument(
        "--moeda",
        choices=sorted(FORMATO_DA_MOEDA),
        default="BRL",
        help="moeda da carteira da conta do cookie (padrão: BRL, a moeda da base)",
    )
    parser.add_argument(
        "--appid",
        type=int,
        choices=(TF2, CS2),
        default=TF2,
        help=f"jogo dos itens: {TF2} (TF2, padrão) ou {CS2} (CS2)",
    )
    parser.add_argument(
        "--itens",
        nargs="+",
        default=(),
        metavar="NOME",
        help="só estes itens, pelo nome exato no mercado (os novos entram no catálogo)",
    )
    parser.add_argument(
        "--arquivo",
        type=Path,
        help="só os itens deste arquivo, um nome por linha (ex.: app/coleta/itens_tf2.txt)",
    )
    args = parser.parse_args()
    somente = [*args.itens, *(ler_lista(args.arquivo) if args.arquivo else [])]
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")

    cookie = get_settings().steam_login_secure
    if not cookie:
        parser.error("defina SKINOMICS_STEAM_LOGIN_SECURE no .env (cookie do steamcommunity.com)")

    # Cabeçalho pronto em vez de `cookies=`: o valor já vem codificado (%7C) do navegador.
    cabecalho = {"Cookie": f"steamLoginSecure={cookie}"}
    with httpx.Client(timeout=30, headers=cabecalho) as cliente, SessionLocal() as sessao:
        if args.pendentes:
            ontem = datetime.now(UTC).date() - timedelta(days=1)
            somente = itens_pendentes(sessao, ontem, somente, args.appid)
            if not somente:
                print("Nada a coletar: todos os itens já estão em dia.")
                return
            print(f"{len(somente)} itens pendentes.", flush=True)
        mercado = MercadoSteam(
            cliente, moeda=args.moeda, intervalo=args.intervalo, variacao=args.variacao
        )
        try:
            resumo = baixar_historico(sessao, mercado, somente=somente, appid=args.appid)
        except ColetaInterrompidaError as erro:
            print(f"Coleta interrompida antes do primeiro item: {erro}")
            sys.exit(_codigo_de_saida(erro))

    print(f"{resumo.itens_ok} itens e {resumo.precos} preços diários gravados.")
    for nome, motivo in resumo.falhas.items():
        print(f"  falhou ({motivo}): {nome}")
    if resumo.interrupcao:
        print(f"Coleta interrompida: {resumo.interrompida_por}")
        sys.exit(_codigo_de_saida(resumo.interrupcao))


def _codigo_de_saida(erro: ColetaInterrompidaError) -> int:
    """10: é só esperar (429); 11: alguém precisa agir (cookie vencido, conta em outra moeda)."""
    return 10 if isinstance(erro, LimiteDaSteamError) else 11


if __name__ == "__main__":
    main()
