import { Link, useSearchParams } from "react-router";

import type { HorizontePrevisao } from "../api/itens";
import { type Oportunidade, type RankingOportunidades, useOportunidades } from "../api/oportunidades";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo } from "../componentes/Basicos";
import { categoriaDoItem } from "../componentes/chaveiro/temas";
import { analiseDasOportunidades, margemDepoisDaTaxa } from "../componentes/mascote/analise";
import { MascotesFixos } from "../componentes/mascote/MascotesFixos";
import { t, useIdioma } from "../lib/idioma";
import { formatarData, formatarDiaMes, formatarInteiro, formatarPreco, formatarVariacao } from "../lib/formato";
import { TAXA_STEAM } from "../lib/sinal";
import { ADESIVOS, CardIndicador, type Indicador } from "./inicio/CardIndicador";
import { Medalha } from "./inicio/Medalha";
import { CabecalhoSecao } from "./inicio/ui";

const HORIZONTES: HorizontePrevisao[] = [7, 15, 30];
const NO_PODIO = 3;

type NivelRisco = Oportunidade["risco"];
const RISCOS: Record<NivelRisco, { nome: () => string; barras: number; classe: string; cor: string }> = {
  baixo: { nome: () => t("Risco baixo", "Low risk"), barras: 1, classe: "border-destaque/30 text-destaque", cor: "var(--color-destaque)" },
  moderado: { nome: () => t("Risco moderado", "Moderate risk"), barras: 2, classe: "border-amber-300/30 text-amber-300", cor: "rgb(252 211 77)" },
  alto: { nome: () => t("Risco alto", "High risk"), barras: 3, classe: "border-queda/40 text-queda", cor: "var(--color-queda)" },
};

export function Oportunidades() {
  useIdioma();
  const [parametros, setParametros] = useSearchParams();
  const pedido = Number(parametros.get("horizonte"));
  const horizonte = HORIZONTES.find((h) => h === pedido) ?? 7;
  const numero = Number(parametros.get("pagina") ?? 1);
  const pagina = Number.isSafeInteger(numero) && numero > 0 ? numero : 1;
  const { data, isPending, isError, refetch } = useOportunidades(horizonte, pagina);

  function mudar(h: HorizontePrevisao, p = 1) {
    setParametros({ horizonte: String(h), pagina: String(p) });
  }

  const itens = data?.itens ?? [];
  // O pódio é das três maiores margens do ranking inteiro, então só existe na primeira página.
  const podio = pagina === 1 ? itens.slice(0, NO_PODIO) : [];
  const resto = itens.slice(podio.length);
  const falas = analiseDasOportunidades({ ranking: data, horizonte, pagina });

  return (
    // pb: o fim da página não fica escondido atrás dos mascotes de plantão no canto.
    <div className="mx-auto max-w-6xl space-y-14 pb-44">
      <section data-tv={t("Oportunidades", "Opportunities")} className="space-y-8">
        <CabecalhoSecao
          nivel={1}
          rotulo={t("Ranking do modelo", "Model ranking")}
          titulo={t("Oportunidades", "Opportunities")}
          texto={t(
            "Itens negociados abaixo do preço médio que o modelo prevê, da maior margem para a menor. Olhe o risco antes da margem.",
            "Items trading below the average price the model predicts, from the biggest margin to the smallest. Check the risk before the margin.",
          )}
        />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-suave">{t("Cenário", "Scenario")}</span>
          <div className="flex gap-1 rounded-full border border-borda bg-painel p-1" role="group" aria-label={t("Horizonte da previsão", "Forecast horizon")}>
            {HORIZONTES.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={h === horizonte}
                onClick={() => mudar(h)}
                className={`rounded-full px-3.5 py-1.5 font-mono text-xs transition-colors ${
                  h === horizonte ? "bg-destaque text-fundo" : "text-suave hover:text-texto"
                }`}
              >
                {t(`${h} dias`, `${h} days`)}
              </button>
            ))}
          </div>
        </div>

        {data && itens.length > 0 && <Numeros ranking={data} horizonte={horizonte} pagina={pagina} />}
      </section>

      {isPending ? (
        <Painel className="rounded-2xl">
          <Carregando texto={t("Buscando oportunidades…", "Looking for opportunities…")} />
        </Painel>
      ) : isError ? (
        <Painel className="rounded-2xl pb-6 text-center">
          <MensagemErro titulo={t("Não foi possível carregar o ranking.", "Couldn't load the ranking.")} />
          <button type="button" onClick={() => void refetch()} className="text-sm text-destaque hover:underline">
            {t("Tentar novamente", "Try again")}
          </button>
        </Painel>
      ) : itens.length === 0 ? (
        <EstadoVazio data={data} voltar={() => mudar(horizonte)} />
      ) : (
        <>
          {data.itens_desatualizados > 0 && (
            <p role="status" className="rounded-xl border border-borda bg-painel px-4 py-3 text-xs leading-relaxed text-suave">
              {t(
                `${formatarInteiro(data.itens_desatualizados)} oportunidades usam preços anteriores ao último dia completo. Confira a data-base de cada uma.`,
                `${formatarInteiro(data.itens_desatualizados)} opportunities use prices from before the last full day. Check each one's base date.`,
              )}
            </p>
          )}

          {podio.length > 0 && (
            <section data-tv={t("Pódio", "Podium")} className="space-y-6">
              <div className="space-y-3">
                <Rotulo destaque>{t(`Cenário de ${horizonte} dias`, `${horizonte}-day scenario`)}</Rotulo>
                <h2 className="text-3xl leading-tight titulo sm:text-4xl">{t("As maiores margens", "The biggest margins")}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3 md:items-end">
                {podio.map((item) => (
                  <VitrineOportunidade key={item.item_id} item={item} horizonte={horizonte} />
                ))}
              </div>
            </section>
          )}

          {resto.length > 0 && (
            <section data-tv={t("Ranking", "Ranking")} className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-3">
                  <Rotulo destaque>{t("Ranking completo", "Full ranking")}</Rotulo>
                  <h2 className="text-3xl leading-tight titulo sm:text-4xl">
                    {pagina === 1 ? t("E as próximas", "And the next ones") : t(`Página ${pagina}`, `Page ${pagina}`)}
                  </h2>
                </div>
                <span className="font-mono text-xs text-apagado" aria-live="polite">
                  {t(`${formatarInteiro(data.total)} no total`, `${formatarInteiro(data.total)} in total`)}
                </span>
              </div>
              <ListaRanking itens={resto} horizonte={horizonte} />
            </section>
          )}

          {data.total > data.por_pagina && (
            <nav aria-label={t("Páginas do ranking", "Ranking pages")} className="flex items-center justify-between gap-4 font-mono text-xs text-suave">
              <span>{t(`Página ${pagina} de ${Math.ceil(data.total / data.por_pagina)}`, `Page ${pagina} of ${Math.ceil(data.total / data.por_pagina)}`)}</span>
              <div className="flex gap-2">
                <button type="button" disabled={pagina <= 1} onClick={() => mudar(horizonte, pagina - 1)} className="rounded-full border border-borda px-4 py-2 transition-colors enabled:hover:border-destaque/60 enabled:hover:text-texto disabled:opacity-40">
                  ← {t("Anterior", "Previous")}
                </button>
                <button type="button" disabled={pagina * data.por_pagina >= data.total} onClick={() => mudar(horizonte, pagina + 1)} className="rounded-full border border-borda px-4 py-2 transition-colors enabled:hover:border-destaque/60 enabled:hover:text-texto disabled:opacity-40">
                  {t("Próxima", "Next")} →
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      <ComoLer ranking={data} />

      <MascotesFixos falas={falas} />
    </div>
  );
}

/** Adesivos com os números do cenário, os mesmos da landing e do detalhe do item. */
function Numeros({ ranking, horizonte, pagina }: { ranking: RankingOportunidades; horizonte: number; pagina: number }) {
  const itens = ranking.itens;
  const maior = itens[0]!;
  const baixos = itens.filter((item) => item.risco === "baixo").length;
  const altos = itens.filter((item) => item.risco === "alto").length;

  const indicadores: Indicador[] = [
    {
      rotulo: t("Oportunidades", "Opportunities"),
      valor: formatarInteiro(ranking.total),
      detalhe: t(`com margem em ${horizonte} dias`, `with a margin in ${horizonte} days`),
      icone: "oportunidade",
      verso: { rotulo: t("Sem previsão compatível", "No matching forecast"), valor: formatarInteiro(ranking.itens_sem_previsao_compativel) },
    },
    {
      rotulo: pagina === 1 ? t("Maior margem", "Biggest margin") : t("Maior da página", "Page's biggest"),
      valor: formatarVariacao(maior.margem_estimada),
      detalhe: maior.nome,
      icone: "variacao",
      verso: { rotulo: t("Depois da taxa da Steam", "After the Steam fee"), valor: formatarVariacao(margemDepoisDaTaxa(maior.margem_estimada)) },
    },
    {
      rotulo: t("Risco baixo", "Low risk"),
      valor: `${baixos} / ${itens.length}`,
      detalhe: t("nesta página", "on this page"),
      icone: "volume",
      verso: { rotulo: t("Risco alto", "High risk"), valor: `${altos} / ${itens.length}` },
    },
    {
      rotulo: t("Preços de", "Prices from"),
      valor: ranking.data_base ? formatarDiaMes(ranking.data_base) : "—",
      detalhe: t("data-base do ranking", "ranking base date"),
      icone: "calendario",
      verso: { rotulo: t("Horizonte", "Horizon"), valor: t(`${horizonte} dias`, `${horizonte} days`), extra: t("média da janela prevista", "average of the predicted window") },
    },
  ];

  return (
    // overflow-x-clip: a camada da aba dobrada dos adesivos é maior que eles e não pode alargar a página.
    <div className="grid grid-cols-1 gap-3 overflow-x-clip py-1 sm:grid-cols-2 lg:grid-cols-4">
      {indicadores.map((indicador, i) => (
        <CardIndicador key={indicador.rotulo} {...indicador} adesivo={ADESIVOS[i % ADESIVOS.length]!} />
      ))}
    </div>
  );
}

/**
 * Uma das três maiores margens, numa vitrine como a do detalhe do item: o item no fundo com brilho,
 * a margem em número grande e o risco logo abaixo. O primeiro lugar é mais alto e leva a medalha.
 */
function VitrineOportunidade({ item, horizonte }: { item: Oportunidade; horizonte: HorizontePrevisao }) {
  const primeiro = item.posicao === 1;
  const liquida = margemDepoisDaTaxa(item.margem_estimada);
  const categoria = categoriaDoItem(item);

  return (
    <Link
      to={`/itens/${item.item_id}?horizonte=${horizonte}`}
      data-poleiro
      className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-painel transition-colors hover:border-destaque/50 ${
        primeiro ? "border-destaque/40 md:order-2" : item.posicao === 2 ? "border-borda md:order-1" : "border-borda md:order-3"
      }`}
    >
      <div className="flex h-10 items-center justify-between border-b border-borda px-4">
        <Rotulo destaque>{t(`${item.posicao}º lugar`, `#${item.posicao}`)}</Rotulo>
        <span className="font-mono text-sm text-apagado transition-colors group-hover:text-destaque" aria-hidden>↗</span>
      </div>

      <div
        className={`relative select-none overflow-hidden bg-[radial-gradient(ellipse_at_60%_40%,#1b2119,var(--color-fundo)_70%)] ${
          primeiro ? "aspect-[4/3]" : "aspect-[16/10]"
        }`}
      >
        <div className="absolute top-1/4 left-1/2 size-40 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
        {item.icon_url ? (
          <img
            src={`${item.icon_url}/256fx256f`}
            alt=""
            draggable={false}
            className="absolute top-1/2 left-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 -rotate-12 drop-shadow-[0_18px_30px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-6"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-mono text-4xl text-apagado">{item.nome.slice(0, 2).toUpperCase()}</span>
        )}
        {primeiro && <Medalha tipo="margem" className="absolute top-2 left-4 z-10 -rotate-[8deg]" />}
        {categoria && (
          <span className="absolute top-3 right-3 rounded-md border border-borda bg-painel/80 px-2 py-1 font-mono text-[11px] text-suave backdrop-blur">
            {categoria.nome}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="line-clamp-2 text-base leading-snug">{item.nome}</p>
        <div>
          <p className={`font-mono leading-none text-destaque ${primeiro ? "text-5xl" : "text-4xl"}`}>{formatarVariacao(item.margem_estimada)}</p>
          <p className="mt-2 font-mono text-[11px] text-suave">
            {liquida > 0
              ? t(`${formatarVariacao(liquida)} depois da taxa da Steam`, `${formatarVariacao(liquida)} after the Steam fee`)
              : t("a taxa da Steam come a margem", "the Steam fee eats the margin")}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span>{formatarPreco(item.preco_atual)}</span>
          <span className="text-apagado" aria-hidden>→</span>
          <span className="text-destaque">{formatarPreco(item.preco_previsto)}</span>
          <span className="sr-only">{t("preço de hoje e média prevista", "today's price and predicted average")}</span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-borda pt-3">
          <SeloRisco risco={item.risco} titulo={item.motivos_risco.join(" ")} />
          <span className="font-mono text-[11px] text-apagado">
            {formatarDiaMes(item.janela_inicio)} a {formatarDiaMes(item.janela_fim)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Selo do risco com um medidor de três barras, nas cores do site (verde, âmbar e coral). */
function SeloRisco({ risco, titulo }: { risco: NivelRisco; titulo?: string }) {
  const { nome, barras, classe, cor } = RISCOS[risco];
  return (
    <span title={titulo} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${classe}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((barra) => (
          <span
            key={barra}
            className="w-1 rounded-sm"
            style={{ height: 4 + barra * 3, background: cor, opacity: barra <= barras ? 1 : 0.2 }}
          />
        ))}
      </span>
      {nome()}
    </span>
  );
}

/** Do quarto lugar em diante (ou a página toda, depois da primeira), no estilo da lista do Explorar. */
function ListaRanking({ itens, horizonte }: { itens: Oportunidade[]; horizonte: HorizontePrevisao }) {
  return (
    <Painel className="overflow-hidden rounded-2xl">
      <div className="hidden grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_7rem_10rem] items-center gap-4 border-b border-borda px-4 py-3 md:grid">
        <Rotulo>#</Rotulo>
        <Rotulo>{t("Item", "Item")}</Rotulo>
        <span className="text-right"><Rotulo>{t("Hoje", "Today")}</Rotulo></span>
        <span className="text-right"><Rotulo>{t("Prevista", "Predicted")}</Rotulo></span>
        <span className="text-right"><Rotulo>{t("Margem ↓", "Margin ↓")}</Rotulo></span>
        <Rotulo>{t("Risco", "Risk")}</Rotulo>
      </div>
      <ol className="divide-y divide-borda/60">
        {itens.map((item) => (
          <LinhaRanking key={item.item_id} item={item} horizonte={horizonte} />
        ))}
      </ol>
    </Painel>
  );
}

function LinhaRanking({ item, horizonte }: { item: Oportunidade; horizonte: HorizontePrevisao }) {
  const categoria = categoriaDoItem(item);
  return (
    <li className="group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-painel-alto md:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_7rem_10rem] md:items-center md:gap-4">
      <span className="font-mono text-sm text-apagado">{String(item.posicao).padStart(2, "0")}</span>

      <div className="flex min-w-0 items-center gap-3">
        <IconeItem url={item.icon_url} nome={item.nome} />
        <div className="min-w-0">
          {/* A linha inteira é clicável, menos o risco (que abre os motivos). */}
          <Link to={`/itens/${item.item_id}?horizonte=${horizonte}`} className="block truncate text-sm after:absolute after:inset-0 group-hover:text-destaque">
            {item.nome}
          </Link>
          <p className="truncate text-xs text-apagado">
            {categoria?.nome ?? item.tipo ?? " "}
            {item.desatualizada && <span className="text-suave">{t(", preço antigo", ", old price")}</span>}
          </p>
        </div>
      </div>

      <dl className="col-span-2 grid grid-cols-3 gap-3 text-sm md:contents">
        <div className="md:text-right">
          <dt className="text-[11px] text-apagado md:sr-only">{t("Hoje", "Today")}</dt>
          <dd className="font-mono">{formatarPreco(item.preco_atual)}</dd>
        </div>
        <div className="md:text-right">
          <dt className="text-[11px] text-apagado md:sr-only">{t("Prevista", "Predicted")}</dt>
          <dd className="font-mono">{formatarPreco(item.preco_previsto)}</dd>
        </div>
        <div className="md:text-right">
          <dt className="text-[11px] text-apagado md:sr-only">{t("Margem", "Margin")}</dt>
          <dd className="font-mono text-destaque">{formatarVariacao(item.margem_estimada)}</dd>
          <dd className="font-mono text-[11px] text-apagado">+{formatarPreco(item.diferenca_estimada)}</dd>
        </div>
      </dl>

      <div className="relative z-10 col-span-2 md:col-span-1">
        <MotivosRisco item={item} />
      </div>
    </li>
  );
}

function MotivosRisco({ item }: { item: Oportunidade }) {
  return (
    <details className="text-xs [&[open]>summary]:border-suave/40">
      <summary className="w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label={t(`${RISCOS[item.risco].nome()} em ${item.nome}: ver motivos`, `${RISCOS[item.risco].nome()} on ${item.nome}: see reasons`)}>
        <SeloRisco risco={item.risco} />
      </summary>
      <div className="mt-2 space-y-1.5 rounded-lg border border-borda bg-painel-alto p-3 text-suave">
        {item.motivos_risco.map((motivo) => <p key={motivo}>{motivo}</p>)}
        <p className="font-mono text-[11px] text-apagado">
          {t("Vendas por dia", "Sales per day")}: {item.volume_medio_7d === null ? "—" : formatarInteiro(Math.round(item.volume_medio_7d))}
          {", "}
          {t("oscilação diária", "daily swing")}: {item.volatilidade_30d === null ? "—" : `${(item.volatilidade_30d * 100).toFixed(1).replace(".", ",")}%`}
        </p>
      </div>
    </details>
  );
}

/** Como ler o ranking, em cartões no estilo da seção Transparência da landing. */
function ComoLer({ ranking }: { ranking: RankingOportunidades | undefined }) {
  const cartoes = [
    {
      titulo: t("Margem", "Margin"),
      texto: t(
        `Quanto a média prevista fica acima do preço de hoje: preço previsto ÷ preço de hoje − 1, em US$. Não desconta a taxa da Steam (uns ${Math.round(TAXA_STEAM * 100)}% entre o que o comprador paga e o vendedor recebe), por isso cada vitrine mostra também o que sobra depois dela.`,
        `How far the predicted average sits above today's price: predicted ÷ today − 1, in US$. It doesn't take out the Steam fee (about ${Math.round(TAXA_STEAM * 100)}% between what the buyer pays and the seller gets), so each showcase also shows what's left after it.`,
      ),
    },
    {
      titulo: t("Risco", "Risk"),
      texto: t(
        "Junta a liquidez (vendas por dia nos últimos 7 dias), a oscilação diária dos últimos 30 dias e a largura da faixa da previsão. Menos de 10 vendas por dia ou oscilação a partir de 10% é risco alto; abaixo de 100 vendas ou a partir de 5%, moderado. Clique no risco de um item para ver os motivos.",
        "Combines liquidity (sales per day over the last 7 days), daily swings over the last 30 days and the width of the forecast range. Under 10 sales a day or swings from 10% up is high risk; under 100 sales or from 5% up, moderate. Click an item's risk to see the reasons.",
      ),
    },
    {
      titulo: t("Janela", "Window"),
      texto: ranking?.data_base
        ? t(
            `Os preços são de ${formatarData(ranking.data_base)}. A previsão é a média de uma janela de dias em torno do horizonte, não o preço de um dia exato. É uma estimativa, não um retorno garantido nem recomendação de investimento.`,
            `Prices are from ${formatarData(ranking.data_base)}. The forecast is the average over a window of days around the horizon, not one exact day's price. It's an estimate, not a guaranteed return or investment advice.`,
          )
        : t(
            "A previsão é a média de uma janela de dias em torno do horizonte, não o preço de um dia exato. É uma estimativa, não um retorno garantido nem recomendação de investimento.",
            "The forecast is the average over a window of days around the horizon, not one exact day's price. It's an estimate, not a guaranteed return or investment advice.",
          ),
    },
  ];

  return (
    <section data-tv={t("Como ler", "How to read it")} className="space-y-8 pt-4">
      <CabecalhoSecao
        rotulo={t("Transparência", "Transparency")}
        titulo={t("Como ler o ranking.", "How to read the ranking.")}
        texto={t("O que entra na margem, de onde sai o risco e o que a previsão não promete.", "What goes into the margin, where the risk comes from and what the forecast doesn't promise.")}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {cartoes.map(({ titulo, texto }) => (
          <div key={titulo} data-poleiro className="space-y-3 rounded-2xl border border-borda bg-painel p-6">
            <h3 className="text-lg">{titulo}</h3>
            <p className="text-sm leading-relaxed text-suave">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EstadoVazio({ data, voltar }: { data: RankingOportunidades; voltar: () => void }) {
  const mensagens = {
    sem_modelo_ativo: [
      t("Previsão ainda indisponível para este horizonte.", "Forecast not available for this horizon yet."),
      t("O ranking aparece quando houver um modelo ativo com previsões.", "The ranking shows up once there's an active model with forecasts."),
    ],
    aguardando_previsoes: [
      t("Aguardando previsões para os preços de hoje.", "Waiting for forecasts for today's prices."),
      t("Elas saem logo depois da coleta diária.", "They come out right after the daily collection."),
    ],
    sem_margem_positiva: [
      t("Nenhuma oportunidade neste cenário.", "No opportunities in this scenario."),
      t("Nenhum item com previsão fica acima do preço de hoje neste horizonte. Tente outro.", "No item with a forecast ends above today's price in this horizon. Try another."),
    ],
  } as const;
  const [titulo, detalhe] = data.motivo
    ? mensagens[data.motivo]
    : [t("Nenhum item nesta página.", "No items on this page."), t("Volte ao início do ranking.", "Go back to the start of the ranking.")];
  return (
    <Painel className="flex flex-col items-center rounded-2xl pb-8">
      <MensagemErro titulo={titulo} detalhe={detalhe} />
      {data.motivo ? (
        <Link to="/itens" className="text-sm text-destaque hover:underline">{t("Explorar itens →", "Explore items →")}</Link>
      ) : (
        <button type="button" onClick={voltar} className="text-sm text-destaque hover:underline">{t("Primeira página", "First page")}</button>
      )}
    </Painel>
  );
}
