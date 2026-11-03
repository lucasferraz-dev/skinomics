from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import obter_sessao

router = APIRouter(tags=["saúde"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(sessao: Annotated[Session, Depends(obter_sessao)]) -> dict[str, str]:
    """Diferencia processo no ar de API capaz de consultar o banco."""
    try:
        sessao.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "banco indisponível") from None
    return {"status": "ok", "database": "ok"}
