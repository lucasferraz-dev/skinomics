"""Cadastro e ativação local de artefatos confiáveis; não expõe escrita pela API pública."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import text

from ml.database import artifact_root, database_engine


def sha256(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def resolve_artifact(record, root):
    root = Path(root).resolve()
    path = (root / record["artefato"]).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError("Artefato ausente ou fora de SKINOMICS_MODEL_DIR.")
    if sha256(path) != record["sha256"]:
        raise ValueError("O artefato foi alterado: SHA-256 diferente do registrado.")
    return path


def register_model(engine, path, root=None):
    from ml.predict import load_artifact

    path = Path(path).resolve()
    artifact = load_artifact(path)
    metadata = {key: value for key, value in artifact.items() if key != "model"}
    digest = sha256(path)
    root = Path(root or artifact_root()).resolve()
    version_id = str(UUID(metadata.get("version_id") or str(uuid4())))
    destination = root / version_id / "price_model.joblib"
    with engine.begin() as connection:
        # Cadastro repetido do mesmo arquivo retorna a versão existente.
        connection.execute(text("SELECT pg_advisory_xact_lock(440, 0)"))
        existing = connection.scalar(
            text("SELECT id FROM modelo_versao WHERE sha256 = :hash"), {"hash": digest}
        )
        if existing:
            return existing
        if connection.scalar(
            text("SELECT id FROM modelo_versao WHERE id = :id"), {"id": version_id}
        ):
            raise ValueError("Esta versão já existe com outro conteúdo; gere uma nova versão.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if sha256(destination) != digest:
                raise ValueError("A pasta da versão contém outro artefato; nada foi sobrescrito.")
        else:
            with path.open("rb") as source, destination.open("xb") as target:
                shutil.copyfileobj(source, target)
        config = metadata["config"]
        connection.execute(
            text("""
                INSERT INTO modelo_versao
                    (id, nome, horizonte, meia_janela, artefato, sha256, metadados)
                VALUES (:id, :name, :horizon, :window, :artifact, :hash, CAST(:metadata AS JSON))
            """),
            {
                "id": version_id,
                "name": metadata["model_name"],
                "horizon": config["horizon"],
                "window": config["target_half_window"],
                "artifact": destination.relative_to(root).as_posix(),
                "hash": digest,
                "metadata": json.dumps(metadata, allow_nan=False),
            },
        )
    return version_id


def active_model(connection, horizon):
    return (
        connection.execute(
            text("""
            SELECT v.* FROM modelo_ativo a JOIN modelo_versao v ON v.id = a.modelo_id
            WHERE a.horizonte = :horizon AND v.horizonte = :horizon
        """),
            {"horizon": horizon},
        )
        .mappings()
        .first()
    )


def activate_model(engine, version_id=None, *, horizon=7, rollback=False, reason, root=None):
    from ml.predict import load_artifact

    if not reason.strip():
        raise ValueError("Informe o motivo da promoção ou reversão.")
    with engine.begin() as connection:
        if not rollback:
            horizon = connection.scalar(
                text("SELECT horizonte FROM modelo_versao WHERE id = :id"), {"id": version_id}
            )
            if horizon is None:
                raise ValueError("Versão não cadastrada.")
        # Serializa as mudanças no mesmo horizonte, inclusive a leitura do anterior.
        connection.execute(text("SELECT pg_advisory_xact_lock(441, :h)"), {"h": horizon})
        previous = active_model(connection, horizon)
        if rollback:
            version_id = connection.scalar(
                text("""
                SELECT anterior_id FROM ativacao_modelo WHERE horizonte = :h
                ORDER BY id DESC LIMIT 1
            """),
                {"h": horizon},
            )
            if version_id is None:
                raise ValueError("Não existe uma versão anterior para este horizonte.")
        record = (
            connection.execute(
                text("SELECT * FROM modelo_versao WHERE id = :id"), {"id": version_id}
            )
            .mappings()
            .one()
        )
        load_artifact(resolve_artifact(record, root or artifact_root()))
        if previous and previous["id"] == version_id:
            return version_id
        connection.execute(
            text("""
            INSERT INTO modelo_ativo (horizonte, modelo_id) VALUES (:h, :id)
            ON CONFLICT (horizonte) DO UPDATE SET modelo_id = EXCLUDED.modelo_id
        """),
            {"h": horizon, "id": version_id},
        )
        connection.execute(
            text("""
            INSERT INTO ativacao_modelo (horizonte, modelo_id, anterior_id, motivo)
            VALUES (:h, :id, :previous, :reason)
        """),
            {
                "h": horizon,
                "id": version_id,
                "previous": previous["id"] if previous else None,
                "reason": reason,
            },
        )
    return version_id


def main():
    parser = argparse.ArgumentParser(description="Registra, promove ou reverte modelos locais.")
    commands = parser.add_subparsers(dest="command", required=True)
    register = commands.add_parser("register")
    register.add_argument("artifact", type=Path)
    activate = commands.add_parser("activate")
    activate.add_argument("version")
    activate.add_argument("--reason", required=True)
    rollback = commands.add_parser("rollback")
    rollback.add_argument("--horizon", type=int, default=7)
    rollback.add_argument("--reason", required=True)
    args = parser.parse_args()
    engine = database_engine()
    try:
        if args.command == "register":
            result = register_model(engine, args.artifact)
        else:
            result = activate_model(
                engine,
                getattr(args, "version", None),
                horizon=getattr(args, "horizon", 7),
                rollback=args.command == "rollback",
                reason=args.reason,
            )
        print(result)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
