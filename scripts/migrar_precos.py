"""Copia o catálogo e a série de preços de um banco (origem) para outro (destino).

A série do destino é substituída inteira; itens são casados por (appid, market_hash_name), então
os IDs do destino, usados por item_acompanhado e previsao, ficam como estão. Usuários, sessões,
listas, modelos e previsões não são tocados. Sem --apply, só mostra a prévia.

    uv run --project backend --env-file .env.production python scripts/migrar_precos.py
    uv run --project backend --env-file .env.production python scripts/migrar_precos.py --apply
"""

import argparse
import os
from datetime import UTC, datetime

import psycopg

ORIGEM_PADRAO = "postgresql://skinomics:skinomics@localhost:55432/skinomics"
COLUNAS_ITEM = (
    "appid",
    "market_hash_name",
    "nome",
    "tipo",
    "qualidade",
    "raridade",
    "colecao",
    "icon_url",
    "ativo",
)
CONSULTA_KEY = (
    "select p.data, p.preco from preco_diario p join item i on i.id = p.item_id "
    "where i.market_hash_name = 'Mann Co. Supply Crate Key' order by p.data desc limit 1"
)


def url_psycopg(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://")


def resumo(conn: psycopg.Connection) -> str:
    itens, precos = conn.execute(
        "select (select count(*) from item), (select count(*) from preco_diario)"
    ).fetchone()
    key = conn.execute(CONSULTA_KEY).fetchone()
    key_txt = f"Key {key[1]} em {key[0]}" if key else "sem Key"
    return f"{itens} itens, {precos} preços, {key_txt}"


def migrar(origem: str, destino: str, aplicar: bool) -> None:
    with psycopg.connect(url_psycopg(origem)) as src:
        versao_src = src.execute("select version_num from alembic_version").fetchone()[0]
        print(f"Origem : {resumo(src)}")
        itens = src.execute(
            f"select id, {', '.join(COLUNAS_ITEM)} from item order by id"
        ).fetchall()
        precos = src.execute(
            "select item_id, data, preco, volume, preenchido, coletado_em from preco_diario"
        ).fetchall()

    with psycopg.connect(url_psycopg(destino)) as dst:
        versao_dst = dst.execute("select version_num from alembic_version").fetchone()[0]
        if versao_src != versao_dst:
            raise SystemExit(f"Migrações diferentes: origem {versao_src}, destino {versao_dst}.")
        print(f"Destino: {resumo(dst)}")
        existentes = {r[0] for r in dst.execute("select market_hash_name from item")}
        novos = [i[2] for i in itens if i[2] not in existentes]
        print(f"Itens que entram no catálogo do destino: {novos or 'nenhum'}")
        if not aplicar:
            print("Prévia apenas; nada foi gravado. Repita com --apply.")
            return

        with dst.transaction():
            mapa = {}
            sets = ", ".join(f"{c} = excluded.{c}" for c in COLUNAS_ITEM[2:])
            for id_src, *valores in itens:
                mapa[id_src] = dst.execute(
                    f"insert into item ({', '.join(COLUNAS_ITEM)}) "
                    f"values ({', '.join(['%s'] * len(COLUNAS_ITEM))}) "
                    f"on conflict (appid, market_hash_name) do update set {sets}, "
                    "atualizado_em = now() returning id",
                    valores,
                ).fetchone()[0]
            dst.execute("delete from preco_diario")
            with dst.cursor().copy(
                "copy preco_diario (item_id, data, preco, volume, preenchido, coletado_em) "
                "from stdin"
            ) as copy:
                for item_id, *resto in precos:
                    copy.write_row((mapa[item_id], *resto))
            # Registrada como importação para o ml.worker saber que há preços novos.
            agora = datetime.now(UTC)
            dst.execute(
                "insert into execucao_coleta "
                "(tipo, status, iniciada_em, finalizada_em, itens_ok, itens_novos) "
                "values ('importacao', 'sucesso', %s, %s, %s, %s)",
                (agora, agora, len(itens), len(novos)),
            )
        print(f"Gravado. Destino: {resumo(dst)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--origem", default=ORIGEM_PADRAO, help="padrão: PostgreSQL do Docker")
    parser.add_argument(
        "--destino",
        default=os.environ.get("SKINOMICS_DATABASE_URL"),
        help="padrão: SKINOMICS_DATABASE_URL (ex.: via --env-file .env.production)",
    )
    parser.add_argument("--apply", action="store_true", help="grava no destino")
    args = parser.parse_args()
    if not args.destino:
        parser.error("informe --destino ou SKINOMICS_DATABASE_URL")
    if url_psycopg(args.destino) == url_psycopg(args.origem):
        parser.error("origem e destino são o mesmo banco")
    migrar(args.origem, args.destino, args.apply)


if __name__ == "__main__":
    main()
