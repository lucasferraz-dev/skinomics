"""Leitura do mercado da Steam (steamcommunity.com/market).

A Steam não documenta o limite de requisições. Passar dele dá HTTP 429 e bloqueia o IP por
algumas horas, e o bloqueio se estende se o cliente insistir. Por isso o cliente espera um
intervalo fixo entre as chamadas e, no 429, desiste em vez de tentar de novo.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

import httpx2 as httpx

TF2 = 440

_HISTORICO = "https://steamcommunity.com/market/pricehistory/"
_BUSCA = "https://steamcommunity.com/market/search/render/"
_IMAGENS = "https://community.cloudflare.steamstatic.com/economy/image/"
# A busca ignora `count` maior que 10, com ou sem login.
ITENS_POR_PAGINA = 10


class ColetaInterrompidaError(Exception):
    """A Steam recusou a coleta inteira, não só um item: não adianta seguir para o próximo."""


class LimiteDaSteamError(ColetaInterrompidaError):
    """HTTP 429: o IP passou do limite de requisições."""


class LoginSteamError(ColetaInterrompidaError):
    """O cookie steamLoginSecure está ausente, vencido ou é de outro domínio."""


class MoedaInesperadaError(ColetaInterrompidaError):
    """A conta do cookie está em outra moeda: o histórico vem sempre na moeda da carteira."""


# Prefixo e sufixo com que a Steam formata cada moeda. Os cifrões de outras moedas têm
# prefixo próprio (CDN$, A$...), então o par identifica a moeda sem ambiguidade.
FORMATO_DA_MOEDA = {"BRL": ("R$", ""), "USD": ("$", "")}


@dataclass(frozen=True)
class PontoHistorico:
    momento: datetime
    preco: Decimal
    volume: int


@dataclass(frozen=True)
class ItemAnunciado:
    """Um item como aparece na busca do mercado, com o menor anúncio de venda."""

    market_hash_name: str
    nome: str
    tipo: str | None
    icon_url: str | None
    menor_preco_usd: Decimal
    anuncios: int


class MercadoSteam:
    def __init__(
        self,
        cliente: httpx.Client,
        moeda: str = "BRL",
        intervalo: float = 20.0,
        esperar: Callable[[float], None] = time.sleep,
    ) -> None:
        self._cliente = cliente
        self._moeda = moeda
        self._intervalo = intervalo
        self._esperar = esperar
        self._primeira = True

    def historico(self, appid: int, market_hash_name: str) -> list[PontoHistorico]:
        """Histórico completo de vendas do item.

        A Steam devolve um ponto por dia para o passado e um por hora para o último mês;
        cada ponto é o preço mediano das vendas no período e quantas unidades foram vendidas.
        Precisa do cookie de login no cliente. Os preços vêm na moeda da carteira da conta,
        com o histórico inteiro convertido pelo câmbio do dia (o parâmetro `currency` não
        muda isso), e cada moeda tem o seu piso: em USD, nada fica abaixo de US$ 0,03.
        """
        corpo = self._get(_HISTORICO, {"appid": appid, "market_hash_name": market_hash_name})
        formato = (corpo.get("price_prefix", "").strip(), corpo.get("price_suffix", "").strip())
        if formato != FORMATO_DA_MOEDA[self._moeda]:
            raise MoedaInesperadaError(f"esperava {self._moeda}, a conta está em {formato}")
        return [_ponto(*registro) for registro in corpo.get("prices") or []]

    def catalogo(self, appid: int, inicio: int) -> list[ItemAnunciado]:
        """Uma página da busca do mercado, dos itens mais populares para os menos.

        Não precisa de login. O preço é o menor anúncio de venda em USD (`currency=1`, que
        aqui funciona), não o de uma venda feita.
        """
        corpo = self._get(
            _BUSCA,
            {
                "norender": 1,
                "appid": appid,
                "start": inicio,
                "count": ITENS_POR_PAGINA,
                "sort_column": "popular",
                "sort_dir": "desc",
                "currency": 1,
            },
        )
        return [_anunciado(resultado) for resultado in corpo.get("results") or []]

    def _get(self, url: str, parametros: dict[str, str | int]) -> dict:
        if not self._primeira:
            self._esperar(self._intervalo)
        self._primeira = False

        resposta = self._cliente.get(url, params=parametros)
        if resposta.status_code == 429:
            raise LimiteDaSteamError("HTTP 429: limite de requisições da Steam")
        # Sem login válido o histórico responde 400 com uma lista vazia.
        if resposta.status_code == 400 and resposta.text.strip() == "[]":
            raise LoginSteamError("a Steam não reconheceu o cookie steamLoginSecure")
        resposta.raise_for_status()

        corpo = resposta.json()
        if not isinstance(corpo, dict) or not corpo.get("success"):
            raise ValueError(f"resposta sem sucesso: {resposta.url}")
        return corpo


def _ponto(momento: str, preco: float, volume: str) -> PontoHistorico:
    # Formato da Steam: "Nov 03 2026 16: +0" (hora cheia, em UTC).
    return PontoHistorico(
        momento=datetime.strptime(momento[:14], "%b %d %Y %H").replace(tzinfo=UTC),
        # str() primeiro: o float 2.159 viraria 2.15899999... no Decimal.
        preco=Decimal(str(preco)),
        volume=int(volume),
    )


def _anunciado(resultado: dict) -> ItemAnunciado:
    descricao = resultado.get("asset_description") or {}
    icone = descricao.get("icon_url")
    return ItemAnunciado(
        market_hash_name=resultado["hash_name"],
        nome=resultado.get("name") or resultado["hash_name"],
        tipo=descricao.get("type") or None,
        icon_url=f"{_IMAGENS}{icone}" if icone else None,
        # sell_price vem em centavos.
        menor_preco_usd=Decimal(resultado["sell_price"]) / 100,
        anuncios=int(resultado["sell_listings"]),
    )
