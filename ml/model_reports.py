"""Consulta e comparação de métricas persistidas, sem carregar arquivos joblib."""

from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import Engine, text

SELECT_VERSION = """
    SELECT v.*, EXISTS (
        SELECT 1 FROM modelo_ativo a WHERE a.modelo_id = v.id AND a.horizonte = v.horizonte
    ) AS ativo FROM modelo_versao v
"""


def version_summary(record: Mapping[str, Any]) -> dict:
    metadata = record["metadados"]
    metrics = metadata.get("metrics", {})
    selected = next(
        (row for row in metrics.get("test", []) if row.get("model") == record["nome"]), {}
    )
    return {
        "version_id": record["id"],
        "model": record["nome"],
        "horizon": record["horizonte"],
        "target_half_window": record["meia_janela"],
        "active": record["ativo"],
        "registered_at": record["criado_em"].isoformat(),
        "trained_at": metadata.get("trained_at"),
        "test_start": metadata.get("test_start"),
        "test_end": metadata.get("test_end"),
        "metrics": selected,
        "evaluation": metadata.get("evaluation", {}),
    }


def list_versions(engine: Engine, *, horizon: int | None = None, limit: int = 20) -> list[dict]:
    if limit < 1 or horizon is not None and horizon < 1:
        raise ValueError("Limite e horizonte devem ser positivos.")
    where = " WHERE v.horizonte = :horizon" if horizon is not None else ""
    with engine.connect() as connection:
        rows = connection.execute(
            text(SELECT_VERSION + where + " ORDER BY v.criado_em DESC, v.id DESC LIMIT :limit"),
            {"horizon": horizon, "limit": limit},
        ).mappings()
        return [version_summary(row) for row in rows]


def show_version(engine: Engine, version_id: str) -> dict:
    with engine.connect() as connection:
        record = (
            connection.execute(text(SELECT_VERSION + " WHERE v.id = :id"), {"id": version_id})
            .mappings()
            .first()
        )
    if record is None:
        raise ValueError(f"Versão não cadastrada: {version_id}")
    metadata = record["metadados"]
    return {
        **version_summary(record),
        "sha256": record["sha256"],
        "artifact": record["artefato"],
        "parameters": metadata.get("config", {}),
        "target": metadata.get("target"),
        "metrics_cv": metadata.get("metrics", {}).get("cv", []),
        "metrics_test": metadata.get("metrics", {}).get("test", []),
        "price_ranges": [
            row
            for row in metadata.get("metrics", {}).get("price_ranges", [])
            if row.get("model") == record["nome"]
        ],
    }


def compare_versions(engine: Engine, version_ids: Sequence[str]) -> dict:
    if len(version_ids) < 2 or len(set(version_ids)) != len(version_ids):
        raise ValueError("Informe pelo menos duas versões diferentes para comparar.")
    versions = [show_version(engine, version_id) for version_id in version_ids]
    warnings = []
    for key, description in (
        ("horizon", "Horizontes diferentes."),
        ("target_half_window", "Janelas do alvo diferentes."),
        ("target", "Definição do alvo diferente ou ausente."),
        ("test_start", "Início do teste diferente ou ausente."),
        ("test_end", "Fim do teste diferente ou ausente."),
    ):
        values = {version[key] for version in versions}
        if None in values or len(values) != 1:
            warnings.append(description)
    fingerprints = {v["evaluation"].get("test_sha256") for v in versions}
    if None in fingerprints:
        warnings.append(
            "Há versões sem identificação do conjunto de teste; comparabilidade desconhecida."
        )
    elif len(fingerprints) != 1:
        warnings.append("Os conjuntos de teste são diferentes, mesmo que as datas coincidam.")
    tolerances = {v["evaluation"].get("price_accuracy_tolerance") for v in versions}
    if None in tolerances or len(tolerances) != 1:
        warnings.append("Tolerância de acerto de preço diferente ou não registrada.")
    bands = {v["evaluation"].get("price_band_basis") for v in versions}
    if None in bands or len(bands) != 1:
        warnings.append("Critério das faixas de preço diferente ou não registrado.")
    if any(not version["metrics"] for version in versions):
        warnings.append("Há versões sem métricas de teste do modelo selecionado.")
    return {"comparable": not warnings, "warnings": warnings, "versions": versions}


def table(headers: Sequence[str], rows: Sequence[Sequence[Any]]) -> str:
    def cell(value: Any) -> str:
        if value is None:
            return "N/D"
        if isinstance(value, float):
            return f"{value:.6g}"
        return str(value)

    cells = [[cell(value) for value in row] for row in rows]
    widths = [
        max([len(header), *(len(row[i]) for row in cells)]) for i, header in enumerate(headers)
    ]

    def line(row: Sequence[str]) -> str:
        return " | ".join(value.ljust(width) for value, width in zip(row, widths, strict=True))

    return "\n".join(
        [line(headers), "-+-".join("-" * width for width in widths), *map(line, cells)]
    )


def render_versions(versions: Sequence[dict]) -> str:
    if not versions:
        return "Nenhuma versão cadastrada para este filtro."
    return table(
        ["Versão", "Modelo", "Dias", "Ativo", "MAE USD", "MAPE %", "Acerto preço %", "Direção %"],
        [
            [
                v["version_id"],
                v["model"],
                v["horizon"],
                "sim" if v["active"] else "não",
                v["metrics"].get("MAE"),
                v["metrics"].get("MAPE_%"),
                v["metrics"].get("acerto_preco_%"),
                v["metrics"].get("acerto_direcao_%"),
            ]
            for v in versions
        ],
    )


def render_metrics(rows: Sequence[dict], *, bands: bool = False) -> str:
    if not rows:
        return "Métricas não registradas nesta versão."
    key = "faixa_usd" if bands else "model"
    return table(
        [
            "Faixa USD" if bands else "Modelo",
            "n",
            "MAE USD",
            "MAPE %",
            "Acerto preço %",
            "Direção %",
        ],
        [
            [
                r.get(key),
                r.get("n"),
                r.get("MAE"),
                r.get("MAPE_%"),
                r.get("acerto_preco_%"),
                r.get("acerto_direcao_%"),
            ]
            for r in rows
        ],
    )


def render_detail(version: dict) -> str:
    tolerance = version["evaluation"].get("price_accuracy_tolerance")
    accuracy = (
        f"Acerto de preço: erro relativo <= {100 * tolerance:g}%."
        if tolerance is not None
        else "Tolerância de acerto de preço não registrada."
    )
    return "\n".join(
        [
            render_versions([version]),
            f"Treinado em: {version['trained_at'] or 'N/D'}",
            f"Teste: {version['test_start'] or 'N/D'} .. {version['test_end'] or 'N/D'}",
            f"Horizonte: {version['horizon']} dias; "
            f"meia-janela: {version['target_half_window']} dias.",
            accuracy,
            "\nTeste — modelo selecionado, candidatos e baselines:",
            render_metrics(version["metrics_test"]),
            "\nFaixas de preço-base — modelo selecionado:",
            render_metrics(version["price_ranges"], bands=True),
        ]
    )


def render_comparison(comparison: dict) -> str:
    status = (
        "Mesmo alvo e conjunto de teste."
        if comparison["comparable"]
        else (
            "Comparação com ressalvas; não interprete a diferença de métricas como ganho direto.\n"
            + "\n".join(f"- {warning}" for warning in comparison["warnings"])
        )
    )
    return status + "\n\n" + "\n\n".join(render_detail(v) for v in comparison["versions"])
