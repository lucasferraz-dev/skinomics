from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Row, func, select, update
from sqlalchemy.orm import Session

from app.consultas.itens import resumo_dos_itens
from app.models import Alerta
from app.models.alerta import CondicaoAlerta

# Teto por usuário: alerta é para o que a pessoa quer mesmo comprar ou vender.
LIMITE_ALERTAS = 50


class LimiteDeAlertasError(Exception):
    pass


class AlvoJaAtingidoError(Exception):
    """O preço de hoje já passou do alvo: o alerta dispararia na primeira checagem."""


def ja_atingido(condicao: CondicaoAlerta, preco: Decimal, alvo: Decimal) -> bool:
    if condicao == CondicaoAlerta.ABAIXO:
        return preco <= alvo
    return preco >= alvo


def listar(sessao: Session, usuario_id: int, so_avisos: bool = False) -> Sequence[Row]:
    """Alertas do usuário com o resumo do item, os mais recentes primeiro.

    Com `so_avisos`, só os disparados que ainda não foram vistos (os do sino).
    """
    resumo = resumo_dos_itens()
    consulta = (
        select(Alerta, resumo)
        .join(resumo, resumo.c.id == Alerta.item_id)
        .where(Alerta.usuario_id == usuario_id)
    )
    if so_avisos:
        consulta = consulta.where(
            Alerta.disparado_em.is_not(None), Alerta.visto_em.is_(None)
        ).order_by(Alerta.disparado_em.desc(), Alerta.id.desc())
    else:
        consulta = consulta.order_by(Alerta.criado_em.desc(), Alerta.id.desc())
    return sessao.execute(consulta).all()


def buscar(sessao: Session, usuario_id: int, alerta_id: int) -> Alerta | None:
    alerta = sessao.get(Alerta, alerta_id)
    # Alerta de outra pessoa é tratado como inexistente, sem dizer que ele existe.
    return alerta if alerta is not None and alerta.usuario_id == usuario_id else None


def criar(
    sessao: Session,
    usuario_id: int,
    item_id: int,
    preco_atual: Decimal | None,
    condicao: CondicaoAlerta,
    alvo: Decimal,
) -> Alerta:
    quantidade = sessao.scalar(select(func.count()).where(Alerta.usuario_id == usuario_id))
    if quantidade >= LIMITE_ALERTAS:
        raise LimiteDeAlertasError
    if preco_atual is not None and ja_atingido(condicao, preco_atual, alvo):
        raise AlvoJaAtingidoError
    alerta = Alerta(
        usuario_id=usuario_id,
        item_id=item_id,
        condicao=condicao,
        preco_alvo=alvo,
        preco_criacao=preco_atual,
    )
    sessao.add(alerta)
    sessao.commit()
    return alerta


def atualizar(
    sessao: Session,
    alerta: Alerta,
    preco_atual: Decimal | None,
    alvo: Decimal | None,
    ativo: bool | None,
) -> Alerta:
    """Troca o alvo, pausa ou retoma. Novo alvo ou retomar um disparado arma o alerta de novo."""
    novo_alvo = alvo if alvo is not None else alerta.preco_alvo
    rearmar = alvo is not None or (ativo is True and alerta.disparado_em is not None)
    if rearmar:
        if preco_atual is not None and ja_atingido(alerta.condicao, preco_atual, novo_alvo):
            raise AlvoJaAtingidoError
        alerta.preco_alvo = novo_alvo
        alerta.preco_criacao = preco_atual
        alerta.disparado_em = None
        alerta.preco_disparo = None
        alerta.data_preco_disparo = None
        alerta.visto_em = None
        alerta.ativo = True
    if ativo is not None:
        alerta.ativo = ativo
    sessao.commit()
    return alerta


def remover(sessao: Session, alerta: Alerta) -> None:
    sessao.delete(alerta)
    sessao.commit()


def marcar_vistos(sessao: Session, usuario_id: int, agora: datetime | None = None) -> None:
    """Apaga os avisos do sino: os disparados continuam na página, só deixam de ser novidade."""
    sessao.execute(
        update(Alerta)
        .where(
            Alerta.usuario_id == usuario_id,
            Alerta.disparado_em.is_not(None),
            Alerta.visto_em.is_(None),
        )
        .values(visto_em=agora or datetime.now(UTC))
    )
    sessao.commit()
