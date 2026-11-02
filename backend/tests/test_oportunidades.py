from datetime import UTC, datetime, timedelta
from decimal import Decimal
from math import exp
from uuid import uuid4

import pytest

from app.models import ExecucaoPrevisao, Item, ModeloAtivo, ModeloVersao, PrecoDiario, Previsao
from app.servicos.risco_oportunidade import PontoRisco, avaliar_risco


@pytest.fixture
def mercado(sessao):
    ontem = datetime.now(UTC).date() - timedelta(days=1)
    modelos = {}
    for horizonte in (7, 15, 30):
        modelo = ModeloVersao(
            id=str(uuid4()),
            nome="hgb",
            horizonte=horizonte,
            meia_janela=2,
            artefato=f"{horizonte}/teste.joblib",
            sha256=str(horizonte).zfill(64),
            metadados={},
        )
        sessao.add(modelo)
        sessao.flush()
        execucao = ExecucaoPrevisao(
            id=str(uuid4()), modelo_id=modelo.id, data_limite=ontem, status="sucesso"
        )
        sessao.add_all([execucao, ModeloAtivo(horizonte=horizonte, modelo_id=modelo.id)])
        sessao.flush()
        modelos[horizonte] = (modelo, execucao)

    def adicionar(nome, *, previsto=3, volume=200, atraso=0, ativo=True, appid=440, horizonte=7):
        item = Item(appid=appid, market_hash_name=nome, nome=nome, ativo=ativo)
        sessao.add(item)
        sessao.flush()
        base = ontem - timedelta(days=atraso)
        for indice in range(31):
            dia = base - timedelta(days=indice)
            sessao.add(
                PrecoDiario(
                    item_id=item.id,
                    data=dia,
                    preco=2,
                    volume=volume,
                    preenchido=False,
                    coletado_em=datetime.combine(dia + timedelta(days=1), datetime.min.time(), UTC),
                )
            )
        modelo, execucao = modelos[horizonte]
        previsao = Previsao(
            item_id=item.id,
            modelo_id=modelo.id,
            data_base=base,
            preco_base=2,
            preco_previsto=previsto,
            historico_curto=False,
            intervalo_inferior=Decimal(str(previsto)) * Decimal("0.9"),
            intervalo_superior=Decimal(str(previsto)) * Decimal("1.1"),
            nivel_confianca=Decimal("0.8"),
            execucao_id=execucao.id,
        )
        sessao.add(previsao)
        sessao.flush()
        return item, previsao

    return adicionar, modelos


def test_ranking_margem_ordem_desempate_paginacao_e_link(cliente, mercado):
    adicionar, _ = mercado
    a, _ = adicionar("A", previsto=3)
    b, _ = adicionar("B", previsto=4, volume=3)
    c, _ = adicionar("C", previsto=3)
    adicionar("Sem margem", previsto=2)
    adicionar("Queda", previsto=1)
    primeira = cliente.get("/oportunidades?por_pagina=2").json()
    segunda = cliente.get("/oportunidades?por_pagina=2&pagina=2").json()
    assert primeira["total"] == segunda["total"] == 3
    assert [r["item_id"] for r in primeira["itens"]] == [b.id, a.id]
    assert [r["item_id"] for r in segunda["itens"]] == [c.id]
    assert segunda["itens"][0]["posicao"] == 3
    melhor = primeira["itens"][0]
    assert melhor["margem_estimada"] == 1
    assert melhor["diferenca_estimada"] == 2
    assert melhor["risco"] == "alto"
    assert melhor["volume_medio_7d"] == 3
    assert "liquidez" in " ".join(melhor["motivos_risco"])
    assert primeira["itens"][1]["risco"] == "baixo"
    assert cliente.get(f"/itens/{melhor['item_id']}").status_code == 200


def test_ranking_aceita_antigos_mas_ignora_inativos_outros_jogos_e_precos_corrigidos(
    cliente, sessao, mercado
):
    adicionar, _ = mercado
    valido, previsao = adicionar("Válido")
    adicionar("Inativo", ativo=False)
    adicionar("CS2", appid=730)
    antigo, _ = adicionar("Antigo", atraso=2)
    corrigido, _ = adicionar("Preço revisado")
    sessao.get(PrecoDiario, (corrigido.id, previsao.data_base)).preco = 2.1
    # O preço parcial de hoje não substitui o último dia fechado.
    sessao.add(
        PrecoDiario(
            item_id=valido.id,
            data=previsao.data_base + timedelta(days=1),
            preco=20,
            volume=1,
            preenchido=False,
        )
    )
    sessao.flush()
    resposta = cliente.get("/oportunidades").json()
    assert resposta["total"] == 2
    assert [item["item_id"] for item in resposta["itens"]] == [valido.id, antigo.id]
    assert resposta["itens"][0]["desatualizada"] is False
    assert resposta["itens"][1]["desatualizada"] is True
    assert resposta["data_base"] is None  # Datas diferentes não recebem uma base comum.
    assert resposta["itens_desatualizados"] == 1
    assert resposta["itens_sem_previsao_compativel"] == 1


@pytest.mark.parametrize("horizonte", [7, 15, 30])
def test_historico_preserva_datas_risco_e_contagem_entre_paginas(cliente, mercado, horizonte):
    adicionar, modelos = mercado
    _, previsao = adicionar("Histórico A", atraso=45, horizonte=horizonte)
    adicionar("Histórico B", atraso=45, horizonte=horizonte)
    base = previsao.data_base
    for pagina in (1, 2):
        data = cliente.get(
            f"/oportunidades?horizonte={horizonte}&por_pagina=1&pagina={pagina}"
        ).json()
        assert data["modelo_versao"] == modelos[horizonte][0].id
        assert data["total"] == data["itens_desatualizados"] == 2
        assert data["itens_sem_previsao_compativel"] == 0
        assert data["data_base"] == base.isoformat()
        item = data["itens"][0]
        assert item["posicao"] == pagina
        assert item["desatualizada"] is True
        assert item["data_base"] == base.isoformat()
        assert item["data_alvo"] == (base + timedelta(days=horizonte)).isoformat()
        assert item["janela_inicio"] == (base + timedelta(days=horizonte - 2)).isoformat()
        assert item["janela_fim"] == (base + timedelta(days=horizonte + 2)).isoformat()
        # Risco usa os dias anteriores à previsão, mesmo com janela já encerrada.
        assert item["risco"] == "baixo"
        assert item["volume_medio_7d"] == 200
        assert item["volatilidade_30d"] == 0


def test_previsao_mais_antiga_e_coleta_parcial_nao_entram(cliente, sessao, mercado):
    adicionar, _ = mercado
    _, antiga = adicionar("Previsão antiga")
    antiga.data_base -= timedelta(days=1)
    item, parcial = adicionar("Coleta parcial")
    preco = sessao.get(PrecoDiario, (item.id, parcial.data_base))
    preco.coletado_em = datetime.combine(parcial.data_base, datetime.min.time(), UTC)
    sessao.flush()
    data = cliente.get("/oportunidades").json()
    assert data["total"] == 0
    assert data["motivo"] == "aguardando_previsoes"


@pytest.mark.parametrize("horizonte", [7, 15, 30])
def test_horizontes_e_versoes_ativos_independentes(cliente, sessao, mercado, horizonte):
    adicionar, modelos = mercado
    item, previsao = adicionar(f"Item {horizonte}", horizonte=horizonte)
    modelo, _ = modelos[horizonte]
    data = cliente.get(f"/oportunidades?horizonte={horizonte}").json()
    assert data["modelo_versao"] == modelo.id
    assert data["itens"][0]["item_id"] == item.id
    assert (
        data["itens"][0]["janela_inicio"]
        == (previsao.data_base + timedelta(days=horizonte - 2)).isoformat()
    )
    # Troca para outra versão do mesmo horizonte ainda sem previsões.
    nova = ModeloVersao(
        id=str(uuid4()),
        nome="ema_10",
        horizonte=horizonte,
        meia_janela=2,
        artefato="nova.joblib",
        sha256="f" * 64,
        metadados={},
    )
    sessao.add(nova)
    sessao.flush()
    sessao.get(ModeloAtivo, horizonte).modelo_id = nova.id
    sessao.flush()
    data = cliente.get(f"/oportunidades?horizonte={horizonte}").json()
    assert data["modelo_versao"] == nova.id
    assert data["itens"] == []


def test_estados_vazios_sao_explicitos(cliente, mercado):
    adicionar, _ = mercado
    adicionar("Sem alta", previsto=2)
    assert cliente.get("/oportunidades").json()["motivo"] == "sem_margem_positiva"
    assert cliente.get("/oportunidades?horizonte=15").json()["motivo"] == ("aguardando_previsoes")


def test_sem_modelo_ativo(cliente):
    assert cliente.get("/oportunidades").json()["motivo"] == "sem_modelo_ativo"


@pytest.mark.parametrize("query", ["horizonte=8", "pagina=0", "por_pagina=0", "por_pagina=51"])
def test_parametros_invalidos(cliente, query):
    assert cliente.get(f"/oportunidades?{query}").status_code == 422


@pytest.mark.parametrize(
    "volume,nivel", [(9, "alto"), (10, "moderado"), (99, "moderado"), (100, "baixo")]
)
def test_limites_de_liquidez_e_causalidade(volume, nivel):
    hoje = datetime.now(UTC).date()
    pontos = [PontoRisco(hoje - timedelta(days=d), 2, volume) for d in range(31)]
    args = dict(data_base=hoje, preco_base=2, preco_previsto=3, inferior=2.5, superior=3.5)
    risco = avaliar_risco(pontos, **args)
    assert risco.nivel == nivel
    assert risco == avaliar_risco(pontos + [PontoRisco(hoje + timedelta(days=1), 100, 1)], **args)


@pytest.mark.parametrize("oscilacao,nivel", [(0.06, "moderado"), (0.12, "alto")])
def test_volatilidade_diaria(oscilacao, nivel):
    hoje = datetime.now(UTC).date()
    pontos = [
        PontoRisco(hoje - timedelta(days=d), 2 * exp(oscilacao * (d % 2)), 200) for d in range(31)
    ]
    risco = avaliar_risco(
        pontos, data_base=hoje, preco_base=2, preco_previsto=3, inferior=2.5, superior=3.5
    )
    assert risco.nivel == nivel
    assert risco.volatilidade_30d == pytest.approx(oscilacao)


def test_lacunas_e_dias_preenchidos_nao_inventam_baixo_risco():
    hoje = datetime.now(UTC).date()
    pontos = [PontoRisco(hoje - timedelta(days=d), 2, 200, True) for d in range(31)]
    risco = avaliar_risco(
        pontos, data_base=hoje, preco_base=2, preco_previsto=3, inferior=None, superior=None
    )
    assert risco.nivel == "alto"
    assert risco.volatilidade_30d is None
    assert "Intervalo" in " ".join(risco.motivos)


@pytest.mark.parametrize(
    "inferior,superior,nivel",
    [(2.5, 3.5, "baixo"), (2, 3.5, "moderado"), (1.5, 4.5, "alto")],
)
def test_intervalo_contribui_para_o_risco(inferior, superior, nivel):
    hoje = datetime.now(UTC).date()
    pontos = [PontoRisco(hoje - timedelta(days=d), 2, 200) for d in range(31)]
    risco = avaliar_risco(
        pontos,
        data_base=hoje,
        preco_base=2,
        preco_previsto=3,
        inferior=inferior,
        superior=superior,
    )
    assert risco.nivel == nivel
