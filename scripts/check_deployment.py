"""Confere o proxy Vercel, os três horizontes e a paridade com outra API, sem escrita."""

import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def read_json(url):
    try:
        with urlopen(url, timeout=30) as response:
            if "application/json" not in response.headers.get("Content-Type", ""):
                raise ValueError(
                    "Resposta HTML em uma rota de API; confira proxy e proteção do deploy."
                )
            return json.load(response), response.headers
    except HTTPError as error:
        raise ValueError(f"API respondeu HTTP {error.code}.") from None
    except (URLError, TimeoutError):
        raise ValueError("API inacessível ou tempo limite excedido.") from None


def fingerprint(rows):
    """IDs locais e horários de execução podem diferir mesmo com previsões iguais."""
    ignored = {"item_id", "gerada_em", "icon_url", "tipo", "motivos_risco"}
    return [{key: value for key, value in row.items() if key not in ignored} for row in rows]


def inspect_api(base):
    base = base.rstrip("/")
    result = {"api": base, "errors": [], "warnings": [], "horizons": [], "rankings": {}}
    schema, headers = read_json(base + "/openapi.json")
    if "no-store" not in headers.get("Cache-Control", ""):
        result["warnings"].append("API sem Cache-Control: no-store.")
    if "/oportunidades" not in schema.get("paths", {}):
        raise ValueError("Backend desatualizado: rota de oportunidades ausente.")
    result["api_version"] = schema.get("info", {}).get("version")
    read_json(base + "/health")
    if "/health/ready" in schema["paths"]:
        read_json(base + "/health/ready")
    else:
        result["warnings"].append("Backend ainda sem verificação de conexão com o banco.")
    for horizon in (7, 15, 30):
        ranking, _ = read_json(base + f"/oportunidades?horizonte={horizon}&por_pagina=50")
        entry = {key: ranking[key] for key in ("total", "modelo_versao", "data_base", "motivo")}
        entry["horizon"] = horizon
        result["horizons"].append(entry)
        if not ranking["modelo_versao"]:
            result["errors"].append(f"Sem modelo ativo de {horizon} dias.")
            continue
        if ranking["motivo"] == "aguardando_previsoes":
            result["errors"].append(f"Sem previsões compatíveis para {horizon} dias.")
        rows = list(ranking["itens"])
        for page in range(2, (ranking["total"] + 49) // 50 + 1):
            extra, _ = read_json(
                base + f"/oportunidades?horizonte={horizon}&por_pagina=50&pagina={page}"
            )
            if extra["modelo_versao"] != ranking["modelo_versao"]:
                raise ValueError(
                    "Modelo mudou durante a consulta; execute o diagnóstico novamente."
                )
            rows.extend(extra["itens"])
        result["rankings"][horizon] = fingerprint(rows)
        if rows:
            item = rows[0]
            prediction, _ = read_json(
                base + f"/itens/{item['item_id']}/previsao?horizonte={horizon}"
            )
            entry["confidence"] = prediction.get("nivel_confianca")
            if prediction.get("modelo_versao") != ranking["modelo_versao"]:
                result["errors"].append(
                    f"Modelo divergente entre item e ranking de {horizon} dias."
                )
            if prediction.get("nivel_confianca") != 0.8:
                result["errors"].append(f"Intervalo de 80% ausente na amostra de {horizon} dias.")
        if ranking.get("itens_desatualizados"):
            result["warnings"].append(
                f"Cenário de {horizon} dias usa dados históricos identificados."
            )
    return result


def compare(reference, target):
    errors = []
    for first, second in zip(reference["horizons"], target["horizons"], strict=True):
        horizon = first["horizon"]
        if first != second or reference["rankings"].get(horizon) != target["rankings"].get(horizon):
            errors.append(f"Modelos, datas ou resultados diferentes em {horizon} dias.")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", required=True, help="URL pública do frontend Vercel")
    parser.add_argument("--api", help="API de origem para comparar com o proxy /api")
    parser.add_argument("--compare-to", help="Outra API, por exemplo http://127.0.0.1:8081")
    args = parser.parse_args()
    try:
        for route in ("/", "/oportunidades"):
            with urlopen(args.site.rstrip("/") + route, timeout=30) as response:
                if "text/html" not in response.headers.get("Content-Type", ""):
                    raise ValueError("Frontend sem página HTML; confira o fallback da SPA.")
        report = inspect_api(args.site.rstrip("/") + "/api")
        for other in (args.api, args.compare_to):
            if other:
                check = inspect_api(other)
                report["errors"].extend(check["errors"])
                report["errors"].extend(compare(report, check))
        report.pop("rankings")
    except (ValueError, KeyError, URLError, TimeoutError) as error:
        parser.exit(1, f"Falha no diagnóstico: {error}\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
