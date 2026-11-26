from datetime import UTC, date, datetime
from decimal import Decimal

from app.coleta.steam_mercado import agregar_por_dia, ler_instante, ler_pontos

COLETA = datetime(2026, 11, 1, 12, tzinfo=UTC)


def test_ler_instante_no_formato_da_steam() -> None:
    assert ler_instante("Oct 14 2026 01: +0") == datetime(2026, 10, 14, 1, tzinfo=UTC)


def test_ler_pontos_aceita_volume_com_separador_de_milhar() -> None:
    (ponto,) = ler_pontos([["Oct 14 2026 01: +0", 11.05, "1,234"]])
    assert ponto.preco == Decimal("11.05")
    assert ponto.volume == 1234


def test_preco_do_dia_e_a_media_ponderada_pelo_volume() -> None:
    pontos = ler_pontos(
        [
            ["Oct 14 2026 01: +0", 11.0, "300"],
            ["Oct 14 2026 02: +0", 10.0, "100"],
        ]
    )
    (dia,) = agregar_por_dia(19, pontos, hoje=date(2026, 10, 15), coletado_em=COLETA)
    assert dia.data == date(2026, 10, 14)
    assert dia.preco == Decimal("10.7500")
    assert dia.volume == 400
    assert not dia.preenchido


def test_dia_sem_venda_repete_o_ultimo_preco() -> None:
    pontos = ler_pontos(
        [
            ["Oct 12 2026 01: +0", 11.0, "10"],
            ["Oct 14 2026 01: +0", 12.0, "10"],
        ]
    )
    dias = agregar_por_dia(19, pontos, hoje=date(2026, 10, 15), coletado_em=COLETA)
    assert [(d.data.day, d.preco, d.volume, d.preenchido) for d in dias] == [
        (12, Decimal("11.0000"), 10, False),
        (13, Decimal("11.0000"), 0, True),
        (14, Decimal("12.0000"), 10, False),
    ]


def test_preenche_ate_ontem_e_ignora_o_dia_aberto() -> None:
    pontos = ler_pontos(
        [
            ["Oct 13 2026 01: +0", 11.0, "10"],
            ["Oct 16 2026 01: +0", 99.0, "10"],
        ]
    )
    dias = agregar_por_dia(19, pontos, hoje=date(2026, 10, 16), coletado_em=COLETA)
    assert [d.data.day for d in dias] == [13, 14, 15]
    assert all(d.preco == Decimal("11.0000") for d in dias)
