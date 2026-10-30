import { Rotulo, Variacao } from "../../componentes/Basicos";
import { MenuConta } from "../../componentes/Conta";
import { Logo } from "../../componentes/Logo";
import { Sparkline } from "../../componentes/Sparkline";
import { formatarPreco } from "../../lib/formato";
import { useItemVitrine } from "./dados";
import { PreviaDaPlataforma, Radar } from "./SecoesDados";
import { DecidaComContexto, Faq, FluxoSimples, Transparencia } from "./SecoesInstitucionais";
import { BotaoPrimario, Container } from "./ui";

export function Inicio() {
  return (
    <div className="min-h-dvh">
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
        <nav className="hidden gap-8 text-sm text-suave md:flex">
          {LINKS.map(([rotulo, ancora]) => (
            <a key={ancora} href={ancora} className="hover:text-texto">
              {rotulo}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <MenuConta />
          <BotaoPrimario para="/itens">Começar agora</BotaoPrimario>
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
          <Rotulo destaque>Inteligência de mercado para Team Fortress 2</Rotulo>
          <h1 className="text-[2.6rem] leading-[1.02] titulo sm:text-6xl lg:text-[4rem]">
            Seu inventário.
            <br />
            Seu próximo
            <br />
            <span className="text-destaque">movimento.</span>
          </h1>
          <p className="max-w-md text-lg text-suave">
            Menos achismo. Mais contexto. Explore preços, tendências e cenários futuros dos seus itens de TF2
            em um só lugar.
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
            Previsões são estimativas. Decisões continuam sendo suas.
          </p>
        </div>
        <VitrineHero />
      </Container>
    </section>
  );
}

function VitrineHero() {
  const { item, pontos } = useItemVitrine(30);

  return (
    <div>
      <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-borda bg-[radial-gradient(ellipse_at_60%_40%,#1b2119,var(--color-fundo)_70%)]">
        <span className="absolute top-5 left-5">
          <Rotulo destaque>TF2 / Economia em movimento</Rotulo>
        </span>
        {/* Brilho roxo atrás do item, como a fumaça "unusual" do design. */}
        <div className="absolute top-1/4 left-1/2 size-56 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
        {item?.icon_url && (
          <img
            src={`${item.icon_url}/360fx360f`}
            alt={item.nome}
            className="absolute top-[12%] left-1/2 w-[58%] -translate-x-1/2 -rotate-12 drop-shadow-[0_24px_40px_rgba(0,0,0,0.7)]"
          />
        )}

        <div className="absolute right-4 bottom-4 left-4 rounded-xl border border-borda bg-painel/90 p-4 backdrop-blur sm:right-auto sm:w-80">
          <div className="flex items-center justify-between text-sm">
            <span>{item?.nome ?? "Carregando…"}</span>
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
      <div className="mt-4 flex items-center justify-between">
        <Rotulo>Cotação real do Mercado da Steam, em US$</Rotulo>
        <span className="font-mono text-2xl text-apagado">/ 01</span>
      </div>
    </div>
  );
}

function Destaques() {
  const itens = [
    ["Histórico + projeções", "M3 17l6-6 4 4 8-8"],
    ["Sinais com contexto", "M12 3v3m0 12v3M3 12h3m12 0h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8"],
    ["Team Fortress 2, primeiro", "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5"],
  ] as const;

  return (
    <section className="border-y border-borda">
      <Container className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 py-5">
        <Rotulo>Construída para entender o mercado</Rotulo>
        {itens.map(([texto, icone]) => (
          <span key={texto} className="flex items-center gap-2 text-sm text-suave">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-destaque)" strokeWidth="1.8" aria-hidden>
              <path d={icone} />
            </svg>
            {texto}
          </span>
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
        <p>Projeto acadêmico — PUCPR, 2026. Não afiliado à Valve nem à Steam.</p>
      </Container>
    </footer>
  );
}
