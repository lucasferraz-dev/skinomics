"""Consulta o log dos coletores: últimas execuções, taxa sem falha e itens que falham sempre.

Uso, dentro de backend/:
    uv run python -m app.coleta.execucoes [--dias 30] [--ultimas 10] [--execucao ID]

A taxa considera só a coleta (catálogo e preços); a importação de CSV fica de fora, como
em TipoColeta. A meta do M1 é ≥ 95% das execuções sem falha.
"""

import argparse
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import SessionLocal
from app.models import ExecucaoColeta, FalhaColeta, StatusExecucao, TipoColeta

META_SEM_FALHA = 0.95
COLETA = (TipoColeta.CATALOGO, TipoColeta.PRECOS)


@dataclass(frozen=True)
class Taxa:
    sucesso: int
    parcial: int
    falha: int

    @property
    def total(self) -> int:
        return self.sucesso + self.parcial + self.falha

    @property
    def sem_falha(self) -> float | None:
        """Parcial conta como sem falha: a execução rodou e gravou, só não todos os itens."""
        return (self.sucesso + self.parcial) / self.total if self.total else None


@dataclass(frozen=True)
class FalhaRecorrente:
    appid: int
    market_hash_name: str
    execucoes: int
    ultimo_motivo: str


def taxa_sem_falha(sessao: Session, desde: datetime) -> Taxa:
    """Execuções de coleta encerradas desde a data; as em andamento ainda não contam."""
    contagem = dict(
        sessao.execute(
            select(ExecucaoColeta.status, func.count())
            .where(ExecucaoColeta.tipo.in_(COLETA), ExecucaoColeta.iniciada_em >= desde)
            .group_by(ExecucaoColeta.status)
        ).all()
    )
    return Taxa(
        sucesso=contagem.get(StatusExecucao.SUCESSO, 0),
        parcial=contagem.get(StatusExecucao.PARCIAL, 0),
        falha=contagem.get(StatusExecucao.FALHA, 0),
    )


def ultimas_execucoes(sessao: Session, quantas: int) -> Sequence[ExecucaoColeta]:
    return sessao.scalars(
        select(ExecucaoColeta)
        .options(selectinload(ExecucaoColeta.falhas))
        .order_by(ExecucaoColeta.id.desc())
        .limit(quantas)
    ).all()


def falhas_recorrentes(sessao: Session, desde: datetime, minimo: int = 2) -> list[FalhaRecorrente]:
    """Itens que falharam em pelo menos `minimo` execuções desde a data, os piores primeiro."""
    por_item = (
        select(
            FalhaColeta.appid,
            FalhaColeta.market_hash_name,
            func.count(func.distinct(FalhaColeta.execucao_id)).label("execucoes"),
            func.max(FalhaColeta.id).label("ultima"),
        )
        .join(ExecucaoColeta)
        .where(ExecucaoColeta.iniciada_em >= desde)
        .group_by(FalhaColeta.appid, FalhaColeta.market_hash_name)
        .having(func.count(func.distinct(FalhaColeta.execucao_id)) >= minimo)
        .subquery()
    )
    linhas = sessao.execute(
        select(
            por_item.c.appid, por_item.c.market_hash_name, por_item.c.execucoes, FalhaColeta.motivo
        )
        .join(FalhaColeta, FalhaColeta.id == por_item.c.ultima)
        .order_by(por_item.c.execucoes.desc(), por_item.c.market_hash_name)
    ).all()
    return [FalhaRecorrente(*linha) for linha in linhas]


def _duracao(execucao: ExecucaoColeta) -> str:
    if execucao.finalizada_em is None:
        return "—"
    segundos = int((execucao.finalizada_em - execucao.iniciada_em).total_seconds())
    return f"{segundos // 60}min{segundos % 60:02d}s"


def _imprimir_execucao(execucao: ExecucaoColeta) -> None:
    inicio = execucao.iniciada_em.astimezone().strftime("%d/%m %H:%M")
    print(
        f"  #{execucao.id:<5} {inicio}  {execucao.tipo.value:<10} {execucao.status.value:<12} "
        f"{_duracao(execucao):>9}  ok {execucao.itens_ok:<5} novos {execucao.itens_novos:<4} "
        f"falhas {execucao.itens_falha}"
    )
    if execucao.erro:
        print(f"         erro: {execucao.erro[:150]}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Consulta o log dos coletores.")
    parser.add_argument("--dias", type=int, default=30, help="período da taxa (padrão: 30)")
    parser.add_argument("--ultimas", type=int, default=10, help="execuções listadas (padrão: 10)")
    parser.add_argument(
        "--execucao", type=int, metavar="ID", help="lista as falhas de uma execução"
    )
    args = parser.parse_args()

    with SessionLocal() as sessao:
        if args.execucao is not None:
            execucao = sessao.get(ExecucaoColeta, args.execucao)
            if execucao is None:
                parser.error(f"execução {args.execucao} não existe")
            _imprimir_execucao(execucao)
            for falha in execucao.falhas:
                print(f"    {falha.appid}  {falha.market_hash_name}: {falha.motivo}")
            return

        desde = datetime.now(UTC) - timedelta(days=args.dias)
        taxa = taxa_sem_falha(sessao, desde)
        print(f"Coletas nos últimos {args.dias} dias: {taxa.total}")
        if taxa.sem_falha is not None:
            situacao = "atinge a" if taxa.sem_falha >= META_SEM_FALHA else "abaixo da"
            print(
                f"  sem falha: {taxa.sem_falha:.1%} ({situacao} meta de {META_SEM_FALHA:.0%}) "
                f"— {taxa.sucesso} sucesso, {taxa.parcial} parcial, {taxa.falha} falha"
            )

        print(f"\nÚltimas {args.ultimas} execuções:")
        for execucao in ultimas_execucoes(sessao, args.ultimas):
            _imprimir_execucao(execucao)

        recorrentes = falhas_recorrentes(sessao, desde)
        if recorrentes:
            print(f"\nItens que falharam em mais de uma execução nos últimos {args.dias} dias:")
            for item in recorrentes:
                print(
                    f"  {item.execucoes}x  {item.market_hash_name} ({item.appid}): "
                    f"{item.ultimo_motivo[:100]}"
                )


if __name__ == "__main__":
    main()
