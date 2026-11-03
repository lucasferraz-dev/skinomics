from fastapi.testclient import TestClient

from app.main import create_app


def test_health_retorna_ok() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "no-store"


def test_readiness_consulta_o_banco(cliente):
    response = cliente.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_readiness_falha_sem_expor_conexao(cliente, sessao, monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError

    def indisponivel(*args, **kwargs):
        raise SQLAlchemyError("detalhes internos da conexão")

    monkeypatch.setattr(sessao, "execute", indisponivel)
    response = cliente.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "banco indisponível"}
    assert response.headers["cache-control"] == "no-store"


def test_sessao_e_erro_nao_sao_cacheaveis(cliente):
    assert cliente.get("/auth/eu").headers["cache-control"] == "no-store"
    assert cliente.get("/rota-inexistente").headers["cache-control"] == "no-store"
    assert cliente.get("/auth/steam", follow_redirects=False).headers["cache-control"] == "no-store"
