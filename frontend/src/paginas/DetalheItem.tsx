import { type ReactNode, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { ErroApi } from "../api/cliente";
import { type HorizontePrevisao, type ItemResumo, type PontoHistorico, useHistorico, useItem, usePrevisao } from "../api/itens";
import { Carregando, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { BotaoCriarAlerta } from "../componentes/alertas/CriarAlerta";
import { BotaoAcompanhar } from "../componentes/BotaoAcompanhar";
import { CardItem } from "../componentes/CardItem";
import { ChaveirosDoItem } from "../componentes/chaveiro/Chaveiro";
import { IconeTema } from "../componentes/chaveiro/IconeTema";
import { categoriaDoItem, nomeDoTema, temasDoItem } from "../componentes/chaveiro/temas";
import { GraficoHistorico } from "../componentes/GraficoHistorico";
import { analiseDoItem } from "../componentes/mascote/analise";
import { MascotesFixos } from "../componentes/mascote/MascotesFixos";
import { PrevisaoPreco } from "../componentes/PrevisaoPreco";
import { MedidorSinal } from "../componentes/SinalModelo";
import { t, useIdioma } from "../lib/idioma";
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
        titulo={naoExiste ? t("Item não encontrado.", "Item not found.") : t("Não foi possível carregar o item.", "Couldn't load the item.")}
        detalhe={naoExiste ? t("Ele pode ter saído do catálogo.", "It may have left the catalog.") : t("Confira se a API está no ar.", "Check that the API is up.")}
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
      <nav aria-label={t("Trilha", "Breadcrumb")} className="flex flex-wrap items-center gap-2 font-mono text-xs text-apagado">
        <Link to="/itens" className="text-suave transition-colors hover:text-destaque">
          ← {t("Explorar itens", "Explore items")}
        </Link>
        {categoria && (
          <>
            <span aria-hidden>/</span>
            <Link to={`/itens?categoria=${encodeURIComponent(categoria.nome)}`} className="text-suave transition-colors hover:text-destaque">
              {nomeDoTema(categoria.nome)}
            </Link>
          </>
        )}
      </nav>

      <Hero item={item} medalha={medalhas.get(item.id)} />

      <Indicadores item={item} />

      <div data-tv={t("Gráfico e previsão", "Chart and forecast")} className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* flex-col: o gráfico cresce até a altura da coluna do lado, sem vão embaixo. */}
        <Painel data-tour="item-grafico" className="flex flex-col rounded-2xl p-4 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <Rotulo destaque>{t("Histórico de preço", "Price history")}</Rotulo>
            </div>
            <div className="flex gap-1" role="group" aria-label={t("Período do gráfico", "Chart period")}>
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
                  {opcao === "1a" ? t("1a", "1y") : opcao === "tudo" ? t("tudo", "all") : opcao}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-80 flex-1 flex-col">
            {item.data_preco === null ? (
              <MensagemErro titulo={t("Este item ainda não tem preços coletados.", "This item has no collected prices yet.")} />
            ) : historico.isPending ? (
              <Carregando texto={t("Carregando histórico…", "Loading history…")} />
            ) : historico.isError ? (
              <MensagemErro titulo={t("Não foi possível carregar o histórico.", "Couldn't load the history.")} />
            ) : (
              <GraficoHistorico pontos={historico.data} previsao={previsao.data} />
            )}
          </div>

          {historico.data && historico.data.length > 0 && <ResumoPeriodo pontos={historico.data} />}
        </Painel>

        <aside className="space-y-4">
          <MedidorSinal sinal={sinal} horizonte={horizonte} dataBase={previsao.data?.data_base} carregando={previsao.isPending} />
          <div data-tour="item-previsao">
            <PrevisaoPreco
              consulta={previsao} horizonte={horizonte}
              aoMudarHorizonte={(valor) => alterarParametro("horizonte", String(valor))}
            />
          </div>
        </aside>
      </div>

      {categoria && parecidos.length > 0 && (
        <section data-tour="item-parecidos" data-tv={t("Itens parecidos", "Similar items")} className="space-y-6 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-3">
              <Rotulo destaque>{t("Mesma categoria", "Same category")}</Rotulo>
              <h2 className="text-3xl leading-tight titulo sm:text-4xl">{t("Itens parecidos", "Similar items")}</h2>
            </div>
            <Link
              to={`/itens?categoria=${encodeURIComponent(categoria.nome)}`}
              className="group/botao inline-flex items-center gap-1.5 text-sm text-destaque"
            >
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/botao:bg-[length:100%_1px]">
                {t("Ver todos", "See all")}: {nomeDoTema(categoria.nome)}
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
        {t(
          "Preços em dólar (US$) do Mercado da Comunidade Steam, um ponto por dia. Dias sem negociação repetem o último preço. Previsões são estimativas, não recomendação de investimento.",
          "Prices in US dollars from the Steam Community Market, one point per day. Days without trades repeat the last price. Forecasts are estimates, not investment advice.",
        )}
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
  // A faixa de 80% da previsão de 7 dias vira um atalho no formulário do alerta.
  const previsao = usePrevisao(item.id, 7).data;
  const faixa =
    previsao?.disponivel && previsao.intervalo_inferior != null && previsao.intervalo_superior != null
      ? { inferior: previsao.intervalo_inferior, superior: previsao.intervalo_superior }
      : undefined;

  return (
    <section data-tv={t("O item", "The item")} className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <div data-tour="item-topo" className="min-w-0 space-y-6">
        <div className="space-y-4">
          <Rotulo destaque>
            {categoria && jogo
              ? t(`${nomeDoTema(categoria.nome)} de ${jogo.nome}`, `${jogo.nome} ${nomeDoTema(categoria.nome)}`)
              : (categoria ? nomeDoTema(categoria.nome) : undefined) ?? item.tipo ?? jogo?.nome ?? "Item"}
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
                  {nomeDoTema(tema.nome)}
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
            <p className="font-mono text-[11px] text-apagado">{t(`Cotação de ${formatarData(item.data_preco)} no Mercado da Steam`, `Quote from ${formatarData(item.data_preco)} on the Steam Market`)}</p>
          )}
        </div>

        <div data-tour="item-acompanhar" className="flex flex-wrap items-start gap-3">
          <BotaoAcompanhar itemId={item.id} />
          <BotaoCriarAlerta item={item} faixa={faixa} />
          <BotaoSecundario href={urlSteam} icone={<span aria-hidden>↗</span>}>
            {t("Ver no Mercado da Steam", "View on the Steam Market")}
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
      rotulo: t("Preço atual", "Current price"),
      valor: item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—",
      detalhe: item.data_preco ? t(`Cotação de ${formatarData(item.data_preco)}`, `Quote from ${formatarData(item.data_preco)}`) : t("Sem cotação ainda", "No quote yet"),
      icone: "preco",
      verso: { rotulo: t("Moeda", "Currency"), valor: "US$", extra: t("Mercado da Comunidade Steam", "Steam Community Market") },
    },
    {
      rotulo: t("Variação em 7 dias", "7-day change"),
      valor: item.variacao_7d !== null ? formatarVariacao(item.variacao_7d) : "—",
      detalhe: t("contra o preço de uma semana atrás", "against the price a week ago"),
      icone: "variacao",
      verso: { rotulo: t("Conta só dias com preço", "Counts only days with a price"), valor: t("7 dias", "7 days") },
    },
    {
      rotulo: t("Previsão em 7 dias", "7-day forecast"),
      valor: prevista?.preco_previsto != null ? formatarPreco(prevista.preco_previsto) : "—",
      detalhe:
        prevista?.variacao_prevista != null
          ? t(`${formatarVariacao(prevista.variacao_prevista)} sobre o preço-base`, `${formatarVariacao(prevista.variacao_prevista)} over the base price`)
          : previsao.isPending
            ? t("Carregando previsão…", "Loading forecast…")
            : t("Previsão indisponível", "Forecast unavailable"),
      icone: "horizonte",
      verso: {
        rotulo: t("Faixa de 80%", "80% range"),
        valor:
          prevista?.intervalo_inferior != null && prevista.intervalo_superior != null
            ? `${formatarPreco(prevista.intervalo_inferior)} – ${formatarPreco(prevista.intervalo_superior)}`
            : "—",
      },
    },
    {
      rotulo: t("Vendas em 7 dias", "Sales in 7 days"),
      valor: volume !== null ? formatarInteiro(volume) : "—",
      detalhe: t("liquidez no Mercado da Steam", "liquidity on the Steam Market"),
      icone: "volume",
      verso: { rotulo: t("Média por dia", "Daily average"), valor: volume !== null ? formatarInteiro(Math.round(volume / 7)) : "—" },
    },
  ];

  return (
    // overflow-x-clip: a camada da aba dobrada dos adesivos é maior que eles e não pode alargar a página.
    <section data-tour="item-numeros" data-tv={t("Números", "Numbers")} className="grid grid-cols-1 gap-3 overflow-x-clip py-1 sm:grid-cols-2 lg:grid-cols-4">
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
    [t("Variação", "Change"), <Variacao valor={ultimo.preco / primeiro.preco - 1} />],
    [t("Mínimo", "Low"), formatarPreco(Math.min(...precos))],
    [t("Máximo", "High"), formatarPreco(Math.max(...precos))],
    [t("Volume médio / dia", "Avg. volume / day"), formatarInteiro(Math.round(volumeTotal / pontos.length))],
  ];

  // Faixa no rodapé do gráfico: os números mudam junto com o período escolhido em cima dele.
  return (
    <div className="mt-6 border-t border-borda pt-4">
      <p className="font-mono text-[11px] text-apagado">
        {t(`No período: ${formatarData(primeiro.data)} a ${formatarData(ultimo.data)}`, `In the period: ${formatarData(primeiro.data)} to ${formatarData(ultimo.data)}`)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-xs text-suave">{rotulo}</dt>
            <dd className="mt-0.5 font-mono text-sm">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
