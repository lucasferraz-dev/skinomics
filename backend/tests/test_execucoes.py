from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.coleta.execucao import anotar_falha, registrar_execucao
from app.coleta.execucoes import Taxa, falhas_recorrentes, taxa_sem_falha, ultimas_execucoes
from app.models import ExecucaoColeta, StatusExecucao, TipoColeta

ONTEM = datetime.now(UTC) - timedelta(days=1)


def _execucao(
    sessao: Session,
    status: StatusExecucao,
    tipo: TipoColeta = TipoColeta.PRECOS,
    iniciada_em: datetime | None = None,
    falhas: tuple[str, ...] = (),
) -> ExecucaoColeta:
    execucao = ExecucaoColeta(
        tipo=tipo, status=status, iniciada_em=iniciada_em or datetime.now(UTC)
    )
    for nome in falhas:
        anotar_falha(execucao, 440, nome, f"motivo de {nome} na {status.value}")
    sessao.add(execucao)
    sessao.flush()
    return execucao


def test_taxa_conta_parcial_como_sem_falha_e_ignora_importacao_e_em_andamento(
    sessao: Session,
) -> None:
    for status in (StatusExecucao.SUCESSO, StatusExecucao.SUCESSO, StatusExecucao.PARCIAL):
        _execucao(sessao, status)
    _execucao(sessao, StatusExecucao.FALHA, tipo=TipoColeta.CATALOGO)
    _execucao(sessao, StatusExecucao.FALHA, tipo=TipoColeta.IMPORTACAO)
    _execucao(sessao, StatusExecucao.EM_ANDAMENTO)
    _execucao(sessao, StatusExecucao.FALHA, iniciada_em=ONTEM - timedelta(days=60))

    taxa = taxa_sem_falha(sessao, desde=ONTEM)

    assert taxa == Taxa(sucesso=2, parcial=1, falha=1)
    assert taxa.sem_falha == pytest.approx(0.75)


def test_taxa_sem_execucoes_nao_tem_valor(sessao: Session) -> None:
    assert taxa_sem_falha(sessao, desde=datetime.now(UTC) + timedelta(days=1)).sem_falha is None


def test_falha_recorrente_aparece_com_o_motivo_mais_recente(sessao: Session) -> None:
    _execucao(sessao, StatusExecucao.PARCIAL, falhas=("Caixa", "Chapéu"))
    _execucao(sessao, StatusExecucao.PARCIAL, falhas=("Caixa",))
    _execucao(sessao, StatusExecucao.SUCESSO)
    _execucao(
        sessao, StatusExecucao.PARCIAL, falhas=("Caixa",), iniciada_em=ONTEM - timedelta(days=60)
    )

    recorrentes = falhas_recorrentes(sessao, desde=ONTEM)

    # O Chapéu falhou uma vez só; a falha antiga da Caixa ficou fora do período.
    assert [(r.market_hash_name, r.execucoes) for r in recorrentes] == [("Caixa", 2)]
    assert recorrentes[0].ultimo_motivo == "motivo de Caixa na parcial"


def test_execucao_registra_as_falhas_e_fica_parcial(sessao: Session) -> None:
    with registrar_execucao(sessao, TipoColeta.PRECOS) as execucao:
        execucao.itens_ok = 3
        anotar_falha(execucao, 440, "Caixa", "HTTPStatusError: 500")

    assert execucao.status is StatusExecucao.PARCIAL
    assert execucao.itens_falha == 1
    assert ultimas_execucoes(sessao, 1)[0].falhas[0].motivo == "HTTPStatusError: 500"


def test_execucao_sem_falhas_e_sem_erro_e_sucesso(sessao: Session) -> None:
    with registrar_execucao(sessao, TipoColeta.PRECOS) as execucao:
        execucao.itens_ok = 3

    assert (execucao.status, execucao.itens_falha) == (StatusExecucao.SUCESSO, 0)


def test_fim_da_execucao_e_a_hora_real_e_nao_a_do_inicio_da_transacao(sessao: Session) -> None:
    with registrar_execucao(sessao, TipoColeta.PRECOS):
        pass

    execucao = ultimas_execucoes(sessao, 1)[0]
    sessao.refresh(execucao)
    assert execucao.finalizada_em > execucao.iniciada_em
