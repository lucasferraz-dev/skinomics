from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import ExecucaoColeta, FalhaColeta, StatusExecucao, TipoColeta


@contextmanager
def registrar_execucao(sessao: Session, tipo: TipoColeta) -> Iterator[ExecucaoColeta]:
    """Registra uma execução de coleta no log, do início ao fim.

    O início é gravado na hora, para a execução aparecer no log mesmo que o processo morra.
    Se o bloco terminar bem, os dados e o status final são confirmados juntos; se der erro,
    os dados do bloco são desfeitos e a execução fica como falha.

    O bloco registra cada item que falhou com `anotar_falha`. Fica parcial a execução com
    item que falhou ou com `erro` preenchido (interrompida no meio, por exemplo num 429).
    """
    execucao = ExecucaoColeta(tipo=tipo)
    sessao.add(execucao)
    sessao.commit()

    try:
        yield execucao
    except Exception as erro:
        sessao.rollback()
        execucao.status = StatusExecucao.FALHA
        execucao.erro = f"{type(erro).__name__}: {erro}"
        execucao.finalizada_em = func.clock_timestamp()
        sessao.commit()
        raise

    execucao.itens_falha = len(execucao.falhas)
    incompleta = execucao.itens_falha or execucao.erro
    execucao.status = StatusExecucao.PARCIAL if incompleta else StatusExecucao.SUCESSO
    # clock_timestamp(), não now(): no Postgres o now() é a hora em que a transação começou,
    # e a transação do bloco começa logo depois do registro do início.
    execucao.finalizada_em = func.clock_timestamp()
    sessao.commit()


def anotar_falha(execucao: ExecucaoColeta, appid: int, market_hash_name: str, motivo: str) -> None:
    execucao.falhas.append(
        FalhaColeta(appid=appid, market_hash_name=market_hash_name, motivo=motivo)
    )
