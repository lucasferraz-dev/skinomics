"""Valida o ranking em uma amostra do teste temporal, sem publicar oportunidades antigas."""

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd

from backend.app.servicos.risco_oportunidade import PontoRisco, avaliar_risco
from ml.database import database_engine, load_history
from ml.predict import load_artifact, predict_history
from ml.train import ML_DIR, TrainingConfig, build_targets, clean_history


def evaluate_sample(artifact: dict, history: pd.DataFrame, *, sample_dates=5, top_k=10) -> dict:
    if not 1 <= sample_dates <= 30 or not 1 <= top_k <= 50:
        raise ValueError("Use de 1 a 30 datas e de 1 a 50 itens por data.")
    config = TrainingConfig(**artifact["config"])
    if not artifact.get("test_start") or not artifact.get("test_end"):
        raise ValueError("O artefato precisa identificar o período de teste temporal.")
    start, end = pd.Timestamp(artifact["test_start"]), pd.Timestamp(artifact["test_end"])
    seen_until = pd.Timestamp(artifact["refit_end"]) + pd.Timedelta(days=config.gap_days)
    if artifact.get("inference_after"):
        seen_until = max(seen_until, pd.Timestamp(artifact["inference_after"]))
    if start <= seen_until or end < start:
        raise ValueError("O teste deve ser posterior a todos os alvos usados no treino/calibração.")
    data = clean_history(history)
    history_dates = (
        pd.to_datetime(history["observation_date"], errors="coerce", utc=True)
        .dt.tz_localize(None)
        .dt.normalize()
    )
    available = sorted(
        data.loc[data["observation_date"].between(start, end), "observation_date"].unique()
    )
    if not available:
        raise ValueError("O histórico não cobre o período de teste do artefato.")
    indices = np.linspace(0, len(available) - 1, min(sample_dates, len(available)), dtype=int)
    dates = [pd.Timestamp(available[i]) for i in indices]
    targets = build_targets(data, config).set_index(["market_hash_name", "observation_date"])
    rows = []
    for cutoff in dates:
        past = data[data["observation_date"] <= cutoff]
        forecast = predict_history(artifact, history.loc[history_dates <= cutoff])
        # Seleção só usa preço, previsão e identidade disponíveis na data-base.
        selected = (
            forecast[
                forecast["data_base"].eq(cutoff)
                & forecast["preco_previsto"].gt(forecast["preco_atual"])
            ]
            .sort_values(["retorno_previsto_%", "market_hash_name"], ascending=[False, True])
            .head(top_k)
        )
        for position, row in enumerate(selected.to_dict("records"), 1):
            name = row["market_hash_name"]
            recent = past[
                past["market_hash_name"].eq(name)
                & past["observation_date"].ge(cutoff - pd.Timedelta(days=30))
            ]
            risk = avaliar_risco(
                [
                    PontoRisco(p.observation_date.date(), p.price, p.volume, bool(p.is_filled))
                    for p in recent.itertuples()
                ],
                data_base=cutoff.date(),
                preco_base=row["preco_atual"],
                preco_previsto=row["preco_previsto"],
                inferior=row["intervalo_inferior"],
                superior=row["intervalo_superior"],
                historico_curto=row["historico_curto"],
                incerteza_elevada=row["incerteza_elevada"],
            )
            actual = targets.loc[(name, cutoff), "target_price"]
            observed = pd.notna(actual)
            rows.append(
                {
                    "data_base": cutoff.date().isoformat(),
                    "item": name,
                    "posicao": position,
                    "preco_base": float(row["preco_atual"]),
                    "preco_previsto": float(row["preco_previsto"]),
                    "margem_estimada": float(row["preco_previsto"] / row["preco_atual"] - 1),
                    "risco": risk.nivel,
                    "motivos_risco": risk.motivos,
                    "preco_real": float(actual) if observed else None,
                    "margem_real": float(actual / row["preco_atual"] - 1) if observed else None,
                }
            )
    observed = [r for r in rows if r["preco_real"] is not None]
    return {
        "version_id": artifact.get("version_id"),
        "horizon": config.horizon,
        "config": asdict(config),
        "dates": [d.date().isoformat() for d in dates],
        "top_k": top_k,
        "oportunidades": len(rows),
        "avaliadas": len(observed),
        "sem_alvo_completo": len(rows) - len(observed),
        "acerto_margem_positiva": float(np.mean([r["margem_real"] > 0 for r in observed]))
        if observed
        else None,
        "mae_usd": float(np.mean([abs(r["preco_previsto"] - r["preco_real"]) for r in observed]))
        if observed
        else None,
        "mape": float(np.mean([abs(r["preco_previsto"] / r["preco_real"] - 1) for r in observed]))
        if observed
        else None,
        "margem_real_media": float(np.mean([r["margem_real"] for r in observed]))
        if observed
        else None,
        "por_risco": {
            risk: {
                "avaliadas": len(group),
                "acerto_margem_positiva": float(np.mean([r["margem_real"] > 0 for r in group]))
                if group
                else None,
            }
            for risk in ("baixo", "moderado", "alto")
            for group in [[r for r in observed if r["risco"] == risk]]
        },
        "limitacoes": (
            "Amostra retrospectiva do universo disponível; preços conhecidos ao fechamento, "
            "sem taxas, spread, execução ou reconstrução do catálogo histórico. "
            "Não é uma simulação de lucro realizável."
        ),
        "rows": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", required=True, type=Path)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--data", type=Path, default=ML_DIR / "data" / "tf2_historico.csv")
    source.add_argument("--database", action="store_true")
    parser.add_argument("--sample-dates", type=int, default=5)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    try:
        if args.database:
            engine = database_engine()
            try:
                with engine.connect() as connection:
                    history = load_history(connection)
            finally:
                engine.dispose()
        else:
            history = pd.read_csv(args.data)
        result = evaluate_sample(
            load_artifact(args.artifact), history, sample_dates=args.sample_dates, top_k=args.top_k
        )
        output = args.output_dir or ML_DIR / "artifacts" / "opportunities" / str(uuid4())
        output.mkdir(parents=True, exist_ok=False)
        rows = result.pop("rows")
        (output / "summary.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        pd.DataFrame(rows).to_csv(output / "sample.csv", index=False)
        print(json.dumps({"output": str(output.resolve()), **result}, ensure_ascii=False, indent=2))
    except (ValueError, OSError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
