import logging
import secrets
from collections.abc import Iterator
from typing import Annotated

import httpx2 as httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import sessoes, steam
from app.core.config import Settings, get_settings
from app.db.session import obter_sessao
from app.models import Usuario
from app.schemas.usuario import UsuarioAtual

log = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["autenticação"])

COOKIE_SESSAO = "skinomics_sessao"
# Liga a ida para a Steam à volta dela: um retorno que não começou neste navegador é
# recusado, e ninguém consegue logar outra pessoa na própria conta com um link.
COOKIE_ESTADO = "skinomics_login_estado"
_VALIDADE_ESTADO = 10 * 60


def obter_cliente_steam() -> Iterator[httpx.Client]:
    with httpx.Client(timeout=10) as cliente:
        yield cliente


SessaoDep = Annotated[Session, Depends(obter_sessao)]
ConfigDep = Annotated[Settings, Depends(get_settings)]
ClienteSteamDep = Annotated[httpx.Client, Depends(obter_cliente_steam)]
TokenDep = Annotated[str | None, Cookie(alias=COOKIE_SESSAO)]


def exigir_usuario(sessao: SessaoDep, token: TokenDep = None) -> Usuario:
    """Dependência das rotas que precisam de login."""
    usuario = sessoes.usuario_da_sessao(sessao, token) if token else None
    if usuario is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "login necessário")
    return usuario


UsuarioDep = Annotated[Usuario, Depends(exigir_usuario)]


def _retorno(config: Settings, estado: str) -> str:
    # Passa pelo /api do site (proxy do Vite em dev, rewrite da Vercel em produção), para o
    # cookie da sessão ser gravado no domínio do site.
    return f"{config.site_url}/api/auth/steam/retorno?estado={estado}"


@router.get("/steam")
def entrar_com_steam(config: ConfigDep) -> RedirectResponse:
    """Manda o usuário para a página de login da Steam."""
    estado = secrets.token_urlsafe(16)
    resposta = RedirectResponse(
        steam.url_de_login(_retorno(config, estado), realm=config.site_url),
        status.HTTP_303_SEE_OTHER,
    )
    resposta.set_cookie(
        COOKIE_ESTADO,
        estado,
        max_age=_VALIDADE_ESTADO,
        httponly=True,
        secure=config.cookie_seguro,
        samesite="lax",
    )
    return resposta


@router.get("/steam/retorno", include_in_schema=False)
def retorno_da_steam(
    request: Request,
    sessao: SessaoDep,
    config: ConfigDep,
    cliente: ClienteSteamDep,
    estado: str = "",
    estado_cookie: Annotated[str | None, Cookie(alias=COOKIE_ESTADO)] = None,
) -> RedirectResponse:
    """A Steam devolve o usuário aqui; abre a sessão e segue para o terminal."""
    try:
        if not estado_cookie or not secrets.compare_digest(estado, estado_cookie):
            raise steam.LoginRecusadoError("estado do login não confere com o do navegador")
        steam_id = steam.verificar_retorno(request.query_params, _retorno(config, estado), cliente)
    except steam.LoginRecusadoError as erro:
        log.warning("login Steam recusado: %s", erro)
        # Uma mensagem só para qualquer falha: a tela não precisa saber o motivo.
        resposta = RedirectResponse(
            f"{config.site_url}/entrar?erro=steam", status.HTTP_303_SEE_OTHER
        )
    else:
        perfil = steam.buscar_perfil(steam_id, config.steam_api_key, cliente)
        token = sessoes.entrar(sessao, steam_id, perfil, config.sessao_dias)
        resposta = RedirectResponse(f"{config.site_url}/itens", status.HTTP_303_SEE_OTHER)
        resposta.set_cookie(
            COOKIE_SESSAO,
            token,
            max_age=config.sessao_dias * 24 * 60 * 60,
            httponly=True,
            secure=config.cookie_seguro,
            samesite="lax",
        )
    resposta.delete_cookie(COOKIE_ESTADO)
    return resposta


@router.get("/eu")
def usuario_logado(usuario: UsuarioDep) -> UsuarioAtual:
    return UsuarioAtual.model_validate(usuario)


@router.post("/sair", status_code=status.HTTP_204_NO_CONTENT)
def sair(sessao: SessaoDep, config: ConfigDep, token: TokenDep = None) -> Response:
    if token:
        sessoes.sair(sessao, token)
    resposta = Response(status_code=status.HTTP_204_NO_CONTENT)
    resposta.delete_cookie(COOKIE_SESSAO, secure=config.cookie_seguro, samesite="lax")
    return resposta
