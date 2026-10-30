from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import httpx2 as httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.auth import COOKIE_SESSAO, obter_cliente_steam
from app.auth import steam
from app.core.config import Settings, get_settings
from app.models import SessaoLogin, Usuario

SITE = "http://localhost:5173"
STEAM_ID = 76561197960287930
ASSINADOS = "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle"


class SteamFalsa:
    """Faz o papel da Steam nos testes: confirma (ou não) a assinatura e devolve um perfil."""

    def __init__(self) -> None:
        self.assinatura_valida = True
        self.perfil_status = 200
        self.verificacoes = 0

    def __call__(self, pedido: httpx.Request) -> httpx.Response:
        if str(pedido.url) == steam.PROVEDOR:
            self.verificacoes += 1
            corpo = parse_qs(pedido.content.decode())
            assert corpo["openid.mode"] == ["check_authentication"]
            valido = "true" if self.assinatura_valida else "false"
            return httpx.Response(
                200, text=f"ns:http://specs.openid.net/auth/2.0\nis_valid:{valido}\n"
            )
        if pedido.url.host == "steamcommunity.com":
            # Página pública do perfil em XML, usada quando não há chave da Web API.
            assert pedido.url.path == f"/profiles/{STEAM_ID}/"
            xml = (
                "<?xml version='1.0' encoding='UTF-8'?><profile>"
                "<steamID><![CDATA[Pyro & Cia]]></steamID>"
                "<avatarFull><![CDATA[https://avatars.exemplo/pyro.jpg]]></avatarFull>"
                "</profile>"
            )
            return httpx.Response(self.perfil_status, text=xml)
        jogador = {"personaname": "Saxton Hale", "avatarfull": "https://avatars.exemplo/sax.jpg"}
        return httpx.Response(self.perfil_status, json={"response": {"players": [jogador]}})


@pytest.fixture
def steam_falsa() -> SteamFalsa:
    return SteamFalsa()


@pytest.fixture
def api(cliente: TestClient, steam_falsa: SteamFalsa) -> Iterator[TestClient]:
    def cliente_steam() -> Iterator[httpx.Client]:
        with httpx.Client(transport=httpx.MockTransport(steam_falsa)) as c:
            yield c

    sobrescritas = cliente.app.dependency_overrides
    sobrescritas[get_settings] = lambda: Settings(site_url=SITE, steam_api_key="chave")
    sobrescritas[obter_cliente_steam] = cliente_steam
    yield cliente


def _ir_para_steam(api: TestClient) -> str:
    """Começa o login e devolve o return_to que o site mandou para a Steam."""
    resposta = api.get("/auth/steam", follow_redirects=False)
    assert resposta.status_code == 303
    destino = urlsplit(resposta.headers["location"])
    assert f"{destino.scheme}://{destino.netloc}{destino.path}" == steam.PROVEDOR
    [retorno] = parse_qs(destino.query)["openid.return_to"]
    return retorno


def _parametros_da_steam(retorno: str, **trocas: str) -> dict[str, str]:
    """O que a Steam põe na URL de volta depois de um login bem-sucedido."""
    identidade = f"https://steamcommunity.com/openid/id/{STEAM_ID}"
    agora = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    parametros = {
        **{chave: valor for chave, [valor] in parse_qs(urlsplit(retorno).query).items()},
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "id_res",
        "openid.op_endpoint": steam.PROVEDOR,
        "openid.claimed_id": identidade,
        "openid.identity": identidade,
        "openid.return_to": retorno,
        "openid.response_nonce": f"{agora}abc123",
        "openid.assoc_handle": "1234567890",
        "openid.signed": ASSINADOS,
        "openid.sig": "assinatura",
    }
    return parametros | trocas


def _voltar_da_steam(api: TestClient, parametros: dict[str, str]) -> str:
    resposta = api.get("/auth/steam/retorno", params=parametros, follow_redirects=False)
    assert resposta.status_code == 303
    return resposta.headers["location"]


def test_login_cria_usuario_abre_sessao_e_vai_para_o_terminal(
    api: TestClient, sessao: Session
) -> None:
    retorno = _ir_para_steam(api)
    assert retorno.startswith(f"{SITE}/api/auth/steam/retorno?estado=")

    assert _voltar_da_steam(api, _parametros_da_steam(retorno)) == f"{SITE}/itens"

    eu = api.get("/auth/eu")
    assert eu.status_code == 200
    assert eu.json() == {
        "id": eu.json()["id"],
        "steam_id": str(STEAM_ID),
        "nome": "Saxton Hale",
        "avatar_url": "https://avatars.exemplo/sax.jpg",
    }
    # O banco guarda o hash, nunca o token que está no cookie.
    login = sessao.scalars(select(SessaoLogin)).one()
    assert login.token_hash != api.cookies[COOKIE_SESSAO]


def test_segundo_login_reaproveita_o_usuario(api: TestClient, sessao: Session) -> None:
    for _ in range(2):
        _voltar_da_steam(api, _parametros_da_steam(_ir_para_steam(api)))

    assert len(sessao.scalars(select(Usuario)).all()) == 1
    assert len(sessao.scalars(select(SessaoLogin)).all()) == 2


def _sem_chave_da_api(api: TestClient) -> None:
    api.app.dependency_overrides[get_settings] = lambda: Settings(site_url=SITE)


def test_sem_chave_da_api_o_perfil_vem_da_pagina_publica(api: TestClient) -> None:
    _sem_chave_da_api(api)

    _voltar_da_steam(api, _parametros_da_steam(_ir_para_steam(api)))

    eu = api.get("/auth/eu").json()
    assert (eu["nome"], eu["avatar_url"]) == ("Pyro & Cia", "https://avatars.exemplo/pyro.jpg")


@pytest.mark.parametrize("com_chave", [True, False])
def test_perfil_indisponivel_nao_impede_o_login(
    api: TestClient, steam_falsa: SteamFalsa, com_chave: bool
) -> None:
    if not com_chave:
        _sem_chave_da_api(api)
    steam_falsa.perfil_status = 500

    assert _voltar_da_steam(api, _parametros_da_steam(_ir_para_steam(api))) == f"{SITE}/itens"
    assert api.get("/auth/eu").json()["nome"] is None


def test_steam_que_nao_confirma_a_assinatura_recusa_o_login(
    api: TestClient, steam_falsa: SteamFalsa
) -> None:
    steam_falsa.assinatura_valida = False

    destino = _voltar_da_steam(api, _parametros_da_steam(_ir_para_steam(api)))

    assert destino == f"{SITE}/entrar?erro=steam"
    assert COOKIE_SESSAO not in api.cookies


@pytest.mark.parametrize(
    "trocas",
    [
        # claimed_id fora da assinatura: daria para trocar o SteamID na URL.
        {"openid.signed": "signed,op_endpoint,identity,return_to,response_nonce"},
        {"openid.op_endpoint": "https://steam-falsa.exemplo/openid/login"},
        {"openid.return_to": f"{SITE}/api/auth/steam/retorno?estado=outro"},
        {
            "openid.claimed_id": "https://steamcommunity.com/openid/id/123",
            "openid.identity": "https://steamcommunity.com/openid/id/123",
        },
        {"openid.response_nonce": "2026-01-01T00:00:00Zvelho"},
        {"openid.mode": "cancel"},
    ],
)
def test_retorno_adulterado_e_recusado_sem_consultar_a_steam(
    api: TestClient, steam_falsa: SteamFalsa, trocas: dict[str, str]
) -> None:
    destino = _voltar_da_steam(api, _parametros_da_steam(_ir_para_steam(api), **trocas))

    assert destino == f"{SITE}/entrar?erro=steam"
    assert steam_falsa.verificacoes == 0


def test_retorno_sem_o_estado_do_navegador_e_recusado(
    api: TestClient, steam_falsa: SteamFalsa
) -> None:
    # Link de login montado em outro navegador (ex.: enviado por alguém).
    parametros = _parametros_da_steam(_ir_para_steam(api))
    api.cookies.clear()

    assert _voltar_da_steam(api, parametros) == f"{SITE}/entrar?erro=steam"
    assert steam_falsa.verificacoes == 0


def test_eu_sem_sessao_da_401(api: TestClient) -> None:
    assert api.get("/auth/eu").status_code == 401
    api.cookies.set(COOKIE_SESSAO, "token-inventado")
    assert api.get("/auth/eu").status_code == 401


def test_sessao_expirada_da_401(api: TestClient, sessao: Session) -> None:
    _voltar_da_steam(api, _parametros_da_steam(_ir_para_steam(api)))
    sessao.execute(update(SessaoLogin).values(expira_em=datetime.now(UTC) - timedelta(minutes=1)))

    assert api.get("/auth/eu").status_code == 401


def test_sair_encerra_a_sessao(api: TestClient, sessao: Session) -> None:
    _voltar_da_steam(api, _parametros_da_steam(_ir_para_steam(api)))
    token = api.cookies[COOKIE_SESSAO]

    assert api.post("/auth/sair").status_code == 204

    assert sessao.scalars(select(SessaoLogin)).all() == []
    api.cookies.set(COOKIE_SESSAO, token)
    assert api.get("/auth/eu").status_code == 401
