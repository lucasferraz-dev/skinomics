from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.auth import COOKIE_SESSAO
from app.auth import sessoes
from app.consultas import alertas
from app.models import Alerta, Item, PrecoDiario
from app.servicos.alertas import verificar_alertas

DIA = date(2026, 11, 20)


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


def _criar(cliente: TestClient, item: Item, condicao: str, alvo: float) -> dict:
    resposta = cliente.post(
        "/alertas", json={"item_id": item.id, "condicao": condicao, "preco_alvo": alvo}
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


@pytest.mark.parametrize(
    ("metodo", "rota"),
    [
        ("get", "/alertas"),
        ("post", "/alertas"),
        ("get", "/alertas/avisos"),
        ("post", "/alertas/avisos/vistos"),
        ("patch", "/alertas/1"),
        ("delete", "/alertas/1"),
    ],
)
def test_sem_login_da_401(cliente: TestClient, metodo: str, rota: str) -> None:
    assert cliente.request(metodo, rota).status_code == 401


def test_criar_guarda_o_preco_de_hoje_como_base(logado: TestClient, key: Item) -> None:
    criado = _criar(logado, key, "abaixo", 1.80)

    assert criado["estado"] == "aguardando"
    assert criado["preco_alvo"] == 1.8
    assert criado["preco_criacao"] == 2.0
    assert criado["item"]["nome"] == "Mann Co. Supply Crate Key"
    [listado] = logado.get("/alertas").json()
    assert listado["id"] == criado["id"]


@pytest.mark.parametrize(
    ("condicao", "alvo"), [("abaixo", 2.10), ("abaixo", 2.00), ("acima", 1.90)]
)
def test_alvo_ja_atingido_hoje_e_recusado(
    logado: TestClient, key: Item, condicao: str, alvo: float
) -> None:
    resposta = logado.post(
        "/alertas", json={"item_id": key.id, "condicao": condicao, "preco_alvo": alvo}
    )
    assert resposta.status_code == 422
    assert logado.get("/alertas").json() == []


def test_item_inexistente_da_404(logado: TestClient) -> None:
    resposta = logado.post(
        "/alertas", json={"item_id": 999_999, "condicao": "abaixo", "preco_alvo": 1}
    )
    assert resposta.status_code == 404


def test_limite_de_alertas_por_conta(
    logado: TestClient, key: Item, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(alertas, "LIMITE_ALERTAS", 2)
    _criar(logado, key, "abaixo", 1.5)
    _criar(logado, key, "acima", 2.5)

    resposta = logado.post(
        "/alertas", json={"item_id": key.id, "condicao": "abaixo", "preco_alvo": 1}
    )
    assert resposta.status_code == 409


def test_alerta_de_outra_pessoa_nao_aparece_nem_muda(
    logado: TestClient, cliente: TestClient, sessao: Session, key: Item
) -> None:
    criado = _criar(logado, key, "abaixo", 1.5)
    _entrar(cliente, sessao, 76561197960287931)

    assert cliente.get("/alertas").json() == []
    assert cliente.patch(f"/alertas/{criado['id']}", json={"ativo": False}).status_code == 404
    cliente.delete(f"/alertas/{criado['id']}")
    assert sessao.get(Alerta, criado["id"]) is not None


def test_checagem_dispara_uma_vez_so(logado: TestClient, sessao: Session, key: Item) -> None:
    abaixo = _criar(logado, key, "abaixo", 1.80)
    acima = _criar(logado, key, "acima", 2.50)

    assert verificar_alertas(sessao) == []

    _preco(sessao, key, date(2026, 11, 21), "1.75")
    agora = datetime(2026, 11, 22, 3, tzinfo=UTC)
    [disparado] = verificar_alertas(sessao, agora)
    assert disparado.id == abaixo["id"]
    assert disparado.preco_disparo == Decimal("1.75")
    assert disparado.data_preco_disparo == date(2026, 11, 21)

    # Uma segunda checagem, com o preço ainda abaixo do alvo, não dispara de novo.
    assert verificar_alertas(sessao) == []

    estados = {alerta["id"]: alerta["estado"] for alerta in logado.get("/alertas").json()}
    assert estados == {abaixo["id"]: "disparado", acima["id"]: "aguardando"}


def test_alerta_de_alta_dispara_quando_o_preco_sobe(
    logado: TestClient, sessao: Session, key: Item
) -> None:
    acima = _criar(logado, key, "acima", 2.50)
    _preco(sessao, key, date(2026, 11, 21), "2.50")

    [disparado] = verificar_alertas(sessao)
    assert disparado.id == acima["id"]


def test_alerta_pausado_nao_dispara(logado: TestClient, sessao: Session, key: Item) -> None:
    criado = _criar(logado, key, "abaixo", 1.80)
    pausado = logado.patch(f"/alertas/{criado['id']}", json={"ativo": False}).json()
    assert pausado["estado"] == "pausado"

    _preco(sessao, key, date(2026, 11, 21), "1.50")
    assert verificar_alertas(sessao) == []


def test_sino_mostra_os_disparados_ate_serem_vistos(
    logado: TestClient, sessao: Session, key: Item
) -> None:
    criado = _criar(logado, key, "abaixo", 1.80)
    assert logado.get("/alertas/avisos").json() == []

    _preco(sessao, key, date(2026, 11, 21), "1.70")
    verificar_alertas(sessao)
    [aviso] = logado.get("/alertas/avisos").json()
    assert aviso["id"] == criado["id"]
    assert aviso["visto"] is False
    assert aviso["preco_disparo"] == 1.7

    assert logado.post("/alertas/avisos/vistos").status_code == 204
    assert logado.get("/alertas/avisos").json() == []
    # Visto não some da página: continua lá como disparado.
    [na_pagina] = logado.get("/alertas").json()
    assert na_pagina["estado"] == "disparado"
    assert na_pagina["visto"] is True


def test_novo_alvo_rearma_o_alerta_disparado(
    logado: TestClient, sessao: Session, key: Item
) -> None:
    criado = _criar(logado, key, "abaixo", 1.80)
    _preco(sessao, key, date(2026, 11, 21), "1.70")
    verificar_alertas(sessao)

    # O preço de hoje (1,70) já está abaixo de 1,75: esse alvo dispararia na hora.
    recusado = logado.patch(f"/alertas/{criado['id']}", json={"preco_alvo": 1.75})
    assert recusado.status_code == 422

    rearmado = logado.patch(f"/alertas/{criado['id']}", json={"preco_alvo": 1.60}).json()
    assert rearmado["estado"] == "aguardando"
    assert rearmado["preco_criacao"] == 1.7
    assert rearmado["disparado_em"] is None

    _preco(sessao, key, date(2026, 11, 22), "1.55")
    [disparado] = verificar_alertas(sessao)
    assert disparado.id == criado["id"]


def test_apagar_tira_o_alerta(logado: TestClient, key: Item) -> None:
    criado = _criar(logado, key, "abaixo", 1.80)

    assert logado.delete(f"/alertas/{criado['id']}").status_code == 204
    assert logado.get("/alertas").json() == []
