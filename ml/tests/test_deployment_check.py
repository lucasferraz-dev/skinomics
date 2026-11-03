from copy import deepcopy

from scripts.check_deployment import compare, fingerprint, inspect_api


def test_comparison_ignores_ids_but_detects_model_price_and_risk_changes():
    row = {"item_id": 1, "nome": "Caixa", "preco_previsto": 2.0, "risco": "alto", "gerada_em": "a"}
    report = {
        "horizons": [{"horizon": 7, "modelo_versao": "v1", "data_base": "2026-10-14"}],
        "rankings": {7: fingerprint([row])},
    }
    other = deepcopy(report)
    other["rankings"][7] = fingerprint([{**row, "item_id": 99, "gerada_em": "b"}])
    assert compare(report, other) == []
    other["rankings"][7][0]["risco"] = "baixo"
    assert compare(report, other)
    other = deepcopy(report)
    other["horizons"][0]["modelo_versao"] = "v2"
    assert compare(report, other)


def test_diagnosis_detects_missing_horizons_and_interval(monkeypatch):
    def read(url):
        if url.endswith("openapi.json"):
            return {"paths": {"/oportunidades": {}}, "info": {"version": "0.3.0"}}, {}
        if url.endswith("health"):
            return {"status": "ok"}, {}
        if "/previsao?" in url:
            return {"modelo_versao": "v1", "nivel_confianca": None}, {}
        horizon = int(url.split("horizonte=")[1].split("&")[0])
        return {
            "modelo_versao": "v1" if horizon == 7 else None,
            "total": 1 if horizon == 7 else 0,
            "data_base": "2026-10-14",
            "motivo": None if horizon == 7 else "sem_modelo_ativo",
            "itens": [{"item_id": 1, "nome": "Caixa"}] if horizon == 7 else [],
        }, {}

    monkeypatch.setattr("scripts.check_deployment.read_json", read)
    report = inspect_api("https://example.test/api")
    assert len(report["errors"]) == 3
    assert any("80%" in error for error in report["errors"])
    assert any("15 dias" in error for error in report["errors"])
    assert any("30 dias" in error for error in report["errors"])
