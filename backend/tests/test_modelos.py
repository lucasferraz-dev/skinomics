from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import ExecucaoColeta, Item, PrecoDiario, StatusExecucao, TipoColeta

TF2 = 440


def _item(sessao: Session, market_hash_name: str = "Mann Co. Supply Crate Key") -> Item:
    item = Item(appid=TF2, market_hash_name=market_hash_name, nome=market_hash_name)
    sessao.add(item)
    sessao.flush()
    return item


def _preco(item: Item, dia: date, preco: str = "2.25", volume: int = 100) -> PrecoDiario:
    return PrecoDiario(
        item_id=item.id, data=dia, preco=Decimal(preco), volume=volume, preenchido=False
    )


def test_item_novo_vem_ativo(sessao: Session) -> None:
    item = _item(sessao)
    sessao.refresh(item)

    assert item.ativo is True
    assert item.criado_em is not None


def test_item_duplicado_no_mesmo_jogo_e_rejeitado(sessao: Session) -> None:
    _item(sessao)

    with pytest.raises(IntegrityError, match="uq_item_appid_market_hash_name"):
        _item(sessao)


def test_preco_duplicado_no_mesmo_dia_e_rejeitado(sessao: Session) -> None:
    item = _item(sessao)
    sessao.add(_preco(item, date(2026, 10, 1)))
    sessao.flush()

    sessao.add(_preco(item, date(2026, 10, 1), preco="2.30"))
    with pytest.raises(IntegrityError, match="pk_preco_diario"):
        sessao.flush()


def test_mesmo_item_em_dias_diferentes_e_aceito(sessao: Session) -> None:
    item = _item(sessao)
    sessao.add_all([_preco(item, date(2026, 10, 1)), _preco(item, date(2026, 10, 2))])
    sessao.flush()

    assert sessao.query(PrecoDiario).filter_by(item_id=item.id).count() == 2


@pytest.mark.parametrize(
    ("preco", "volume", "constraint"),
    [
        ("0", 10, "ck_preco_diario_preco_positivo"),
        ("-1.5", 10, "ck_preco_diario_preco_positivo"),
        ("2.25", -1, "ck_preco_diario_volume_nao_negativo"),
    ],
)
def test_preco_ou_volume_invalido_e_rejeitado(
    sessao: Session, preco: str, volume: int, constraint: str
) -> None:
    item = _item(sessao)
    sessao.add(_preco(item, date(2026, 10, 1), preco=preco, volume=volume))

    with pytest.raises(IntegrityError, match=constraint):
        sessao.flush()


def test_preco_de_item_inexistente_e_rejeitado(sessao: Session) -> None:
    sessao.add(
        PrecoDiario(
            item_id=999_999, data=date(2026, 10, 1), preco=Decimal("1"), volume=1, preenchido=False
        )
    )

    with pytest.raises(IntegrityError, match="fk_preco_diario_item_id_item"):
        sessao.flush()


def test_execucao_nova_comeca_em_andamento_e_zerada(sessao: Session) -> None:
    execucao = ExecucaoColeta(tipo=TipoColeta.PRECOS)
    sessao.add(execucao)
    sessao.flush()
    sessao.refresh(execucao)

    assert execucao.status is StatusExecucao.EM_ANDAMENTO
    assert (execucao.itens_ok, execucao.itens_falha) == (0, 0)
    assert execucao.iniciada_em is not None
    assert execucao.finalizada_em is None


def test_status_fora_da_lista_e_rejeitado_pelo_banco(sessao: Session) -> None:
    # SQL direto: o ORM já barraria o valor antes; aqui o alvo é o CHECK do banco.
    with pytest.raises(IntegrityError, match="ck_execucao_coleta_status_execucao"):
        sessao.execute(
            text("insert into execucao_coleta (tipo, status) values ('precos', 'quebrado')")
        )
