import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.auth.steam import Perfil
from app.models import SessaoLogin, Usuario


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def entrar(sessao: Session, steam_id: int, perfil: Perfil | None, dias: int) -> str:
    """Cria o usuário no primeiro login, abre uma sessão e devolve o token dela."""
    usuario = sessao.scalar(select(Usuario).where(Usuario.steam_id == steam_id))
    if usuario is None:
        usuario = Usuario(steam_id=steam_id)
        sessao.add(usuario)
    if perfil is not None:
        usuario.nome, usuario.avatar_url = perfil.nome, perfil.avatar_url
    usuario.ultimo_login_em = func.now()
    sessao.flush()

    # Aproveita o login para limpar as sessões vencidas do usuário.
    sessao.execute(
        delete(SessaoLogin).where(
            SessaoLogin.usuario_id == usuario.id, SessaoLogin.expira_em <= func.now()
        )
    )
    token = secrets.token_urlsafe(32)
    sessao.add(
        SessaoLogin(
            usuario_id=usuario.id,
            token_hash=_hash(token),
            expira_em=datetime.now(UTC) + timedelta(days=dias),
        )
    )
    sessao.commit()
    return token


def usuario_da_sessao(sessao: Session, token: str) -> Usuario | None:
    return sessao.scalar(
        select(Usuario)
        .join(SessaoLogin, SessaoLogin.usuario_id == Usuario.id)
        .where(SessaoLogin.token_hash == _hash(token), SessaoLogin.expira_em > func.now())
    )


def sair(sessao: Session, token: str) -> None:
    sessao.execute(delete(SessaoLogin).where(SessaoLogin.token_hash == _hash(token)))
    sessao.commit()
