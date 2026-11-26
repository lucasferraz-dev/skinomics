"""Coleta o catálogo e o histórico de preços de TF2 direto do Mercado da Comunidade Steam.

Uso: `uv run python -m app.coleta.steam_mercado --itens 1000`

O histórico (`/market/pricehistory`) só responde a uma sessão logada: o valor do cookie
`steamLoginSecure` vem de `SKINOMICS_STEAM_LOGIN_SECURE`. Prefira uma conta secundária, pois
o cookie dá acesso à conta. A Steam devolve os preços na moeda da carteira dessa conta; a
coleta para se ela não for a esperada (`--moeda`), para não misturar moedas na base.

A Steam bloqueia o IP por um tempo (HTTP 429) quando recebe pedidos demais. Por isso há um
intervalo fixo entre os pedidos e, ao receber 429, a coleta espera e tenta de novo.
"""

import argparse
import time
from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

import httpx2 as httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.coleta.execucao import registrar_execucao
from app.coleta.gravacao import ItemCatalogo, PrecoDia, gravar_itens, gravar_precos
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Item, TipoColeta

APPID_TF2 = 440
_BUSCA = "https://steamcommunity.com/market/search/render/"
_HISTORICO = "https://steamcommunity.com/market/pricehistory/"
_IMAGENS = "https://community.cloudflare.steamstatic.com/economy/image/"
_MESES = {
    mes: numero
    for numero, mes in enumerate(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        start=1,
    )
}
_ESPERAS_429 = (60, 120, 240)
# Falhas seguidas que indicam um problema geral (sessão expirada, IP bloqueado), não do item.
_MAXIMO_FALHAS_SEGUIDAS = 10
_QUATRO_CASAS = Decimal("0.0001")


class MoedaInesperadaError(Exception):
    """A conta logada devolve preços numa moeda diferente da usada na base."""


@dataclass(frozen=True)
class PontoHistorico:
    instante: datetime
    preco: Decimal
    volume: int


def ler_instante(texto: str) -> datetime:
    """Converte o formato da Steam, como `"Oct 14 2026 01: +0"`, sempre em UTC."""
    mes, dia, ano, hora = texto.split()[:4]
    return datetime(int(ano), _MESES[mes], int(dia), int(hora.rstrip(":")), tzinfo=UTC)


def ler_pontos(precos: list[list]) -> list[PontoHistorico]:
    return [
        PontoHistorico(
            instante=ler_instante(instante),
            preco=Decimal(str(preco)),
            volume=int(str(volume).replace(",", "")),
        )
        for instante, preco, volume in precos
    ]


def agregar_por_dia(
    item_id: int, pontos: list[PontoHistorico], hoje: date, coletado_em: datetime
) -> list[PrecoDia]:
    """Uma linha por dia, do primeiro ponto até ontem.

    O preço do dia é a média dos pontos ponderada pelo volume (a Steam dá um ponto por hora
    no último mês e um por dia antes disso). Dias sem venda repetem o último preço, com
    volume 0 e `preenchido`. O dia de hoje fica de fora porque ainda está aberto.
    """
    dias: dict[date, list[PontoHistorico]] = defaultdict(list)
    for ponto in pontos:
        if ponto.instante.date() < hoje:
            dias[ponto.instante.date()].append(ponto)
    if not dias:
        return []

    linhas: list[PrecoDia] = []
    dia, ultimo_preco = min(dias), Decimal(0)
    while dia < hoje:
        pontos_do_dia = dias.get(dia)
        if pontos_do_dia:
            volume = sum(ponto.volume for ponto in pontos_do_dia)
            if volume > 0:
                soma = sum(ponto.preco * ponto.volume for ponto in pontos_do_dia)
                ultimo_preco = (soma / volume).quantize(_QUATRO_CASAS, ROUND_HALF_UP)
            else:
                ultimo_preco = pontos_do_dia[-1].preco
            linhas.append(PrecoDia(item_id, dia, ultimo_preco, volume, False, coletado_em))
        else:
            linhas.append(PrecoDia(item_id, dia, ultimo_preco, 0, True, coletado_em))
        dia += timedelta(days=1)
    return linhas


class ClienteMercado:
    """Faz os pedidos à Steam respeitando o intervalo mínimo entre eles."""

    def __init__(self, cliente: httpx.Client, intervalo: float) -> None:
        self._cliente = cliente
        self._intervalo = intervalo
        self._ultimo_pedido = 0.0

    def obter(self, url: str, parametros: dict[str, str | int]) -> dict:
        esperas = list(_ESPERAS_429)
        while True:
            pausa = self._ultimo_pedido + self._intervalo - time.monotonic()
            if pausa > 0:
                time.sleep(pausa)
            self._ultimo_pedido = time.monotonic()

            resposta = self._cliente.get(url, params=parametros)
            if resposta.status_code == 429 and esperas:
                espera = esperas.pop(0)
                print(
                    f"  Steam pediu para esperar (429); tentando de novo em {espera} s", flush=True
                )
                time.sleep(espera)
                continue
            resposta.raise_for_status()
            dados = resposta.json()
            # Sem sessão válida, o histórico responde uma lista vazia em vez do objeto.
            if not isinstance(dados, dict):
                raise ValueError("resposta inesperada da Steam (sessão expirada?)")
            return dados

    def catalogo(self, quantidade: int) -> Iterator[ItemCatalogo]:
        """Itens de TF2 em ordem de popularidade (mais vendidos primeiro)."""
        inicio = 0
        while inicio < quantidade:
            dados = self.obter(
                _BUSCA,
                {
                    "appid": APPID_TF2,
                    "norender": 1,
                    "start": inicio,
                    "count": min(100, quantidade - inicio),
                    "sort_column": "popular",
                    "sort_dir": "desc",
                    "search_descriptions": 0,
                },
            )
            resultados = dados.get("results") or []
            if not resultados:
                return
            for resultado in resultados:
                descricao = resultado.get("asset_description") or {}
                icone = descricao.get("icon_url")
                yield ItemCatalogo(
                    appid=APPID_TF2,
                    market_hash_name=resultado["hash_name"],
                    nome=resultado.get("name") or resultado["hash_name"],
                    tipo=descricao.get("type") or None,
                    icon_url=f"{_IMAGENS}{icone}" if icone else None,
                )
            inicio += len(resultados)

    def historico(self, market_hash_name: str, moeda: str) -> list[PontoHistorico]:
        dados = self.obter(_HISTORICO, {"appid": APPID_TF2, "market_hash_name": market_hash_name})
        if not dados.get("success"):
            raise ValueError("a Steam não devolveu o histórico (sessão expirada?)")
        moeda_recebida = (dados.get("price_prefix") or dados.get("price_suffix") or "").strip()
        if moeda_recebida != moeda:
            raise MoedaInesperadaError(
                f"a conta devolve preços em {moeda_recebida!r}, mas a base usa {moeda!r}"
            )
        return ler_pontos(dados.get("prices") or [])


def coletar(sessao: Session, cliente: ClienteMercado, quantidade: int, moeda: str) -> None:
    """Atualiza os itens já acompanhados e acrescenta os mais populares até `quantidade`.

    Cada item é confirmado no banco assim que termina: numa coleta de uma hora, uma queda
    no meio não perde o que já foi gravado.
    """
    with registrar_execucao(sessao, TipoColeta.PRECOS) as execucao:
        existentes = [
            ItemCatalogo(item.appid, item.market_hash_name, item.nome, item.tipo, item.icon_url)
            for item in sessao.scalars(
                select(Item).where(Item.appid == APPID_TF2, Item.ativo).order_by(Item.id)
            )
        ]
        conhecidos = {item.market_hash_name for item in existentes}
        novos = []
        if quantidade > 0:
            print(f"Buscando os {quantidade} itens mais populares de TF2…", flush=True)
            novos = [
                i for i in cliente.catalogo(quantidade) if i.market_hash_name not in conhecidos
            ]
        itens = existentes + novos
        print(f"{len(existentes)} itens já na base + {len(novos)} novos", flush=True)

        falhas_seguidas = 0
        for posicao, item in enumerate(itens, start=1):
            prefixo = f"[{posicao}/{len(itens)}] {item.market_hash_name}"
            try:
                pontos = cliente.historico(item.market_hash_name, moeda)
            except (httpx.HTTPError, ValueError, KeyError) as erro:
                execucao.itens_falha += 1
                falhas_seguidas += 1
                print(f"{prefixo}: falhou ({erro})", flush=True)
                if falhas_seguidas >= _MAXIMO_FALHAS_SEGUIDAS:
                    raise RuntimeError(
                        f"{falhas_seguidas} falhas seguidas; coleta interrompida"
                    ) from erro
                continue

            falhas_seguidas = 0
            agora = datetime.now(UTC)
            item_id = gravar_itens(sessao, [item])[(item.appid, item.market_hash_name)]
            dias = agregar_por_dia(item_id, pontos, agora.date(), agora)
            gravar_precos(sessao, dias)
            execucao.itens_ok += 1
            sessao.commit()
            ultimo = f"{dias[-1].data}: {moeda} {dias[-1].preco}" if dias else "sem vendas"
            print(f"{prefixo}: {len(dias)} dias ({ultimo})", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Coleta preços de TF2 no Mercado da Steam.")
    parser.add_argument(
        "--itens",
        type=int,
        default=0,
        help="quantos itens populares considerar, além dos que já estão na base (padrão: 0)",
    )
    parser.add_argument(
        "--intervalo", type=float, default=4.0, help="segundos entre pedidos (padrão: 4)"
    )
    parser.add_argument(
        "--moeda", default="$", help="símbolo da moeda esperada na conta (padrão: $, dólar)"
    )
    args = parser.parse_args()

    cookie = get_settings().steam_login_secure
    if not cookie:
        parser.error("defina SKINOMICS_STEAM_LOGIN_SECURE com o cookie steamLoginSecure")

    with (
        httpx.Client(
            timeout=30,
            cookies={"steamLoginSecure": cookie},
            headers={"User-Agent": "Mozilla/5.0 (skinomics)"},
        ) as http,
        SessionLocal() as sessao,
    ):
        coletar(sessao, ClienteMercado(http, args.intervalo), args.itens, args.moeda)


if __name__ == "__main__":
    main()
