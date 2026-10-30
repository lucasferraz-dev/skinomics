"""Login com a Steam via OpenID 2.0 e busca do perfil público do usuário.

Fluxo: o usuário vai para a Steam (`url_de_login`), entra lá e volta para o `retorno` com
parâmetros `openid.*` assinados; `verificar_retorno` confere esses parâmetros com a própria
Steam e devolve o SteamID64 de quem entrou.
"""

import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode
from xml.etree import ElementTree

import httpx2 as httpx

log = logging.getLogger(__name__)

PROVEDOR = "https://steamcommunity.com/openid/login"
_NS = "http://specs.openid.net/auth/2.0"
_IDENTIFICADOR_SELECIONADO = "http://specs.openid.net/auth/2.0/identifier_select"
_ID_STEAM = re.compile(r"https://steamcommunity\.com/openid/id/(\d{17})")
# Campos que precisam estar na assinatura: sem isso, alguém trocaria o claimed_id na URL
# e a Steam validaria só os outros.
_CAMPOS_ASSINADOS = {"op_endpoint", "claimed_id", "identity", "return_to", "response_nonce"}
_VALIDADE_NONCE = timedelta(minutes=5)

_RESUMO_JOGADOR = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/"


class LoginRecusadoError(Exception):
    """O retorno da Steam não prova um login válido."""


@dataclass(frozen=True)
class Perfil:
    nome: str | None
    avatar_url: str | None


def url_de_login(retorno: str, realm: str) -> str:
    parametros = {
        "openid.ns": _NS,
        "openid.mode": "checkid_setup",
        "openid.return_to": retorno,
        "openid.realm": realm,
        "openid.identity": _IDENTIFICADOR_SELECIONADO,
        "openid.claimed_id": _IDENTIFICADOR_SELECIONADO,
    }
    return f"{PROVEDOR}?{urlencode(parametros)}"


def verificar_retorno(
    parametros: Mapping[str, str], retorno_esperado: str, cliente: httpx.Client
) -> int:
    """Devolve o SteamID64 de quem entrou ou levanta `LoginRecusadoError`."""
    openid = {chave: valor for chave, valor in parametros.items() if chave.startswith("openid.")}

    if openid.get("openid.mode") != "id_res":
        raise LoginRecusadoError(f"modo inesperado: {openid.get('openid.mode')!r}")
    if openid.get("openid.ns") != _NS or openid.get("openid.op_endpoint") != PROVEDOR:
        raise LoginRecusadoError("resposta não veio do provedor da Steam")
    if openid.get("openid.return_to") != retorno_esperado:
        raise LoginRecusadoError("return_to diferente do enviado")
    sem_assinatura = _CAMPOS_ASSINADOS - set(openid.get("openid.signed", "").split(","))
    if sem_assinatura:
        raise LoginRecusadoError(f"campos sem assinatura: {sorted(sem_assinatura)}")
    _conferir_nonce(openid.get("openid.response_nonce", ""))

    claimed_id = openid.get("openid.claimed_id", "")
    encontrado = _ID_STEAM.fullmatch(claimed_id)
    if not encontrado or openid.get("openid.identity") != claimed_id:
        raise LoginRecusadoError(f"identidade inválida: {claimed_id!r}")

    # Só a Steam tem a chave da assinatura: pedimos a ela para conferir os parâmetros.
    try:
        resposta = cliente.post(PROVEDOR, data={**openid, "openid.mode": "check_authentication"})
        resposta.raise_for_status()
    except httpx.HTTPError as erro:
        raise LoginRecusadoError(f"Steam indisponível na verificação: {erro}") from erro
    if "is_valid:true" not in resposta.text.splitlines():
        raise LoginRecusadoError("Steam não confirmou a assinatura")

    return int(encontrado.group(1))


def _conferir_nonce(nonce: str) -> None:
    # O nonce começa com o horário em que a Steam assinou, ex.: 2026-10-30T12:00:00Z...
    try:
        assinado_em = datetime.strptime(nonce[:20], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    except ValueError as erro:
        raise LoginRecusadoError(f"nonce ilegível: {nonce!r}") from erro
    if datetime.now(UTC) - assinado_em > _VALIDADE_NONCE:
        raise LoginRecusadoError("nonce expirado")


def buscar_perfil(steam_id: int, chave_api: str | None, cliente: httpx.Client) -> Perfil | None:
    """Nome e avatar públicos; `None` se não der, porque perfil não pode barrar o login."""
    try:
        if chave_api:
            return _perfil_pela_api(steam_id, chave_api, cliente)
        return _perfil_pelo_xml(steam_id, cliente)
    except (httpx.HTTPError, ValueError, KeyError, ElementTree.ParseError):
        log.warning("não foi possível buscar o perfil Steam de %s", steam_id, exc_info=True)
        return None


def _perfil_pela_api(steam_id: int, chave_api: str, cliente: httpx.Client) -> Perfil | None:
    resposta = cliente.get(_RESUMO_JOGADOR, params={"key": chave_api, "steamids": steam_id})
    resposta.raise_for_status()
    jogadores = resposta.json()["response"]["players"]
    if not jogadores:
        return None
    return Perfil(nome=jogadores[0].get("personaname"), avatar_url=jogadores[0].get("avatarfull"))


def _perfil_pelo_xml(steam_id: int, cliente: httpx.Client) -> Perfil | None:
    # Página pública do perfil em XML: não pede chave, mas não é uma API oficial da Steam.
    resposta = cliente.get(f"https://steamcommunity.com/profiles/{steam_id}/", params={"xml": 1})
    resposta.raise_for_status()
    perfil = ElementTree.fromstring(resposta.content)
    # Perfil inexistente volta como <response><error>...</error></response>.
    if perfil.tag != "profile":
        return None
    return Perfil(nome=perfil.findtext("steamID"), avatar_url=perfil.findtext("avatarFull"))
