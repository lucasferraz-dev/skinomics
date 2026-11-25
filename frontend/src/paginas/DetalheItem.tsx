import { type ReactNode, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { ErroApi } from "../api/cliente";
import { type HorizontePrevisao, type ItemResumo, type PontoHistorico, useHistorico, useItem, usePrevisao } from "../api/itens";
import { Carregando, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { BotaoAcompanhar } from "../componentes/BotaoAcompanhar";
import { CardItem } from "../componentes/CardItem";
import { ChaveirosDoItem } from "../componentes/chaveiro/Chaveiro";
import { IconeTema } from "../componentes/chaveiro/IconeTema";
import { categoriaDoItem, temasDoItem } from "../componentes/chaveiro/temas";
import { GraficoHistorico } from "../componentes/GraficoHistorico";
import { analiseDoItem } from "../componentes/mascote/analise";
import { MascotesFixos } from "../componentes/mascote/MascotesFixos";
import { PrevisaoPreco } from "../componentes/PrevisaoPreco";
import { MedidorSinal } from "../componentes/SinalModelo";
import { useIdioma } from "../lib/idioma";
import { diasAntes, formatarData, formatarInteiro, formatarPreco, formatarVariacao } from "../lib/formato";
import { jogoDoItem } from "../lib/jogos";
import { sinalDoModelo } from "../lib/sinal";
import { ADESIVOS, CardIndicador, type Indicador } from "./inicio/CardIndicador";
import { useDestaquesDaSemana } from "./inicio/Destaques";
import { Medalha } from "./inicio/Medalha";
import { BotaoSecundario } from "./inicio/ui";

const PERIODOS = { "7d": 7, "30d": 30, "90d": 90, "1a": 365, tudo: null } as const;
type Periodo = keyof typeof PERIODOS;

export function DetalheItem() {
  useIdioma();
  const id = Number(useParams().id);
  const { data: item, isPending, error } = useItem(id);

  // Sem restauração de rolagem no roteador: vindo de "Itens parecidos" (no fim da página), volta ao topo.
  // Com chaves: o efeito não pode devolver o retorno do scrollTo, que o React chamaria como limpeza.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (isPending) return <Carregando />;
  if (error) {
    const naoExiste = error instanceof ErroApi && error.status === 404;
    return (
      <MensagemErro
        titulo={naoExiste ? "Item não encontrado." : "Não foi possível carregar o item."}
        detalhe={naoExiste ? "Ele pode ter saído do catálogo." : "Confira se a API está no ar."}
      />
    );
  }
  return <Conteudo item={item} />;
}

function Conteudo({ item }: { item: ItemResumo }) {
  const [parametros, setParametros] = useSearchParams();
  const horizonteUrl = Number(parametros.get("horizonte"));
  const horizonte: HorizontePrevisao = horizonteUrl === 15 || horizonteUrl === 30 ? horizonteUrl : 7;
  function alterarParametro(nome: string, valor: string) {
    setParametros((atuais) => {
      const novos = new URLSearchParams(atuais);
      novos.set(nome, valor);
      return novos;
    }, { replace: true });
  }
  const periodo: Periodo = (parametros.get("periodo") as Periodo | null) ?? "30d";
  const dias = PERIODOS[periodo] ?? null;
  // A janela conta a partir do último preço do item, como a variação da API.
  const inicio = item.data_preco && dias ? diasAntes(item.data_preco, dias) : undefined;
  const historico = useHistorico(item.id, inicio, item.data_preco !== null);
  const previsao = usePrevisao(item.id, horizonte);
  const { itens: catalogo, medalhas } = useDestaquesDaSemana();

  const categoria = categoriaDoItem(item);
  const parecidos = categoria
    ? catalogo
        .filter((outro) => outro.id !== item.id && categoriaDoItem(outro)?.nome === categoria.nome)
        .sort((a, b) => (b.volume_7d ?? 0) - (a.volume_7d ?? 0))
        .slice(0, 4)
    : [];
  const sinal = sinalDoModelo(previsao.data, item.volume_7d);
  const falas = analiseDoItem({
    item,
    sinal: previsao.isPending ? undefined : sinal,
    previsao: previsao.data,
    previsaoCarregando: previsao.isPending,
    horizonte,
    pontos: historico.data,
    medalha: medalhas.get(item.id),
    categoria: categoria?.nome,
    parecidos: parecidos.length,
  });

  return (
    // pb: o fim da página não fica escondido atrás dos mascotes de plantão no canto.
    <div className="mx-auto max-w-6xl space-y-10 pb-44">
      <nav aria-label="Trilha" className="flex flex-wrap items-center gap-2 font-mono text-xs text-apagado">
        <Link to="/itens" className="text-suave transition-colors hover:text-destaque">
          ← Explorar itens
        </Link>
        {categoria && (
          <>
            <span aria-hidden>/</span>
            <Link to={`/itens?categoria=${encodeURIComponent(categoria.nome)}`} className="text-suave transition-colors hover:text-destaque">
              {categoria.nome}
            </Link>
          </>
        )}
      </nav>

      <Hero item={item} medalha={medalhas.get(item.id)} />

      <Indicadores item={item} />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Painel data-tour="item-grafico" className="rounded-2xl p-4 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <Rotulo destaque>Histórico de preço</Rotulo>
            </div>
            <div className="flex gap-1" role="group" aria-label="Período do gráfico">
              {(Object.keys(PERIODOS) as Periodo[]).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  aria-pressed={opcao === periodo}
                  onClick={() => alterarParametro("periodo", opcao)}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                    opcao === periodo ? "bg-painel-alto text-destaque ring-1 ring-borda" : "text-apagado hover:text-texto"
                  }`}
                >
                  {opcao}
                </button>
              ))}
            </div>
          </div>

          {item.data_preco === null ? (
            <MensagemErro titulo="Este item ainda não tem preços coletados." />
          ) : historico.isPending ? (
            <div className="h-80"><Carregando texto="Carregando histórico…" /></div>
          ) : historico.isError ? (
            <MensagemErro titulo="Não foi possível carregar o histórico." />
          ) : (
            <GraficoHistorico pontos={historico.data} previsao={previsao.data} />
          )}
        </Painel>

        <aside className="space-y-4">
          <MedidorSinal sinal={sinal} horizonte={horizonte} dataBase={previsao.data?.data_base} carregando={previsao.isPending} />
          <div data-tour="item-previsao">
            <PrevisaoPreco
              consulta={previsao} horizonte={horizonte}
              aoMudarHorizonte={(valor) => alterarParametro("horizonte", String(valor))}
            />
          </div>
          {historico.data && historico.data.length > 0 && <ResumoPeriodo pontos={historico.data} />}
        </aside>
      </div>

      {categoria && parecidos.length > 0 && (
        <section data-tour="item-parecidos" className="space-y-6 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-3">
              <Rotulo destaque>Mesma categoria</Rotulo>
              <h2 className="text-3xl leading-tight titulo sm:text-4xl">Itens parecidos</h2>
            </div>
            <Link
              to={`/itens?categoria=${encodeURIComponent(categoria.nome)}`}
              className="group/botao inline-flex items-center gap-1.5 text-sm text-destaque"
            >
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/botao:bg-[length:100%_1px]">
                Ver todos: {categoria.nome}
              </span>
              <span aria-hidden className="transition-transform duration-300 group-hover/botao:translate-x-1">→</span>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {parecidos.map((outro) => (
              <CardItem key={outro.id} item={outro} medalha={medalhas.get(outro.id)} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-apagado">
        Preços em dólar (US$) do Mercado da Comunidade Steam, um ponto por dia. Dias sem negociação repetem o
        último preço. Previsões são estimativas, não recomendação de investimento.
      </p>

      <MascotesFixos falas={falas} />
    </div>
  );
}

/** Topo da página no clima do hero da landing: nome grande à esquerda, o item numa vitrine à direita. */
function Hero({ item, medalha }: { item: ItemResumo; medalha?: Parameters<typeof Medalha>[0]["tipo"] }) {
  const card = useRef<HTMLDivElement>(null);
  const categoria = categoriaDoItem(item);
  const jogo = jogoDoItem(item.appid);
  // Selos do evento e da qualidade (os mesmos dos chaveiros), sem repetir o jogo e a categoria.
  const selos = temasDoItem(item).filter((tema) => !tema.texto && tema.nome !== categoria?.nome);
  const urlSteam = `https://steamcommunity.com/market/listings/${item.appid}/${encodeURIComponent(item.market_hash_name)}`;

  return (
    <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <div data-tour="item-topo" className="min-w-0 space-y-6">
        <div className="space-y-4">
          <Rotulo destaque>
            {categoria && jogo ? `${categoria.nome} de ${jogo.nome}` : (categoria?.nome ?? item.tipo ?? jogo?.nome ?? "Item")}
          </Rotulo>
          {/* Quebra em vez de cortar: no celular, o nome cortado escondia qual item era. */}
          <h1 data-poleiro="texto" className="text-4xl leading-[1.05] text-balance titulo sm:text-5xl">
            {item.nome}
          </h1>
          {selos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selos.map((tema) => (
                <span
                  key={tema.nome}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  style={{ borderColor: `${tema.cor}55`, color: tema.cor }}
                >
                  <IconeTema tema={tema} tamanho={13} />
                  {tema.nome}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-4xl sm:text-5xl">
              {item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—"}
            </span>
            <Variacao valor={item.variacao_7d} sufixo="7d" />
          </div>
          {item.data_preco && (
            <p className="font-mono text-[11px] text-apagado">Cotação de {formatarData(item.data_preco)} no Mercado da Steam</p>
          )}
        </div>

        <div data-tour="item-acompanhar" className="flex flex-wrap items-start gap-3">
          <BotaoAcompanhar itemId={item.id} />
          <BotaoSecundario href={urlSteam} icone={<span aria-hidden>↗</span>}>
            Ver no Mercado da Steam
          </BotaoSecundario>
        </div>
      </div>

      {/* pb: espaço para os chaveiros, que pendem embaixo da vitrine (presos ao div relativo de dentro) */}
      <div className="pb-24">
        <div className="relative">
          <div
            ref={card}
            data-poleiro
            className="relative aspect-[5/4] select-none overflow-hidden rounded-2xl border border-borda bg-[radial-gradient(ellipse_at_60%_40%,#1b2119,var(--color-fundo)_70%)]"
          >
            {/* Brilho roxo atrás do item, como a fumaça "unusual" do design. */}
            <div className="absolute top-1/4 left-1/2 size-56 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
            {item.icon_url ? (
              <img
                key={item.id}
                src={`${item.icon_url}/360fx360f`}
                alt={item.nome}
                draggable={false}
                className="absolute top-[14%] left-1/2 w-[56%] -translate-x-1/2 -rotate-12 drop-shadow-[0_24px_40px_rgba(0,0,0,0.7)] transition duration-500 starting:scale-90 starting:opacity-0"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center font-mono text-5xl text-apagado">
                {item.nome.slice(0, 2).toUpperCase()}
              </span>
            )}
            {medalha && <Medalha key={`medalha-${item.id}`} tipo={medalha} className="absolute top-3 left-4 z-10 -rotate-[8deg] sm:left-6" />}
            {jogo && (
              <span className="absolute top-4 right-4 rounded-md border border-borda bg-painel/80 px-2 py-1 font-mono text-[11px] text-suave backdrop-blur">
                {jogo.sigla}
              </span>
            )}
          </div>
          <ChaveirosDoItem item={item} parede={card} direita="1.5rem" />
        </div>
      </div>
    </section>
  );
}

/** Adesivos com os números do item, iguais aos da landing (dá para descolar a ponta e ler o verso). */
function Indicadores({ item }: { item: ItemResumo }) {
  const previsao = usePrevisao(item.id, 7);
  const prevista = previsao.data?.disponivel ? previsao.data : undefined;
  const volume = item.volume_7d;

  const indicadores: Indicador[] = [
    {
      rotulo: "Preço atual",
      valor: item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—",
      detalhe: item.data_preco ? `Cotação de ${formatarData(item.data_preco)}` : "Sem cotação ainda",
      icone: "preco",
      verso: { rotulo: "Moeda", valor: "US$", extra: "Mercado da Comunidade Steam" },
    },
    {
      rotulo: "Variação em 7 dias",
      valor: item.variacao_7d !== null ? formatarVariacao(item.variacao_7d) : "—",
      detalhe: "contra o preço de uma semana atrás",
      icone: "variacao",
      verso: { rotulo: "Conta só dias com preço", valor: "7 dias" },
    },
    {
      rotulo: "Previsão em 7 dias",
      valor: prevista?.preco_previsto != null ? formatarPreco(prevista.preco_previsto) : "—",
      detalhe:
        prevista?.variacao_prevista != null
          ? `${formatarVariacao(prevista.variacao_prevista)} sobre o preço-base`
          : previsao.isPending
            ? "Carregando previsão…"
            : "Previsão indisponível",
      icone: "horizonte",
      verso: {
        rotulo: "Faixa de 80%",
        valor:
          prevista?.intervalo_inferior != null && prevista.intervalo_superior != null
            ? `${formatarPreco(prevista.intervalo_inferior)} – ${formatarPreco(prevista.intervalo_superior)}`
            : "—",
      },
    },
    {
      rotulo: "Vendas em 7 dias",
      valor: volume !== null ? formatarInteiro(volume) : "—",
      detalhe: "liquidez no Mercado da Steam",
      icone: "volume",
      verso: { rotulo: "Média por dia", valor: volume !== null ? formatarInteiro(Math.round(volume / 7)) : "—" },
    },
  ];

  return (
    // overflow-x-clip: a camada da aba dobrada dos adesivos é maior que eles e não pode alargar a página.
    <section data-tour="item-numeros" className="grid grid-cols-1 gap-3 overflow-x-clip py-1 sm:grid-cols-2 lg:grid-cols-4">
      {indicadores.map((indicador, i) => (
        <CardIndicador key={indicador.rotulo} {...indicador} adesivo={ADESIVOS[i % ADESIVOS.length]!} />
      ))}
    </section>
  );
}

function ResumoPeriodo({ pontos }: { pontos: PontoHistorico[] }) {
  const precos = pontos.map((ponto) => ponto.preco);
  const primeiro = pontos[0]!;
  const ultimo = pontos.at(-1)!;
  const volumeTotal = pontos.reduce((soma, ponto) => soma + ponto.volume, 0);

  const linhas: [string, ReactNode][] = [
    ["Variação", <Variacao valor={ultimo.preco / primeiro.preco - 1} />],
    ["Mínimo", formatarPreco(Math.min(...precos))],
    ["Máximo", formatarPreco(Math.max(...precos))],
    ["Volume médio / dia", formatarInteiro(Math.round(volumeTotal / pontos.length))],
  ];

  return (
    <Painel className="p-5">
      <Rotulo>No período</Rotulo>
      <p className="mt-1 font-mono text-[11px] text-apagado">
        {formatarData(primeiro.data)} – {formatarData(ultimo.data)}
      </p>
      <dl className="mt-4 space-y-2.5 text-sm">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between gap-4">
            <dt className="text-suave">{rotulo}</dt>
            <dd className="font-mono">{valor}</dd>
          </div>
        ))}
      </dl>
    </Painel>
  );
}
