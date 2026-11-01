"""Inferência em lote com modelo já treinado; não ajusta parâmetros nem alvos."""

import argparse
from pathlib import Path
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import text

from ml.database import artifact_root, closed_day, database_engine, latest_collection, load_history
from ml.registry import active_model, resolve_artifact
from ml.train import TrainingConfig, build_features, clean_history, make_forecast


def load_artifact(path):
    artifact = joblib.load(path)
    required = {"model", "model_name", "features", "config", "refit_end"}
    if not isinstance(artifact, dict) or not required.issubset(artifact):
        raise ValueError("Artefato inválido: modelo, features, configuração ou período ausentes.")
    TrainingConfig(**artifact["config"])
    if not callable(getattr(artifact["model"], "predict", None)):
        raise ValueError("O artefato não contém um previsor.")
    return artifact


def predict_history(artifact, history):
    config = TrainingConfig(**artifact["config"])
    data = clean_history(history)
    features = build_features(data)
    if list(features.columns) != artifact["features"]:
        raise ValueError("Features do artefato incompatíveis com o código de inferência.")
    data = data.drop(columns="is_filled").join(features)
    latest = data.groupby("market_hash_name").tail(1).copy()
    # Não publica uma previsão histórica que usaria preços futuros vistos no treinamento.
    last_training_target = pd.Timestamp(artifact["refit_end"]) + pd.Timedelta(days=config.gap_days)
    latest = latest[latest["observation_date"] >= last_training_target]
    if latest.empty:
        raise ValueError("Nenhum item tem dados posteriores ao período de treinamento do modelo.")
    forecast = make_forecast(artifact["model"], latest, artifact["features"], config)
    prices = forecast["preco_previsto"].to_numpy()
    if not np.isfinite(prices).all() or (prices < 1e-8).any() or (prices >= 1e12).any():
        raise ValueError("O modelo gerou preços inválidos ou fora da precisão do banco.")
    return forecast


def run_batch(engine, *, horizon=7, root=None, only_pending=False):
    """Publica todo o lote em uma transação e registra erros sem perder o lote anterior."""
    with engine.connect() as connection:
        locked = connection.scalar(text("SELECT pg_try_advisory_lock(442, :h)"), {"h": horizon})
        connection.commit()
        if not locked:
            return None
        execution_id = None
        try:
            record = active_model(connection, horizon)
            if record is None:
                if only_pending:
                    return None
                raise ValueError(f"Não há modelo ativo para {horizon} dias.")
            collection_id = latest_collection(connection)
            cutoff = closed_day()
            done = connection.scalar(
                text("""
                SELECT id FROM execucao_previsao
                WHERE modelo_id = :model AND coleta_id IS NOT DISTINCT FROM :collection
                  AND data_limite = :cutoff AND status = 'sucesso' LIMIT 1
            """),
                {"model": record["id"], "collection": collection_id, "cutoff": cutoff},
            )
            # Com o lock adquirido, nenhum outro lote deste horizonte está em execução.
            connection.execute(
                text("""
                    UPDATE execucao_previsao e SET status = 'falha', finalizada_em = now(),
                        erro = 'Processo interrompido antes de concluir o lote.'
                    FROM modelo_versao v WHERE e.modelo_id = v.id
                      AND v.horizonte = :horizon AND e.status = 'em_andamento'
                """),
                {"horizon": horizon},
            )
            if only_pending and done:
                connection.commit()
                return None
            execution_id = str(uuid4())
            connection.execute(
                text("""
                INSERT INTO execucao_previsao (id, modelo_id, coleta_id, data_limite)
                VALUES (:id, :model, :collection, :cutoff)
            """),
                {
                    "id": execution_id,
                    "model": record["id"],
                    "collection": collection_id,
                    "cutoff": cutoff,
                },
            )
            connection.commit()
            # Uma consulta lê o histórico inteiro de um único snapshot do PostgreSQL.
            history = load_history(connection, cutoff)
            artifact = load_artifact(resolve_artifact(record, root or artifact_root()))
            if artifact["config"]["horizon"] != horizon:
                raise ValueError("Horizonte do artefato diferente do cadastro.")
            forecast = predict_history(artifact, history)
            catalog = history.loc[
                history["ativo"], ["item_id", "market_hash_name"]
            ].drop_duplicates()
            forecast = forecast.merge(catalog, on="market_hash_name", validate="one_to_one")
            if forecast.empty:
                raise ValueError("Não há itens ativos com histórico elegível para previsão.")
            rows = [
                {
                    "item": int(row["item_id"]),
                    "model": record["id"],
                    "date": row["data_base"].date(),
                    "base": float(row["preco_atual"]),
                    "price": float(row["preco_previsto"]),
                    "short": bool(row["historico_curto"]),
                    "execution": execution_id,
                }
                for row in forecast.to_dict("records")
            ]
            connection.execute(
                text("""
                INSERT INTO previsao
                    (item_id, modelo_id, data_base, preco_base, preco_previsto,
                     historico_curto, execucao_id)
                VALUES (:item, :model, :date, :base, :price, :short, :execution)
                ON CONFLICT (item_id, modelo_id, data_base) DO UPDATE SET
                    preco_base = EXCLUDED.preco_base, preco_previsto = EXCLUDED.preco_previsto,
                    historico_curto = EXCLUDED.historico_curto,
                    execucao_id = EXCLUDED.execucao_id, gerada_em = now()
            """),
                rows,
            )
            connection.execute(
                text("""
                UPDATE execucao_previsao SET status = 'sucesso', itens = :count,
                    finalizada_em = now() WHERE id = :id
            """),
                {"count": len(rows), "id": execution_id},
            )
            connection.commit()
            return {"id": execution_id, "modelo_id": record["id"], "itens": len(rows)}
        except Exception as error:
            connection.rollback()
            if execution_id:
                # Mensagem limitada; nunca grava a URL/credenciais da conexão no log público.
                message = (
                    str(error)
                    if isinstance(error, (ValueError, FileNotFoundError))
                    else type(error).__name__
                )
                connection.execute(
                    text("""
                    UPDATE execucao_previsao SET status = 'falha', erro = :error,
                        finalizada_em = now() WHERE id = :id
                """),
                    {"error": message[:2000], "id": execution_id},
                )
                connection.commit()
            raise
        finally:
            connection.rollback()
            connection.execute(text("SELECT pg_advisory_unlock(442, :h)"), {"h": horizon})
            connection.commit()


def main():
    parser = argparse.ArgumentParser(description="Gera previsões com um modelo já treinado.")
    parser.add_argument("--horizon", type=int, default=7)
    parser.add_argument("--data", type=Path, help="CSV; se omitido, publica a partir do banco")
    parser.add_argument("--artifact", type=Path, help="Artefato local para previsão via CSV")
    parser.add_argument("--output", type=Path, default=artifact_root() / "previsao.csv")
    args = parser.parse_args()
    if bool(args.data) != bool(args.artifact):
        parser.error("--data e --artifact devem ser usados juntos; o banco usa o modelo ativo.")
    try:
        if args.data:
            forecast = predict_history(load_artifact(args.artifact), pd.read_csv(args.data))
            args.output.parent.mkdir(parents=True, exist_ok=True)
            forecast.to_csv(args.output, index=False)
            print(f"{len(forecast)} previsões salvas em {args.output}.")
        else:
            engine = database_engine()
            try:
                print(run_batch(engine, horizon=args.horizon))
            finally:
                engine.dispose()
    except (ValueError, OSError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
