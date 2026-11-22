from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import ModeloAtivo, ModeloVersao


def _versao(sessao: Session, id_: str, horizonte: int, nome: str, metadados: dict) -> ModeloVersao:
    versao = ModeloVersao(
        id=id_,
        nome=nome,
        horizonte=horizonte,
        meia_janela=2,
        artefato=f"{id_}/price_model.joblib",
        sha256=id_.ljust(64, "0"),
        metadados=metadados,
    )
    sessao.add(versao)
    sessao.flush()
    return versao


def test_sem_modelo_ativo_devolve_lista_vazia(cliente: TestClient) -> None:
    resposta = cliente.get("/modelos/ativos")

    assert resposta.status_code == 200
    assert resposta.json() == []


def test_devolve_metricas_do_modelo_da_versao_ativa(sessao: Session, cliente: TestClient) -> None:
    metadados = {
        "trained_at": "2026-11-22T12:00:00Z",
        "metrics": {
            "test": [
                {"model": "ingenuo", "MAPE_%": 11.0, "acerto_preco_%": 80.0},
                {
                    "model": "lightgbm",
                    "MAPE_%": 8.58,
                    "acerto_preco_%": 89.7,
                    "acerto_direcao_%": 74.1,
                },
            ],
            "interval_test": {"coverage": 0.76},
        },
    }
    _versao(sessao, "v7", 7, "lightgbm", metadados)
    _versao(sessao, "v30", 30, "hgb", {})
    sessao.add_all(
        [ModeloAtivo(horizonte=30, modelo_id="v30"), ModeloAtivo(horizonte=7, modelo_id="v7")]
    )
    sessao.flush()

    resposta = cliente.get("/modelos/ativos").json()

    assert [m["horizonte"] for m in resposta] == [7, 30]
    sete = resposta[0]
    assert sete["versao"] == "v7"
    assert sete["mape_pct"] == 8.58
    assert sete["acerto_preco_pct"] == 89.7
    assert sete["acerto_direcao_pct"] == 74.1
    assert sete["cobertura_intervalo"] == 0.76
    assert sete["treinado_em"] == "2026-11-22T12:00:00Z"
    # Versão sem métricas registradas: campos nulos, sem erro.
    assert resposta[1]["mape_pct"] is None
