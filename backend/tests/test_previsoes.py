from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.models import ExecucaoPrevisao, Item, ModeloAtivo, ModeloVersao, PrecoDiario, Previsao


@pytest.fixture
def previsao(sessao):
    item = Item(appid=440, market_hash_name="Case", nome="Case")
    model = ModeloVersao(
        id=str(uuid4()),
        nome="ema_10",
        horizonte=7,
        meia_janela=2,
        artefato="teste/model.joblib",
        sha256="a" * 64,
        metadados={},
    )
    sessao.add_all([item, model])
    sessao.flush()
    execution = ExecucaoPrevisao(
        id=str(uuid4()), modelo_id=model.id, data_limite=datetime.now(UTC).date(), status="sucesso"
    )
    sessao.add(execution)
    sessao.flush()
    sessao.add(ModeloAtivo(horizonte=7, modelo_id=model.id))
    forecast = Previsao(
        item_id=item.id,
        modelo_id=model.id,
        data_base=datetime.now(UTC).date() - timedelta(days=1),
        preco_base=2,
        preco_previsto=2.5,
        historico_curto=False,
        execucao_id=execution.id,
    )
    sessao.add(forecast)
    sessao.flush()
    return item, forecast


def test_previsao_retorna_janela_moeda_variacao_e_versao(cliente, previsao):
    item, forecast = previsao
    response = cliente.get(f"/itens/{item.id}/previsao")
    assert response.status_code == 200
    data = response.json()
    assert data["disponivel"] is True
    assert data["moeda"] == "USD"
    assert data["variacao_prevista"] == 0.25
    assert data["modelo_versao"] == forecast.modelo_id
    assert data["janela_inicio"] == (forecast.data_base + timedelta(days=5)).isoformat()
    assert data["janela_fim"] == (forecast.data_base + timedelta(days=9)).isoformat()
    assert data["desatualizada"] is False


def test_sinaliza_previsao_antiga_e_historico_curto(cliente, sessao, previsao):
    item, forecast = previsao
    forecast.data_base -= timedelta(days=4)
    forecast.historico_curto = True
    sessao.flush()
    data = cliente.get(f"/itens/{item.id}/previsao").json()
    assert data["desatualizada"] is True
    assert data["historico_curto"] is True


def test_ignora_dia_parcial_ao_verificar_atualizacao(cliente, sessao, previsao):
    item, _ = previsao
    sessao.add(
        PrecoDiario(
            item_id=item.id,
            data=datetime.now(UTC).date(),
            preco=3,
            volume=1,
            preenchido=False,
        )
    )
    sessao.flush()
    assert cliente.get(f"/itens/{item.id}/previsao").json()["desatualizada"] is False


def test_nao_publica_previsao_de_versao_inativa(cliente, sessao, previsao):
    item, _ = previsao
    model = ModeloVersao(
        id=str(uuid4()),
        nome="hgb",
        horizonte=7,
        meia_janela=0,
        artefato="novo/model.joblib",
        sha256="b" * 64,
        metadados={},
    )
    sessao.add(model)
    sessao.flush()
    sessao.get(ModeloAtivo, 7).modelo_id = model.id
    sessao.flush()
    data = cliente.get(f"/itens/{item.id}/previsao").json()
    assert data["disponivel"] is False
    assert data["motivo"] == "aguardando_previsao"
    assert data["modelo_versao"] == model.id
    assert data["preco_previsto"] is None


def test_horizonte_sem_modelo_e_item_inexistente(cliente, previsao):
    item, _ = previsao
    data = cliente.get(f"/itens/{item.id}/previsao?horizonte=30").json()
    assert data["motivo"] == "sem_modelo_ativo"
    assert cliente.get("/itens/999999/previsao").status_code == 404
    assert cliente.get(f"/itens/{item.id}/previsao?horizonte=0").status_code == 422
