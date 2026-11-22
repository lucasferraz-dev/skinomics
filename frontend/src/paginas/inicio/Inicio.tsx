import { type ReactNode, useRef } from "react";
import { Link } from "react-router";

import { useItens } from "../../api/itens";
import { useOportunidades } from "../../api/oportunidades";
import { Rotulo, Variacao } from "../../componentes/Basicos";
import { Chaveiro } from "../../componentes/chaveiro/Chaveiro";
import { MenuConta } from "../../componentes/Conta";
import { Logo } from "../../componentes/Logo";
import { Mascote } from "../../componentes/mascote/Mascote";
import { AcessoAnalise } from "../../componentes/MenuAnalise";
import { Sparkline } from "../../componentes/Sparkline";
import { formatarDataNumerica, formatarPreco } from "../../lib/formato";
import { useItemVitrine } from "./dados";
import { PreviaDaPlataforma, Radar } from "./SecoesDados";
import { DecidaComContexto, Faq, FluxoSimples, Transparencia } from "./SecoesInstitucionais";
import { BotaoPrimario, Container } from "./ui";

export function Inicio() {
  return (
    <div className="relative min-h-dvh">
      <Navegacao />
      <main>
        <Hero />
        <Destaques />
        <PreviaDaPlataforma />
        <Radar />
        <FluxoSimples />
        <DecidaComContexto />
        <Transparencia />
        <Faq />
      </main>
      <Rodape />
      <Mascote />
    </div>
  );
}

const LINKS = [
  ["Plataforma", "#plataforma"],
  ["Como funciona", "#como-funciona"],
  ["Transparência", "#transparencia"],
  ["FAQ", "#faq"],
] as const;

function Navegacao() {
  return (
    <header className="sticky top-0 z-10 border-b border-borda bg-fundo/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden gap-8 text-sm text-suave lg:flex">
          {LINKS.map(([rotulo, ancora]) => (
            <a key={ancora} href={ancora} className="hover:text-texto">
              {rotulo}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <AcessoAnalise hamburguer />
          <MenuConta />
          <span className="hidden sm:inline-flex"><BotaoPrimario para="/itens">Começar agora</BotaoPrimario></span>
        </div>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section>
      <Container className="grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="space-y-7">
          <Rotulo destaque>Preços e previsões para itens de Team Fortress 2</Rotulo>
          <h1 data-poleiro="texto" className="text-[2.6rem] leading-[1.02] titulo sm:text-6xl lg:text-[4rem]">
            Seu inventário.
            <br />
            Seu próximo
            <br />
            <span className="text-destaque">movimento.</span>
          </h1>
          <p className="max-w-md text-lg text-suave">
            Histórico diário do Mercado da Steam e previsões de preço para 7, 15 e 30 dias, cada uma com a
            faixa onde o preço deve ficar.
          </p>
          <div className="flex flex-wrap gap-3">
            <BotaoPrimario para="/itens">Explorar a plataforma</BotaoPrimario>
            <a
              href="#plataforma"
              className="rounded-lg border border-borda px-4 py-2.5 text-sm transition-colors hover:border-suave"
            >
              Ver demonstração
            </a>
          </div>
          <p className="flex items-center gap-2 text-xs text-apagado">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
            </svg>
            Previsões são estimativas, não recomendação de investimento.
          </p>
        </div>
        <VitrineHero />
      </Container>
    </section>
  );
}

function VitrineHero() {
  const { item, pontos, motivo, trocar } = useItemVitrine(30);
  const card = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="relative">
        <div ref={card} data-poleiro className="relative aspect-[5/4] select-none overflow-hidden rounded-2xl border border-borda bg-[radial-gradient(ellipse_at_60%_40%,#1b2119,var(--color-fundo)_70%)]">
          {/* Brilho roxo atrás do item, como a fumaça "unusual" do design. */}
          <div className="absolute top-1/4 left-1/2 size-56 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
          {item?.icon_url && (
            <img
              key={item.id}
              src={`${item.icon_url}/360fx360f`}
              alt={item.nome}
              draggable={false}
              className="absolute top-[12%] left-1/2 w-[58%] -translate-x-1/2 -rotate-12 drop-shadow-[0_24px_40px_rgba(0,0,0,0.7)] transition duration-500 starting:scale-90 starting:opacity-0"
            />
          )}

          <div className="absolute top-4 right-4 left-4 flex items-center justify-between gap-3">
            {motivo && <Rotulo destaque>{motivo}</Rotulo>}
            <button
              type="button"
              onClick={trocar}
              className="ml-auto flex items-center gap-2 rounded-lg border border-borda bg-painel/80 px-3 py-1.5 text-xs text-suave backdrop-blur transition-colors hover:border-suave hover:text-texto"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
              Outro item
            </button>
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
              <span className="font-mono text-[11px] text-apagado">TF2</span>
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
        {/* Pendurado embaixo do card, que funciona como parede para ele. */}
        <Chaveiro appid={item?.appid} parede={card} className="absolute top-full right-28" />
      </div>
      <p className="mt-4">
        <Rotulo>Cotação real do Mercado da Steam, em US$</Rotulo>
      </p>
    </div>
  );
}

// Ícones de traço (24×24), no mesmo estilo dos demais da landing.
const ICONES = {
  itens: "M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5",
  calendario: "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 8h3v3H8z",
  oportunidade: "M3 17l6-6 4 4 7-7m0 0h-5m5 0v5",
  horizonte: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
} as const;

type Indicador = {
  rotulo: string;
  valor: ReactNode;
  detalhe: ReactNode;
  icone: keyof typeof ICONES;
  para?: string;
};

/** Cards logo abaixo do hero: números reais da base, iguais para todos os itens. */
function Destaques() {
  const itens = useItens({ por_pagina: 1 }).data;
  const oportunidades = useOportunidades(7, 1).data;
  const dataCotacao = itens?.itens[0]?.data_preco;

  const indicadores: Indicador[] = [
    { rotulo: "Itens monitorados", valor: itens?.total ?? "—", detalhe: "no Mercado da Steam", icone: "itens" },
    {
      rotulo: "Última cotação",
      valor: dataCotacao ? formatarDataNumerica(dataCotacao) : "—",
      detalhe: "Atualizada a cada coleta",
      icone: "calendario",
    },
    {
      rotulo: "Oportunidades em 7 dias",
      valor: oportunidades?.total ?? "—",
      detalhe: "com margem prevista positiva",
      icone: "oportunidade",
      para: "/oportunidades",
    },
    { rotulo: "Horizontes", valor: "7, 15 e 30", detalhe: "dias, com faixa de 80%", icone: "horizonte" },
  ];

  return (
    <section className="border-y border-borda">
      <Container className="grid grid-cols-2 gap-3 py-6 sm:gap-4 lg:grid-cols-4">
        {indicadores.map((indicador) => (
          <CardIndicador key={indicador.rotulo} {...indicador} />
        ))}
      </Container>
    </section>
  );
}

function CardIndicador({ rotulo, valor, detalhe, icone, para }: Indicador) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl border border-destaque/20 bg-destaque-fundo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-destaque)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={ICONES[icone]} />
          </svg>
        </span>
        {para && (
          <span className="font-mono text-sm text-apagado transition-colors group-hover:text-destaque" aria-hidden>
            ↗
          </span>
        )}
      </div>
      <div className="space-y-1">
        <Rotulo>{rotulo}</Rotulo>
        <p className="font-mono text-2xl sm:text-3xl">{valor}</p>
        <p className="font-mono text-[11px] text-apagado">{detalhe}</p>
      </div>
    </>
  );
  const classe = "flex flex-col justify-between gap-6 rounded-2xl border border-borda bg-painel p-4 sm:p-5";

  return para ? (
    <Link to={para} data-poleiro className={`group ${classe} transition-colors hover:border-destaque/40`}>
      {conteudo}
    </Link>
  ) : (
    <div data-poleiro className={classe}>{conteudo}</div>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-borda">
      <Container className="flex flex-wrap items-center justify-between gap-4 py-8 text-xs text-apagado">
        <Logo />
        <p>Não afiliado à Valve nem à Steam.</p>
      </Container>
    </footer>
  );
}
