from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Usuario(Base):
    """Conta na plataforma; o cadastro é a própria conta Steam."""

    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    # SteamID64 (ex.: 76561197960287930): não cabe em INTEGER.
    steam_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    nome: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ultimo_login_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SessaoLogin(Base):
    """Sessão aberta por um login; o navegador guarda o token, o banco só o hash dele."""

    __tablename__ = "sessao_login"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"), index=True
    )
    # SHA-256 do token: quem ler o banco não consegue usar as sessões.
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
