from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Item, PrecoDiario

DIA_1 = date(2026, 10, 1)


def _item(
    sessao: Session, nome: str, precos: list[tuple[str, int]], tipo: str | None = None
) -> Item:
    """Cria o item com um preço (valor, volume) por dia, a partir de DIA_1."""
    item = Item(appid=440, market_hash_name=nome, nome=nome, tipo=tipo)
    sessao.add(item)
    sessao.flush()
    sessao.add_all(
        PrecoDiario(
            item_id=item.id,
            data=DIA_1 + timedelta(days=i),
            preco=Decimal(preco),
            volume=volume,
            preenchido=False,
        )
        for i, (preco, volume) in enumerate(precos)
    )
    sessao.flush()
    return item


@pytest.fixture
def itens(sessao: Session) -> dict[str, Item]:
    return {
        # 8 dias: dá para comparar o último (2,50) com 7 dias antes (2,00).
        "key": _item(
            sessao,
            "Mann Co. Supply Crate Key",
            [("2.00", 10)] + [("2.10", 10)] * 6 + [("2.50", 10)],
            tipo="Level 5 Tool",
        ),
        # 2 dias: histórico curto demais para a variação de 7 dias.
        "caixa": _item(sessao, "Winter 2025 Cosmetic Case", [("0.20", 1000), ("0.10", 500)]),
        "saxton": _item(sessao, "Secret Saxton", [("8.00", 2)], tipo="Level 1 Tool"),
        "sem_preco": _item(sessao, "Haunted Hoard Case", []),
    }


def _nomes(resposta: dict) -> list[str]:
    return [item["nome"] for item in resposta["itens"]]


def test_lista_calcula_preco_atual_variacao_e_volume(
    cliente: TestClient, itens: dict[str, Item]
) -> None:
    resposta = cliente.get("/itens", params={"busca": "key"})

    assert resposta.status_code == 200
    [key] = resposta.json()["itens"]
    assert key["preco_atual"] == 2.5
    assert key["data_preco"] == "2026-10-08"
    assert key["variacao_7d"] == pytest.approx(0.25)
    assert key["volume_7d"] == 70


def test_item_com_pouco_historico_ou_sem_preco_vem_com_campos_nulos(
    cliente: TestClient, itens: dict[str, Item]
) -> None:
    por_nome = {i["nome"]: i for i in cliente.get("/itens").json()["itens"]}

    assert por_nome["Winter 2025 Cosmetic Case"]["variacao_7d"] is None
    assert por_nome["Winter 2025 Cosmetic Case"]["volume_7d"] == 1500
    assert por_nome["Haunted Hoard Case"]["preco_atual"] is None


@pytest.mark.parametrize(
    ("params", "esperado"),
    [
        ({"busca": "CASE"}, ["Haunted Hoard Case", "Winter 2025 Cosmetic Case"]),
        ({"busca": "100%"}, []),
        ({"tipo": "Level 5 Tool"}, ["Mann Co. Supply Crate Key"]),
        ({"preco_min": 1, "preco_max": 3}, ["Mann Co. Supply Crate Key"]),
        (
            {"ordenar": "preco", "direcao": "desc"},
            [
                "Secret Saxton",
                "Mann Co. Supply Crate Key",
                "Winter 2025 Cosmetic Case",
                "Haunted Hoard Case",
            ],
        ),
        (
            # Só a Key tem variação; os demais vão para o fim, na ordem de criação (id).
            {"ordenar": "variacao_7d", "direcao": "desc"},
            [
                "Mann Co. Supply Crate Key",
                "Winter 2025 Cosmetic Case",
                "Secret Saxton",
                "Haunted Hoard Case",
            ],
        ),
    ],
)
def test_busca_filtros_e_ordenacao(
    cliente: TestClient, itens: dict[str, Item], params: dict, esperado: list[str]
) -> None:
    resposta = cliente.get("/itens", params=params)

    assert resposta.status_code == 200
    assert _nomes(resposta.json()) == esperado


def test_paginacao(cliente: TestClient, itens: dict[str, Item]) -> None:
    resposta = cliente.get("/itens", params={"por_pagina": 3, "pagina": 2}).json()

    assert resposta["total"] == 4
    assert (resposta["pagina"], resposta["por_pagina"]) == (2, 3)
    assert _nomes(resposta) == ["Winter 2025 Cosmetic Case"]


@pytest.mark.parametrize(
    "params",
    [
        {"preco_min": 5, "preco_max": 1},
        {"por_pagina": 101},
        {"pagina": 0},
        {"ordenar": "quebrado"},
        {"filtro_que_nao_existe": 1},
    ],
)
def test_parametros_invalidos_sao_rejeitados(cliente: TestClient, params: dict) -> None:
    assert cliente.get("/itens", params=params).status_code == 422


def test_detalhe_do_item(cliente: TestClient, itens: dict[str, Item]) -> None:
    resposta = cliente.get(f"/itens/{itens['saxton'].id}")

    assert resposta.status_code == 200
    assert resposta.json()["nome"] == "Secret Saxton"
    assert resposta.json()["tipo"] == "Level 1 Tool"


def test_historico_respeita_a_janela_e_vem_em_ordem(
    cliente: TestClient, itens: dict[str, Item]
) -> None:
    resposta = cliente.get(
        f"/itens/{itens['key'].id}/historico", params={"inicio": "2026-10-06", "fim": "2026-10-08"}
    )

    assert resposta.status_code == 200
    assert resposta.json() == [
        {"data": "2026-10-06", "preco": 2.1, "volume": 10, "preenchido": False},
        {"data": "2026-10-07", "preco": 2.1, "volume": 10, "preenchido": False},
        {"data": "2026-10-08", "preco": 2.5, "volume": 10, "preenchido": False},
    ]


def test_historico_com_inicio_depois_do_fim_e_rejeitado(
    cliente: TestClient, itens: dict[str, Item]
) -> None:
    resposta = cliente.get(
        f"/itens/{itens['key'].id}/historico", params={"inicio": "2026-10-08", "fim": "2026-10-01"}
    )

    assert resposta.status_code == 422


@pytest.mark.parametrize("rota", ["/itens/999999", "/itens/999999/historico"])
def test_item_inexistente_da_404(cliente: TestClient, rota: str) -> None:
    assert cliente.get(rota).status_code == 404
