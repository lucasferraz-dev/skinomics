from collections.abc import Callable
from datetime import UTC, date, datetime
from decimal import Decimal

import httpx2 as httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.coleta.gravacao import ItemCatalogo, PrecoDia, gravar_itens, gravar_precos
from app.coleta.historico_steam import baixar_historico, serie_diaria
from app.coleta.steam import (
    LimiteDaSteamError,
    LoginSteamError,
    MercadoSteam,
    MoedaInesperadaError,
    PontoHistorico,
)
from app.models import ExecucaoColeta, PrecoDiario, StatusExecucao

KEY = "Mann Co. Supply Crate Key"
CAIXA = "Winter 2025 Cosmetic Case"
AGORA = datetime(2026, 11, 3, 17, 0, tzinfo=UTC)


def _ponto(momento: str, preco: str, volume: int) -> PontoHistorico:
    return PontoHistorico(
        datetime.fromisoformat(momento).replace(tzinfo=UTC), Decimal(preco), volume
    )


def _resposta(precos: list, prefixo: str = "R$") -> httpx.Response:
    corpo = {"success": True, "price_prefix": prefixo, "price_suffix": "", "prices": precos}
    return httpx.Response(200, json=corpo)


def _mercado(responder: Callable[[httpx.Request], httpx.Response], esperas: list | None = None):
    cliente = httpx.Client(transport=httpx.MockTransport(responder))
    return MercadoSteam(
        cliente, intervalo=20, esperar=(esperas if esperas is not None else []).append
    )


# --- série diária -------------------------------------------------------------------------


def test_dia_e_a_media_ponderada_pelo_volume_e_a_soma_das_vendas() -> None:
    pontos = [_ponto("2026-11-01T10:00", "2.00", 30), _ponto("2026-11-01T11:00", "3.00", 10)]

    (dia,) = serie_diaria(1, pontos, datetime(2026, 11, 2, 1, tzinfo=UTC))

    assert (dia.data, dia.preco, dia.volume, dia.preenchido) == (
        date(2026, 11, 1),
        Decimal("2.2500"),
        40,
        False,
    )


def test_dia_sem_venda_repete_o_ultimo_preco_ate_ontem_e_hoje_fica_de_fora() -> None:
    pontos = [
        _ponto("2026-10-30T01:00", "1.50", 5),
        _ponto("2026-11-01T01:00", "1.70", 8),
        _ponto("2026-11-03T09:00", "9.99", 1),  # hoje: parcial
    ]

    serie = serie_diaria(1, pontos, AGORA)

    assert [(d.data.day, d.preco, d.volume, d.preenchido) for d in serie] == [
        (30, Decimal("1.5000"), 5, False),
        (31, Decimal("1.5000"), 0, True),
        (1, Decimal("1.7000"), 8, False),
        (2, Decimal("1.7000"), 0, True),
    ]
    assert all(d.coletado_em == AGORA for d in serie)


def test_item_que_so_vendeu_hoje_nao_tem_serie() -> None:
    assert serie_diaria(1, [_ponto("2026-11-03T09:00", "1.00", 1)], AGORA) == []


# --- cliente da Steam ---------------------------------------------------------------------


def test_le_o_historico_e_espera_entre_as_requisicoes() -> None:
    pedidos: list[httpx.Request] = []
    esperas: list[float] = []

    def steam(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        return _resposta([["Nov 02 2026 16: +0", 2.159, "1644"]])

    mercado = _mercado(steam, esperas)
    mercado.historico(440, KEY)
    (ponto,) = mercado.historico(440, CAIXA)

    assert ponto == PontoHistorico(datetime(2026, 11, 2, 16, tzinfo=UTC), Decimal("2.159"), 1644)
    assert pedidos[0].url.params["market_hash_name"] == KEY
    assert esperas == [20]  # só entre a primeira e a segunda


@pytest.mark.parametrize(
    ("resposta", "erro"),
    [
        (httpx.Response(429), LimiteDaSteamError),
        (httpx.Response(400, text="[]"), LoginSteamError),
        (_resposta([], prefixo="$"), MoedaInesperadaError),
    ],
)
def test_recusas_que_valem_para_a_coleta_toda(resposta: httpx.Response, erro: type) -> None:
    with pytest.raises(erro):
        _mercado(lambda _: resposta).historico(440, KEY)


def test_aceita_a_moeda_pedida() -> None:
    cliente = httpx.Client(transport=httpx.MockTransport(lambda _: _resposta([], prefixo="$")))

    assert MercadoSteam(cliente, moeda="USD", esperar=lambda _: None).historico(440, KEY) == []


# --- regravação no banco ------------------------------------------------------------------


def _catalogo(sessao: Session) -> dict[str, int]:
    ids = gravar_itens(sessao, [ItemCatalogo(440, nome, nome) for nome in (KEY, CAIXA)])
    return {nome: id_ for (_, nome), id_ in ids.items()}


def _serie(sessao: Session, item_id: int) -> dict[date, Decimal]:
    consulta = select(PrecoDiario).where(PrecoDiario.item_id == item_id)
    return {p.data: p.preco for p in sessao.scalars(consulta)}


def _ultima_execucao(sessao: Session) -> ExecucaoColeta:
    return sessao.scalars(select(ExecucaoColeta).order_by(ExecucaoColeta.id.desc())).first()


def test_troca_a_serie_inteira_do_item(sessao: Session) -> None:
    ids = _catalogo(sessao)
    # Série antiga (em reais, mais longa): nenhum dia dela pode sobrar.
    antigos = [date(2026, 10, 30), date(2026, 10, 31)]
    gravar_precos(
        sessao, [PrecoDia(ids[KEY], d, Decimal("11.00"), 9, False, AGORA) for d in antigos]
    )

    resumo = baixar_historico(
        sessao, _mercado(lambda _: _resposta([["Nov 01 2026 01: +0", 2.2, "50"]])), AGORA
    )

    assert (resumo.itens_ok, resumo.precos, resumo.falhas) == (2, 4, {})
    assert _serie(sessao, ids[KEY]) == {
        date(2026, 11, 1): Decimal("2.2000"),
        date(2026, 11, 2): Decimal("2.2000"),
    }
    assert _ultima_execucao(sessao).status is StatusExecucao.SUCESSO


def test_no_429_grava_o_que_ja_baixou_e_para(sessao: Session) -> None:
    ids = _catalogo(sessao)
    respostas = iter([_resposta([["Nov 01 2026 01: +0", 2.2, "50"]]), httpx.Response(429)])

    resumo = baixar_historico(sessao, _mercado(lambda _: next(respostas)), AGORA)

    assert resumo.itens_ok == 1
    assert resumo.falhas == {CAIXA: "não coletado"}
    assert _serie(sessao, ids[KEY])
    execucao = _ultima_execucao(sessao)
    assert execucao.status is StatusExecucao.PARCIAL
    assert "429" in execucao.erro


def test_sem_nenhum_item_coletado_a_execucao_e_falha(sessao: Session) -> None:
    ids = _catalogo(sessao)
    gravar_precos(
        sessao, [PrecoDia(ids[KEY], date(2026, 10, 30), Decimal("11.00"), 9, False, AGORA)]
    )
    sessao.commit()

    with pytest.raises(LoginSteamError):
        baixar_historico(sessao, _mercado(lambda _: httpx.Response(400, text="[]")), AGORA)

    assert _ultima_execucao(sessao).status is StatusExecucao.FALHA
    assert _serie(sessao, ids[KEY]) == {date(2026, 10, 30): Decimal("11.0000")}
