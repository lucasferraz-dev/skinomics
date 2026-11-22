from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.consultas.modelos import listar_modelos_ativos
from app.db.session import obter_sessao
from app.schemas.modelo import ModeloAtivoResumo

router = APIRouter(prefix="/modelos", tags=["modelos"])


@router.get("/ativos")
def modelos_ativos(sessao: Annotated[Session, Depends(obter_sessao)]) -> list[ModeloAtivoResumo]:
    """Modelo publicado em cada horizonte, com as métricas do teste temporal."""
    return listar_modelos_ativos(sessao)
