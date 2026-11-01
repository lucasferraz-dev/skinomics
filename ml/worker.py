"""Atualiza previsões após coletas concluídas e na virada do dia UTC."""

import argparse
import logging
import time

from sqlalchemy import text

from ml.database import database_engine
from ml.predict import run_batch

logger = logging.getLogger(__name__)


def tick(engine):
    with engine.connect() as connection:
        horizons = list(connection.scalars(text("SELECT horizonte FROM modelo_ativo")))
    failures = 0
    for horizon in horizons:
        try:
            result = run_batch(engine, horizon=horizon, only_pending=True)
            if result:
                logger.info("Previsões publicadas: %s", result)
        except Exception as error:
            failures += 1
            logger.error(
                "Falha no horizonte %s: %s; nova tentativa no próximo ciclo.",
                horizon,
                type(error).__name__,
            )
    return failures


def main():
    parser = argparse.ArgumentParser(description="Atualiza previsões após a coleta/importação.")
    parser.add_argument("--once", action="store_true", help="Executa somente um ciclo")
    parser.add_argument(
        "--interval", type=int, default=60, help="Intervalo de consulta em segundos"
    )
    args = parser.parse_args()
    if args.interval < 10:
        parser.error("--interval deve ser pelo menos 10 segundos.")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    engine = database_engine()
    try:
        while True:
            try:
                failures = tick(engine)
            except Exception as error:
                logger.error("Falha ao consultar modelos ativos: %s", type(error).__name__)
                failures = 1
            if args.once:
                raise SystemExit(1 if failures else 0)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
