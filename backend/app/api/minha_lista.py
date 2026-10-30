from fastapi import APIRouter, HTTPException, Response, status

from app.api.auth import SessaoDep, UsuarioDep
from app.consultas import itens
from app.consultas import minha_lista as consultas
from app.schemas.minha_lista import ItemAcompanhadoResumo

router = APIRouter(prefix="/minha-lista", tags=["minha lista"])


@router.get("")
def listar(sessao: SessaoDep, usuario: UsuarioDep) -> list[ItemAcompanhadoResumo]:
    """Watchlist do usuário logado, com a variação desde que cada item entrou."""
    return [
        ItemAcompanhadoResumo.model_validate(linha)
        for linha in consultas.listar(sessao, usuario.id)
    ]


@router.put("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def acompanhar(sessao: SessaoDep, usuario: UsuarioDep, item_id: int) -> Response:
    """Põe o item na lista; repetir não muda nada (idempotente)."""
    item = itens.buscar_item(sessao, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item não encontrado")
    try:
        consultas.adicionar(sessao, usuario.id, item_id, item.preco_atual)
    except consultas.ListaCheiaError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"a lista aceita até {consultas.LIMITE_ITENS} itens"
        ) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deixar_de_acompanhar(sessao: SessaoDep, usuario: UsuarioDep, item_id: int) -> Response:
    consultas.remover(sessao, usuario.id, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
