from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.consultas import itens as consultas
from app.db.session import obter_sessao
from app.models import Item
from app.schemas.item import FiltrosItens, ItemResumo, PaginaItens, PontoHistorico

router = APIRouter(prefix="/itens", tags=["itens"])

SessaoDep = Annotated[Session, Depends(obter_sessao)]


@router.get("")
def listar_itens(sessao: SessaoDep, filtros: Annotated[FiltrosItens, Query()]) -> PaginaItens:
    """Busca de itens com filtros, ordenação e paginação."""
    linhas, total = consultas.listar_itens(sessao, filtros)
    return PaginaItens(
        itens=[ItemResumo.model_validate(linha) for linha in linhas],
        total=total,
        pagina=filtros.pagina,
        por_pagina=filtros.por_pagina,
    )


@router.get("/{item_id}")
def detalhar_item(sessao: SessaoDep, item_id: int) -> ItemResumo:
    linha = consultas.buscar_item(sessao, item_id)
    if linha is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item não encontrado")
    return ItemResumo.model_validate(linha)


@router.get("/{item_id}/historico")
def historico_do_item(
    sessao: SessaoDep,
    item_id: int,
    inicio: date | None = None,
    fim: date | None = None,
) -> list[PontoHistorico]:
    """Série diária de preço e volume, do dia mais antigo ao mais recente."""
    if inicio and fim and inicio > fim:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "inicio depois de fim")
    if sessao.get(Item, item_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item não encontrado")
    return [
        PontoHistorico.model_validate(ponto)
        for ponto in consultas.historico_do_item(sessao, item_id, inicio, fim)
    ]
