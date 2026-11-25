import { t, useIdioma } from "../../lib/idioma";
import { useRef } from "react";
import { Link } from "react-router";

import { useItens } from "../../api/itens";
import { useOportunidades } from "../../api/oportunidades";
import { Rotulo, Variacao } from "../../componentes/Basicos";
import { Cabecalho } from "../../componentes/Cabecalho";
import { Logo } from "../../componentes/Logo";
import { ChaveirosDoItem } from "../../componentes/chaveiro/Chaveiro";
import { Mascote } from "../../componentes/mascote/Mascote";
import { Sparkline } from "../../componentes/Sparkline";
import { formatarDataNumerica, formatarInteiro, formatarPreco, formatarVariacao } from "../../lib/formato";
import { ADESIVOS, CardIndicador, type Indicador } from "./CardIndicador";
import { Medalha } from "./Medalha";
import { useItemVitrine } from "./dados";
import { PreviaDaPlataforma, Radar } from "./SecoesDados";
import { DestaquesDaSemana } from "./Destaques";
import { Faq, FluxoSimples, Transparencia } from "./SecoesInstitucionais";
import { BotaoPrimario, BotaoSecundario, Container } from "./ui";
import { jogoDoItem } from "../../lib/jogos";

export function Inicio() {
  // Assina o idioma: ao trocar, a página inteira redesenha com os textos novos, sem remontar nada.
  useIdioma();
  return (
    <div className="relative min-h-dvh">
      <Cabecalho landing />
      <main>
        <Hero />
        <Destaques />
        <PreviaDaPlataforma />
        <Radar />
        <FluxoSimples />
        <DestaquesDaSemana />
        <Transparencia />
        <Faq />
      </main>
      <Rodape />
      <Mascote />
      <Mascote especie="coruja" />
    </div>
  );
}

function Hero() {
  return (
    <section data-tv={t("Início", "Home")} data-tv-chave="inicio">
      <Container className="grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="space-y-7">
          <Rotulo destaque>{t("Preços e previsões de itens do Mercado da Steam", "Steam Market item prices and forecasts")}</Rotulo>
          <h1 data-poleiro="texto" className="text-[2.6rem] leading-[1.02] titulo sm:text-6xl lg:text-[4rem]">
            {t("O preço de hoje.", "Today's price.")}
            <br />
            {t("O de daqui a", "The price in")}
            <br />
            <span className="text-destaque">{t("30 dias.", "30 days.")}</span>
          </h1>
          <p className="max-w-md text-lg text-suave">
            {t(
              "Histórico diário do Mercado da Steam e previsões de preço para 7, 15 e 30 dias, cada uma com a faixa onde o preço deve ficar.",
              "Daily Steam Market history and price forecasts for 7, 15 and 30 days, each with the range where the price should land.",
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <BotaoPrimario para="/itens">{t("Explorar a plataforma", "Explore the platform")}</BotaoPrimario>
            <BotaoSecundario
              href="#plataforma"
              icone={
                <span aria-hidden className="transition-transform duration-300 group-hover/botao:translate-y-0.5">
                  ↓
                </span>
              }
            >
              {t("Ver demonstração", "See demo")}
            </BotaoSecundario>
          </div>
          <p className="flex items-center gap-2 text-xs text-apagado">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
            </svg>
            {t("Previsões são estimativas, não recomendação de investimento.", "Forecasts are estimates, not investment advice.")}
          </p>
        </div>
        <VitrineHero />
      </Container>
    </section>
  );
}

function VitrineHero() {
  const { item, pontos, tipoMotivo, trocar } = useItemVitrine(30);
  const card = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div data-tour="vitrine-area" className="relative">
        <div ref={card} data-poleiro data-tour="vitrine" className="relative aspect-[5/4] select-none overflow-hidden rounded-2xl border border-borda bg-[radial-gradient(ellipse_at_60%_40%,#1b2119,var(--color-fundo)_70%)]">
          {/* Brilho roxo atrás do item, como a fumaça "unusual" do design. */}
          <div className="absolute top-1/4 left-1/2 size-56 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
          {item?.icon_url && (
            <img
              key={`imagem-${item.id}`}
              src={`${item.icon_url}/360fx360f`}
              alt={item.nome}
              draggable={false}
              className="absolute top-[12%] left-1/2 w-[58%] -translate-x-1/2 -rotate-12 drop-shadow-[0_24px_40px_rgba(0,0,0,0.7)] transition duration-500 starting:scale-90 starting:opacity-0"
            />
          )}

          {/* Medalha do motivo do destaque; entra com um "pop" a cada troca de item */}
          {item && tipoMotivo && (
            <Medalha key={`medalha-${item.id}`} tipo={tipoMotivo} className="absolute top-3 left-4 z-10 -rotate-[8deg] sm:left-6" />
          )}

          <div className="absolute top-4 right-4 left-4 flex items-center justify-between gap-3">
            <BotaoSecundario
              aoClicar={trocar}
              tamanho="sm"
              className="ml-auto bg-painel/80 text-suave backdrop-blur"
              icone={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="transition-transform duration-500 group-hover/botao:rotate-180"
                >
                  <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
              }
            >
              {t("Outro item", "Another item")}
            </BotaoSecundario>
          </div>

          <div className="absolute right-4 bottom-4 left-4 rounded-xl border border-borda bg-painel/90 p-4 backdrop-blur sm:right-auto sm:w-80">
            <div className="flex items-center justify-between gap-3 text-sm">
              {item ? (
                <Link to={`/itens/${item.id}`} className="truncate hover:text-destaque">
                  {item.nome}
                </Link>
              ) : (
                <span>Carregando…</span>
              )}
              <span className="font-mono text-[11px] text-apagado">{jogoDoItem(item?.appid)?.sigla}</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-2xl">{item?.preco_atual != null ? formatarPreco(item.preco_atual) : "—"}</p>
                <p className="mt-1 font-mono text-[11px] text-apagado">
                  <Variacao valor={item?.variacao_7d} /> nos últimos 7 dias
                </p>
              </div>
              <Sparkline valores={pontos?.map((ponto) => ponto.preco) ?? []} largura={96} altura={36} />
            </div>
          </div>
        </div>
        {/* Chaveiros do item (o que ele é, evento e qualidade), pendurados embaixo do card, que é parede para eles */}
        <ChaveirosDoItem item={item} parede={card} direita="1.5rem" />
      </div>
      {/* No celular, espaço para os chaveiros pendurados, que senão cairiam sobre os adesivos de baixo */}
      <div aria-hidden className="h-24 sm:hidden" />
      {/* No celular os chaveiros pendem justamente sobre esta legenda; ela só aparece do sm em diante. */}
      <p className="mt-4 hidden sm:block">
        <Rotulo>{t("Cotação real do Mercado da Steam, em US$", "Live Steam Market quote, in US$")}</Rotulo>
      </p>
    </div>
  );
}

/** Cards logo abaixo do hero: números reais da base, iguais para todos os itens. */
function Destaques() {
  // A mesma lista completa que a vitrine e os destaques já pedem (um pedido só para a landing toda).
  const itens = useItens({ por_pagina: 100 }).data;
  const todos = itens?.itens ?? [];
  const oportunidades = useOportunidades(7, 1).data;
  const dataCotacao = itens?.itens[0]?.data_preco;
  const melhor = oportunidades?.itens[0];
  const vendas = todos.reduce((soma, item) => soma + (item.volume_7d ?? 0), 0);
  const subiram = todos.filter((item) => (item.variacao_7d ?? 0) > 0).length;

  const indicadores: Indicador[] = [
    {
      rotulo: t("Itens monitorados", "Items tracked"),
      valor: itens?.total ?? "—",
      detalhe: t("no Mercado da Steam", "on the Steam Market"),
      icone: "itens",
      verso: { rotulo: t("Vendas somadas em 7 dias", "Total sales in 7 days"), valor: todos.length ? formatarInteiro(vendas) : "—" },
    },
    {
      rotulo: t("Última cotação", "Last quote"),
      valor: dataCotacao ? formatarDataNumerica(dataCotacao) : "—",
      detalhe: t("Atualizada a cada coleta", "Updated every collection"),
      icone: "calendario",
      verso: { rotulo: t("Subiram na semana", "Rose this week"), valor: todos.length ? t(`${subiram} de ${todos.length} itens`, `${subiram} of ${todos.length} items`) : "—" },
    },
    {
      rotulo: t("Oportunidades em 7 dias", "7-day opportunities"),
      valor: oportunidades?.total ?? "—",
      detalhe: t("com margem prevista positiva", "with a positive forecast margin"),
      icone: "oportunidade",
      para: "/oportunidades",
      verso: {
        rotulo: t("Melhor margem prevista", "Best forecast margin"),
        valor: melhor ? formatarVariacao(melhor.margem_estimada) : "—",
        extra: melhor?.nome,
      },
    },
    {
      rotulo: t("Horizontes", "Horizons"),
      valor: t("7, 15 e 30", "7, 15 and 30"),
      detalhe: t("dias, com faixa de 80%", "days, with an 80% range"),
      icone: "horizonte",
      verso: {
        rotulo: t("Previsões com base em", "Forecasts based on"),
        valor: oportunidades?.data_base ? formatarDataNumerica(oportunidades.data_base) : "—",
      },
    },
  ];

  return (
    // overflow-x-clip: a camada da aba dobrada dos adesivos é maior que eles e não pode alargar a página.
    <section data-tour="adesivos" className="overflow-x-clip">
      <Container className="grid grid-cols-1 gap-3 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((indicador, i) => (
          <CardIndicador key={indicador.rotulo} {...indicador} adesivo={ADESIVOS[i % ADESIVOS.length]!} />
        ))}
      </Container>
    </section>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-borda">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-8 text-xs text-apagado">
        <Logo />
        <p>{t("Não afiliado à Valve nem à Steam.", "Not affiliated with Valve or Steam.")}</p>
      </Container>
    </footer>
  );
}
