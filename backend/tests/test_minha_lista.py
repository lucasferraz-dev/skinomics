from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.api.auth import COOKIE_SESSAO
from app.auth import sessoes
from app.consultas import minha_lista
from app.models import Item, ItemAcompanhado, PrecoDiario

DIA = date(2026, 10, 1)


def _item(sessao: Session, nome: str, preco: str | None) -> Item:
    item = Item(appid=440, market_hash_name=nome, nome=nome)
    sessao.add(item)
    sessao.flush()
    if preco is not None:
        _preco(sessao, item, DIA, preco)
    return item


def _preco(sessao: Session, item: Item, dia: date, preco: str) -> None:
    sessao.add(
        PrecoDiario(item_id=item.id, data=dia, preco=Decimal(preco), volume=10, preenchido=False)
    )
    sessao.flush()


def _entrar(cliente: TestClient, sessao: Session, steam_id: int) -> None:
    cliente.cookies.set(COOKIE_SESSAO, sessoes.entrar(sessao, steam_id, None, dias=1))


@pytest.fixture
def logado(cliente: TestClient, sessao: Session) -> TestClient:
    _entrar(cliente, sessao, 76561197960287930)
    return cliente


@pytest.fixture
def key(sessao: Session) -> Item:
    return _item(sessao, "Mann Co. Supply Crate Key", "2.00")


@pytest.mark.parametrize(
    ("metodo", "rota"),
    [("get", "/minha-lista"), ("put", "/minha-lista/1"), ("delete", "/minha-lista/1")],
)
def test_sem_login_da_401(cliente: TestClient, metodo: str, rota: str) -> None:
    assert cliente.request(metodo, rota).status_code == 401


def test_acompanhar_guarda_o_preco_da_inclusao(logado: TestClient, key: Item) -> None:
    assert logado.put(f"/minha-lista/{key.id}").status_code == 204

    [item] = logado.get("/minha-lista").json()
    assert item["nome"] == "Mann Co. Supply Crate Key"
    assert item["preco_inclusao"] == 2.0
    assert item["variacao_desde_inclusao"] == 0


def test_variacao_desde_a_inclusao_segue_o_preco_novo(
    logado: TestClient, sessao: Session, key: Item
) -> None:
    logado.put(f"/minha-lista/{key.id}")
    _preco(sessao, key, date(2026, 10, 2), "2.50")
    # Repetir não reinicia a base da variação.
    logado.put(f"/minha-lista/{key.id}")

    [item] = logado.get("/minha-lista").json()
    assert item["preco_atual"] == 2.5
    assert item["preco_inclusao"] == 2.0
    assert item["variacao_desde_inclusao"] == pytest.approx(0.25)


def test_item_sem_preco_entra_sem_base_de_variacao(logado: TestClient, sessao: Session) -> None:
    caixa = _item(sessao, "Haunted Hoard Case", None)

    logado.put(f"/minha-lista/{caixa.id}")

    [item] = logado.get("/minha-lista").json()
    assert item["preco_inclusao"] is None
    assert item["variacao_desde_inclusao"] is None


def test_lista_vem_dos_mais_recentes_para_os_mais_antigos(
    logado: TestClient, sessao: Session, key: Item
) -> None:
    saxton = _item(sessao, "Secret Saxton", "8.00")
    logado.put(f"/minha-lista/{key.id}")
    logado.put(f"/minha-lista/{saxton.id}")
    # Dentro da transação do teste o now() é o mesmo para os dois: a ordem vem das datas fixadas.
    for item, dia in [(key, 1), (saxton, 2)]:
        sessao.execute(
            update(ItemAcompanhado)
            .where(ItemAcompanhado.item_id == item.id)
            .values(incluido_em=datetime(2026, 10, dia, tzinfo=UTC))
        )

    nomes = [item["nome"] for item in logado.get("/minha-lista").json()]

    assert nomes == ["Secret Saxton", "Mann Co. Supply Crate Key"]


def test_deixar_de_acompanhar(logado: TestClient, key: Item) -> None:
    logado.put(f"/minha-lista/{key.id}")

    assert logado.delete(f"/minha-lista/{key.id}").status_code == 204
    assert logado.get("/minha-lista").json() == []
    # Remover o que não está na lista também é 204: o resultado final é o mesmo.
    assert logado.delete(f"/minha-lista/{key.id}").status_code == 204


def test_item_inexistente_da_404(logado: TestClient) -> None:
    assert logado.put("/minha-lista/999999").status_code == 404


def test_cada_usuario_ve_so_a_propria_lista(logado: TestClient, sessao: Session, key: Item) -> None:
    logado.put(f"/minha-lista/{key.id}")

    _entrar(logado, sessao, 76561197960287931)

    assert logado.get("/minha-lista").json() == []


def test_lista_cheia_da_409(
    logado: TestClient, sessao: Session, key: Item, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(minha_lista, "LIMITE_ITENS", 1)
    saxton = _item(sessao, "Secret Saxton", "8.00")
    logado.put(f"/minha-lista/{key.id}")

    assert logado.put(f"/minha-lista/{saxton.id}").status_code == 409
    # Repetir um item que já está na lista não esbarra no limite.
    assert logado.put(f"/minha-lista/{key.id}").status_code == 204
