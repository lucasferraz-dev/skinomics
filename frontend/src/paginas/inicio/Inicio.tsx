import { type ReactNode, useRef } from "react";
import { Link } from "react-router";

import { useItens } from "../../api/itens";
import { useOportunidades } from "../../api/oportunidades";
import { Rotulo, Variacao } from "../../componentes/Basicos";
import { ChaveirosDoItem } from "../../componentes/chaveiro/Chaveiro";
import { MenuConta } from "../../componentes/Conta";
import { Logo } from "../../componentes/Logo";
import { Mascote } from "../../componentes/mascote/Mascote";
import { AcessoAnalise } from "../../componentes/MenuAnalise";
import { Sparkline } from "../../componentes/Sparkline";
import { formatarDataNumerica, formatarInteiro, formatarPreco, formatarVariacao } from "../../lib/formato";
import { Adesivo } from "./Adesivo";
import { Medalha } from "./Medalha";
import { useItemVitrine } from "./dados";
import { PreviaDaPlataforma, Radar } from "./SecoesDados";
import { DestaquesDaSemana } from "./Destaques";
import { Faq, FluxoSimples, Transparencia } from "./SecoesInstitucionais";
import { BotaoPrimario, BotaoSecundario, Container } from "./ui";
import { jogoDoItem } from "../../lib/jogos";

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
        <DestaquesDaSemana />
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
    <header className="sticky top-0 z-50 border-b border-borda bg-fundo/85 backdrop-blur">
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
          <Rotulo destaque>Preços e previsões de itens do Mercado da Steam</Rotulo>
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
            <BotaoSecundario
              href="#plataforma"
              icone={
                <span aria-hidden className="transition-transform duration-300 group-hover/botao:translate-y-0.5">
                  ↓
                </span>
              }
            >
              Ver demonstração
            </BotaoSecundario>
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
  const { item, pontos, tipoMotivo, trocar } = useItemVitrine(30);
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

          {/* Medalha do motivo do destaque; entra com um "pop" a cada troca de item */}
          {item && tipoMotivo && (
            <Medalha key={item.id} tipo={tipoMotivo} className="absolute top-16 right-6 rotate-[8deg] sm:right-10" />
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
              Outro item
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
  detalhe: string;
  icone: keyof typeof ICONES;
  para?: string;
  /** O que aparece escrito embaixo do adesivo quando ele é descolado. */
  verso: { rotulo: string; valor: ReactNode; extra?: string };
};

/** Cards logo abaixo do hero: números reais da base, iguais para todos os itens. */
function Destaques() {
  const itens = useItens({ por_pagina: 1 }).data;
  const todos = useItens({ por_pagina: 100 }).data?.itens ?? [];
  const oportunidades = useOportunidades(7, 1).data;
  const dataCotacao = itens?.itens[0]?.data_preco;
  const melhor = oportunidades?.itens[0];
  const vendas = todos.reduce((soma, item) => soma + (item.volume_7d ?? 0), 0);
  const subiram = todos.filter((item) => (item.variacao_7d ?? 0) > 0).length;

  const indicadores: Indicador[] = [
    {
      rotulo: "Itens monitorados",
      valor: itens?.total ?? "—",
      detalhe: "no Mercado da Steam",
      icone: "itens",
      verso: { rotulo: "Vendas somadas em 7 dias", valor: todos.length ? formatarInteiro(vendas) : "—" },
    },
    {
      rotulo: "Última cotação",
      valor: dataCotacao ? formatarDataNumerica(dataCotacao) : "—",
      detalhe: "Atualizada a cada coleta",
      icone: "calendario",
      verso: { rotulo: "Subiram na semana", valor: todos.length ? `${subiram} de ${todos.length} itens` : "—" },
    },
    {
      rotulo: "Oportunidades em 7 dias",
      valor: oportunidades?.total ?? "—",
      detalhe: "com margem prevista positiva",
      icone: "oportunidade",
      para: "/oportunidades",
      verso: {
        rotulo: "Melhor margem prevista",
        valor: melhor ? formatarVariacao(melhor.margem_estimada) : "—",
        extra: melhor?.nome,
      },
    },
    {
      rotulo: "Horizontes",
      valor: "7, 15 e 30",
      detalhe: "dias, com faixa de 80%",
      icone: "horizonte",
      verso: {
        rotulo: "Previsões com base em",
        valor: oportunidades?.data_base ? formatarDataNumerica(oportunidades.data_base) : "—",
      },
    },
  ];

  return (
    <section>
      <Container className="grid grid-cols-2 gap-3 py-5 lg:grid-cols-4">
        {indicadores.map((indicador, i) => (
          <CardIndicador key={indicador.rotulo} {...indicador} adesivo={ADESIVOS[i % ADESIVOS.length]!} />
        ))}
      </Container>
    </section>
  );
}

// Os indicadores são adesivos compactos nas cores do site, alternando verde-limão e preto. Dá para
// descolar puxando a ponta (ver Adesivo.tsx), e um reflexo de vinil passa ao mover o mouse.
const TINTAS = {
  verde: {
    "--fundo": "var(--color-destaque)",
    "--contorno": "transparent",
    "--numero": "#0b0d0c",
    "--rotulo": "rgba(11, 13, 12, 0.72)",
    "--detalhe": "rgba(11, 13, 12, 0.62)",
    "--icone-fundo": "#0b0d0c",
    "--icone-traco": "var(--color-destaque)",
    "--verso": "#97bd4f",
  },
  preto: {
    "--fundo": "#10140f",
    "--contorno": "rgba(198, 243, 107, 0.35)",
    "--numero": "var(--color-destaque)",
    "--rotulo": "var(--color-suave)",
    "--detalhe": "var(--color-apagado)",
    "--icone-fundo": "var(--color-destaque)",
    "--icone-traco": "#0b0d0c",
    "--verso": "#2b3427",
  },
} as const;

const ADESIVOS = ["verde", "preto", "verde", "preto"] as const;

function CardIndicador({ rotulo, valor, detalhe, icone, para, verso, adesivo }: Indicador & { adesivo: (typeof ADESIVOS)[number] }) {
  return (
    <Adesivo
      estilo={TINTAS[adesivo] as unknown as React.CSSProperties}
      para={para}
      titulo={detalhe}
      verso={verso}
      frente={
        <>
          {/* Reflexo do vinil: desliza pelo adesivo quando o mouse passa */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,0.28)_47%,transparent_56%)] bg-[length:250%_100%] bg-[position:100%_0] transition-[background-position] duration-700 group-hover:bg-[position:0%_0]"
          />
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--icone-fundo)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--icone-traco)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICONES[icone]} />
            </svg>
          </span>
          <div className="relative min-w-0">
            <span className="block truncate font-rotulo text-[11px] font-bold tracking-[0.06em] text-[var(--rotulo)]">
              {rotulo}
              {para && <span aria-hidden> ↗</span>}
            </span>
            <p className="titulo text-xl leading-tight text-[var(--numero)] sm:text-2xl">{valor}</p>
            <p className="truncate font-mono text-[10px] text-[var(--detalhe)]">{detalhe}</p>
          </div>
        </>
      }
    />
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
