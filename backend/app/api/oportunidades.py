from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.consultas.oportunidades import listar_oportunidades
from app.db.session import obter_sessao
from app.schemas.oportunidade import RankingOportunidades
from app.schemas.previsao import HorizontePrevisao

router = APIRouter(prefix="/oportunidades", tags=["oportunidades"])


@router.get("")
def ranking(
    sessao: Annotated[Session, Depends(obter_sessao)],
    horizonte: HorizontePrevisao = HorizontePrevisao.SEMANA,
    pagina: Annotated[int, Query(ge=1)] = 1,
    por_pagina: Annotated[int, Query(ge=1, le=50)] = 20,
) -> RankingOportunidades:
    """Margens brutas positivas, ordenadas da maior para a menor, com risco descritivo."""
    return listar_oportunidades(sessao, horizonte, pagina, por_pagina)
