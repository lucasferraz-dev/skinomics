"""Publicação dos três horizontes no banco da API, usando artefatos já avaliados."""

import argparse
import json
import os
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from ml.database import artifact_root, database_engine, load_history
from ml.predict import load_artifact, predict_history, run_batch
from ml.registry import activate_models, active_model, register_model, sha256


def prepare(engine, paths):
    """Prévia sem escrita: valida artefatos e inferência antes de mudar o ambiente."""
    artifacts = {}
    for path in paths:
        artifact = load_artifact(path)
        horizon = artifact["config"]["horizon"]
        if horizon in artifacts:
            raise ValueError(f"Artefato repetido para {horizon} dias.")
        if not artifact.get("version_id") or not artifact.get("interval"):
            raise ValueError("Use versões identificadas com intervalo calibrado de 80%.")
        artifacts[horizon] = (Path(path), artifact)
    if set(artifacts) != {7, 15, 30}:
        raise ValueError("Informe exatamente um artefato para cada horizonte: 7, 15 e 30 dias.")
    with engine.connect() as connection:
        history = load_history(connection)
        active_names = set(history.loc[history["ativo"], "market_hash_name"])
        plan = []
        for horizon, (path, artifact) in sorted(artifacts.items()):
            forecast = predict_history(artifact, history)
            forecast = forecast[forecast["market_hash_name"].isin(active_names)]
            if forecast.empty:
                raise ValueError(f"Sem itens elegíveis para {horizon} dias.")
            previous = active_model(connection, horizon)
            plan.append(
                {
                    "horizon": horizon,
                    "version": artifact["version_id"],
                    "previous": previous["id"] if previous else None,
                    "artifact": str(path.resolve()),
                    "sha256": sha256(path),
                    "items": len(forecast),
                    "base_from": str(forecast["data_base"].min().date()),
                    "base_to": str(forecast["data_base"].max().date()),
                    "confidence": artifact["interval"]["confidence"],
                }
            )
    return plan


def publish(engine, plan, *, reason, root=None):
    if not reason.strip():
        raise ValueError("Informe o motivo da publicação.")
    # Valida todos antes de cadastrar o primeiro; jamais importa ou sobrescreve preços.
    for entry in plan:
        if sha256(entry["artifact"]) != entry["sha256"]:
            raise ValueError("Artefato alterado após a prévia; gere uma nova prévia.")
    versions = {}
    for entry in plan:
        horizon = entry["horizon"]
        version = register_model(engine, entry["artifact"], root=root)
        result = run_batch(engine, horizon=horizon, version_id=version, root=root)
        if result is None:
            raise ValueError(f"Há outro lote de {horizon} dias em execução; tente novamente.")
        versions[horizon] = version
    # Em caso de falha anterior, a API continua consultando as versões ativas anteriores.
    activate_models(
        engine,
        versions,
        expected={e["horizon"]: e["previous"] for e in plan},
        reason=reason,
        root=root,
    )
    return versions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifacts", type=Path, nargs="+")
    parser.add_argument(
        "--apply", action="store_true", help="Publica após validar; padrão só consulta"
    )
    parser.add_argument("--reason", default="", help="Motivo registrado na promoção")
    args = parser.parse_args()
    if not os.environ.get("SKINOMICS_DATABASE_URL"):
        parser.error(
            "Defina explicitamente SKINOMICS_DATABASE_URL para escolher o banco de destino."
        )
    if args.apply and not args.reason.strip():
        parser.error("--apply exige --reason.")
    engine = database_engine()
    try:
        plan = prepare(engine, args.artifacts)
        print(json.dumps({"plan": plan}, ensure_ascii=False, indent=2))
        if args.apply:
            result = publish(engine, plan, reason=args.reason, root=artifact_root())
            print(json.dumps({"published": result}))
    except (ValueError, OSError) as error:
        parser.error(str(error))
    except SQLAlchemyError:
        parser.error("Falha ao acessar o banco de destino; confira conexão e migrações.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
