from decimal import Decimal

import httpx2 as httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.coleta.catalogo_steam import atualizar_catalogo
from app.coleta.steam import LimiteDaSteamError, MercadoSteam
from app.models import ExecucaoColeta, Item, StatusExecucao


def _resultado(nome: str, centavos: int, tipo: str = "Level 5 Tool") -> dict:
    return {
        "name": nome,
        "hash_name": nome,
        "sell_listings": 120,
        "sell_price": centavos,
        "asset_description": {"type": tipo, "icon_url": "abc123"},
    }


def _pagina(*resultados: dict) -> httpx.Response:
    return httpx.Response(200, json={"success": True, "results": list(resultados)})


def _mercado(respostas: list[httpx.Response], pedidos: list | None = None) -> MercadoSteam:
    fila = iter(respostas)

    def steam(pedido: httpx.Request) -> httpx.Response:
        if pedidos is not None:
            pedidos.append(pedido)
        return next(fila)

    cliente = httpx.Client(transport=httpx.MockTransport(steam))
    return MercadoSteam(cliente, esperar=lambda _: None)


def _itens(sessao: Session) -> dict[str, Item]:
    return {i.market_hash_name: i for i in sessao.scalars(select(Item))}


def test_grava_so_os_itens_acima_do_preco_minimo(sessao: Session) -> None:
    pedidos: list[httpx.Request] = []
    mercado = _mercado(
        [
            _pagina(_resultado("Mann Co. Supply Crate Key", 216), _resultado("Caixa", 3)),
            _pagina(_resultado("Name Tag", 100, tipo="")),
        ],
        pedidos,
    )

    resumo = atualizar_catalogo(sessao, mercado, itens=20, preco_minimo=Decimal("1.00"))

    assert resumo.vistos == 3
    itens = _itens(sessao)
    assert sorted(itens) == ["Mann Co. Supply Crate Key", "Name Tag"]
    key = itens["Mann Co. Supply Crate Key"]
    assert (key.appid, key.tipo) == (440, "Level 5 Tool")
    assert key.icon_url == "https://community.cloudflare.steamstatic.com/economy/image/abc123"
    assert itens["Name Tag"].tipo is None
    assert [p.url.params["start"] for p in pedidos] == ["0", "10"]
    assert pedidos[0].url.params["sort_column"] == "popular"


def test_para_quando_as_paginas_acabam(sessao: Session) -> None:
    mercado = _mercado([_pagina(_resultado("Name Tag", 150)), _pagina()])

    resumo = atualizar_catalogo(sessao, mercado, itens=300, preco_minimo=Decimal("1.00"))

    assert resumo.vistos == 1


def test_item_repetido_entre_paginas_e_gravado_uma_vez(sessao: Session) -> None:
    mercado = _mercado([_pagina(_resultado("Name Tag", 150)), _pagina(_resultado("Name Tag", 151))])

    atualizar_catalogo(sessao, mercado, itens=20, preco_minimo=Decimal("1.00"))

    assert list(_itens(sessao)) == ["Name Tag"]


def test_no_429_fica_com_as_paginas_ja_lidas(sessao: Session) -> None:
    mercado = _mercado([_pagina(_resultado("Name Tag", 150)), httpx.Response(429)])

    resumo = atualizar_catalogo(sessao, mercado, itens=20, preco_minimo=Decimal("1.00"))

    assert list(_itens(sessao)) == ["Name Tag"]
    assert "429" in resumo.interrompida_por
    execucao = sessao.scalars(select(ExecucaoColeta).order_by(ExecucaoColeta.id.desc())).first()
    assert execucao.status is StatusExecucao.SUCESSO
    assert "429" in execucao.erro


def test_429_na_primeira_pagina_e_falha(sessao: Session) -> None:
    with pytest.raises(LimiteDaSteamError):
        atualizar_catalogo(
            sessao, _mercado([httpx.Response(429)]), itens=20, preco_minimo=Decimal("1")
        )

    execucao = sessao.scalars(select(ExecucaoColeta).order_by(ExecucaoColeta.id.desc())).first()
    assert execucao.status is StatusExecucao.FALHA
