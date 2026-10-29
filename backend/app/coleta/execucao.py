from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import ExecucaoColeta, StatusExecucao, TipoColeta


@contextmanager
def registrar_execucao(sessao: Session, tipo: TipoColeta) -> Iterator[ExecucaoColeta]:
    """Registra uma execução de coleta no log, do início ao fim.

    O início é gravado na hora, para a execução aparecer no log mesmo que o processo morra.
    Se o bloco terminar bem, os dados e o status final são confirmados juntos; se der erro,
    os dados do bloco são desfeitos e a execução fica como falha.
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
        execucao.finalizada_em = func.now()
        sessao.commit()
        raise

    execucao.status = StatusExecucao.PARCIAL if execucao.itens_falha else StatusExecucao.SUCESSO
    execucao.finalizada_em = func.now()
    sessao.commit()
