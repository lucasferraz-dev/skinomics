from decimal import Decimal

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import Row

from app.api.auth import SessaoDep, UsuarioDep
from app.consultas import alertas as consultas
from app.consultas import itens
from app.models import Alerta
from app.schemas.alerta import AlertaResumo, EstadoAlerta, MudancaAlerta, NovoAlerta
from app.schemas.item import ItemResumo

router = APIRouter(prefix="/alertas", tags=["alertas"])

ALVO_JA_ATINGIDO = (
    "o preço de hoje já passou desse alvo; escolha um alvo que ainda não foi atingido"
)


def _estado(alerta: Alerta) -> EstadoAlerta:
    if alerta.disparado_em is not None:
        return "disparado"
    return "aguardando" if alerta.ativo else "pausado"


def _resumo(alerta: Alerta, item: Row | ItemResumo) -> AlertaResumo:
    return AlertaResumo(
        id=alerta.id,
        item=ItemResumo.model_validate(item),
        condicao=alerta.condicao,
        preco_alvo=float(alerta.preco_alvo),
        preco_criacao=None if alerta.preco_criacao is None else float(alerta.preco_criacao),
        estado=_estado(alerta),
        criado_em=alerta.criado_em,
        disparado_em=alerta.disparado_em,
        preco_disparo=None if alerta.preco_disparo is None else float(alerta.preco_disparo),
        data_preco_disparo=alerta.data_preco_disparo,
        visto=alerta.visto_em is not None,
    )


def _item_ou_404(sessao: SessaoDep, item_id: int) -> Row:
    item = itens.buscar_item(sessao, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item não encontrado")
    return item


def _preco(item: Row) -> Decimal | None:
    return None if item.preco_atual is None else Decimal(str(item.preco_atual))


@router.get("")
def listar(sessao: SessaoDep, usuario: UsuarioDep) -> list[AlertaResumo]:
    """Alertas do usuário logado, os mais recentes primeiro."""
    return [_resumo(linha[0], linha) for linha in consultas.listar(sessao, usuario.id)]


@router.get("/avisos")
def avisos(sessao: SessaoDep, usuario: UsuarioDep) -> list[AlertaResumo]:
    """Alertas disparados que o usuário ainda não viu: o que acende o sino do header."""
    return [
        _resumo(linha[0], linha) for linha in consultas.listar(sessao, usuario.id, so_avisos=True)
    ]


@router.post("/avisos/vistos", status_code=status.HTTP_204_NO_CONTENT)
def marcar_vistos(sessao: SessaoDep, usuario: UsuarioDep) -> Response:
    consultas.marcar_vistos(sessao, usuario.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("", status_code=status.HTTP_201_CREATED)
def criar(sessao: SessaoDep, usuario: UsuarioDep, novo: NovoAlerta) -> AlertaResumo:
    """Cria o alerta. O alvo precisa ainda não ter sido atingido pelo preço de hoje."""
    item = _item_ou_404(sessao, novo.item_id)
    try:
        alerta = consultas.criar(
            sessao,
            usuario.id,
            novo.item_id,
            _preco(item),
            novo.condicao,
            Decimal(str(novo.preco_alvo)),
        )
    except consultas.LimiteDeAlertasError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"cada conta tem até {consultas.LIMITE_ALERTAS} alertas"
        ) from None
    except consultas.AlvoJaAtingidoError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, ALVO_JA_ATINGIDO) from None
    return _resumo(alerta, item)


@router.patch("/{alerta_id}")
def atualizar(
    sessao: SessaoDep, usuario: UsuarioDep, alerta_id: int, mudanca: MudancaAlerta
) -> AlertaResumo:
    alerta = consultas.buscar(sessao, usuario.id, alerta_id)
    if alerta is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "alerta não encontrado")
    item = _item_ou_404(sessao, alerta.item_id)
    alvo = None if mudanca.preco_alvo is None else Decimal(str(mudanca.preco_alvo))
    try:
        consultas.atualizar(sessao, alerta, _preco(item), alvo, mudanca.ativo)
    except consultas.AlvoJaAtingidoError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, ALVO_JA_ATINGIDO) from None
    return _resumo(alerta, item)


@router.delete("/{alerta_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(sessao: SessaoDep, usuario: UsuarioDep, alerta_id: int) -> Response:
    alerta = consultas.buscar(sessao, usuario.id, alerta_id)
    if alerta is not None:
        consultas.remover(sessao, alerta)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
