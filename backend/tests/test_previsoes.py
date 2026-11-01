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
    assert data["intervalo_inferior"] is None
    assert data["intervalo_superior"] is None
    assert data["nivel_confianca"] is None


def test_sinaliza_previsao_antiga_e_historico_curto(cliente, sessao, previsao):
    item, forecast = previsao
    forecast.data_base -= timedelta(days=4)
    forecast.historico_curto = True
    sessao.flush()
    data = cliente.get(f"/itens/{item.id}/previsao").json()
    assert data["desatualizada"] is True
    assert data["historico_curto"] is True
    assert data["incerteza_elevada"] is True


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


@pytest.mark.parametrize("horizon", [7, 15, 30])
def test_horizontes_independentes_com_intervalo(cliente, sessao, previsao, horizon):
    item, forecast = previsao
    active = sessao.get(ModeloAtivo, 7)
    model = sessao.get(ModeloVersao, forecast.modelo_id)
    active.horizonte = model.horizonte = horizon
    model.metadados = {"metrics": {"interval_test": {"coverage": 0.75}}}
    forecast.intervalo_inferior = 2
    forecast.intervalo_superior = 3.5
    forecast.nivel_confianca = 0.8
    forecast.incerteza_elevada = True
    sessao.flush()
    response = cliente.get(f"/itens/{item.id}/previsao?horizonte={horizon}")
    assert response.status_code == 200
    data = response.json()
    assert data["horizonte"] == horizon
    assert data["data_alvo"] == (forecast.data_base + timedelta(days=horizon)).isoformat()
    assert data["janela_inicio"] == (forecast.data_base + timedelta(days=horizon - 2)).isoformat()
    assert data["intervalo_inferior"] == 2
    assert data["intervalo_superior"] == 3.5
    assert data["nivel_confianca"] == 0.8
    assert data["cobertura_teste"] == 0.75
    assert data["incerteza_elevada"] is True
    other = 15 if horizon == 7 else 7
    assert (
        cliente.get(f"/itens/{item.id}/previsao?horizonte={other}").json()["motivo"]
        == "sem_modelo_ativo"
    )


@pytest.mark.parametrize("horizon", [8, 14, 29, 31, "abc"])
def test_rejeita_horizontes_nao_suportados(cliente, previsao, horizon):
    item, _ = previsao
    assert cliente.get(f"/itens/{item.id}/previsao?horizonte={horizon}").status_code == 422


@pytest.mark.parametrize(
    "low,high,level",
    [
        (3, 4, 0.8),
        (1, 2, 0.8),
        (0, 3, 0.8),
        (1, None, 0.8),
        (None, None, 0.8),
        (1, 3, None),
        (1, 3, 0.9),
    ],
)
def test_banco_rejeita_intervalos_invalidos(sessao, previsao, low, high, level):
    from sqlalchemy.exc import IntegrityError

    _, forecast = previsao
    with pytest.raises(IntegrityError), sessao.begin_nested():
        forecast.intervalo_inferior = low
        forecast.intervalo_superior = high
        forecast.nivel_confianca = level
        sessao.flush()
