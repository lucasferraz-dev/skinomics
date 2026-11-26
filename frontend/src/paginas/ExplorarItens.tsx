import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { type FiltrosItens, type ItemResumo, type PontoHistorico, useHistorico, useItens, usePrevisoes } from "../api/itens";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { CardItem, CardItemCarregando } from "../componentes/CardItem";
import { ChaveirosDoItem } from "../componentes/chaveiro/Chaveiro";
import { IconeTema } from "../componentes/chaveiro/IconeTema";
import { categoriaDoItem, nomeDaCategoria, nomeDoTema, type TemaChaveiro } from "../componentes/chaveiro/temas";
import { analiseDoExplorar } from "../componentes/mascote/analise";
import { MascotesFixos } from "../componentes/mascote/MascotesFixos";
import { Sparkline } from "../componentes/Sparkline";
import { t, useIdioma } from "../lib/idioma";
import { diasAntes, formatarData, formatarInteiro, formatarPreco, formatarVariacao } from "../lib/formato";
import { JOGOS, jogoDoItem } from "../lib/jogos";
import { sinalDoModelo } from "../lib/sinal";
import { TerminaisDestaque, useDestaquesDaSemana } from "./inicio/Destaques";
import { Medalha, type TipoMedalha } from "./inicio/Medalha";
import { CabecalhoSecao } from "./inicio/ui";

type Ordenacao = NonNullable<FiltrosItens["ordenar"]>;
type Direcao = NonNullable<FiltrosItens["direcao"]>;
type Visao = "grade" | "lista";

const POR_PAGINA = 24;
// A API devolve no máximo 100 itens por página: é o teto do filtro por categoria, feito aqui no front.
const TETO_CATALOGO = 100;

const FAIXAS = {
  centavos: { rotulo: () => t("Até US$ 0,10", "Up to US$ 0.10"), max: 0.1 },
  "ate-1": { rotulo: () => t("US$ 0,10 a 1", "US$ 0.10 to 1"), min: 0.1, max: 1 },
  "ate-10": { rotulo: () => t("US$ 1 a 10", "US$ 1 to 10"), min: 1, max: 10 },
  "acima-10": { rotulo: () => t("Acima de US$ 10", "Over US$ 10"), min: 10 },
} satisfies Record<string, { rotulo: () => string; min?: number; max?: number }>;
type Faixa = keyof typeof FAIXAS;

const ORDENS: { chave: string; rotulo: () => string; ordenar: Ordenacao; direcao: Direcao }[] = [
  { chave: "negociados", rotulo: () => t("Mais negociados", "Most traded"), ordenar: "volume_7d", direcao: "desc" },
  { chave: "altas", rotulo: () => t("Maiores altas", "Top gainers"), ordenar: "variacao_7d", direcao: "desc" },
  { chave: "quedas", rotulo: () => t("Maiores quedas", "Top losers"), ordenar: "variacao_7d", direcao: "asc" },
  { chave: "barato", rotulo: () => t("Menor preço", "Lowest price"), ordenar: "preco", direcao: "asc" },
  { chave: "caro", rotulo: () => t("Maior preço", "Highest price"), ordenar: "preco", direcao: "desc" },
  { chave: "az", rotulo: () => "A–Z", ordenar: "nome", direcao: "asc" },
];

type Filtros = {
  busca?: string;
  /** appid do jogo escolhido (440 TF2, 730 CS2); sem ele, todos. */
  jogo?: number;
  categoria?: string;
  faixa?: Faixa;
  ordenar: Ordenacao;
  direcao: Direcao;
  pagina: number;
  visao: Visao;
};
type Mudancas = Partial<Record<"busca" | "jogo" | "categoria" | "faixa" | "ordenar" | "direcao" | "pagina" | "visao", string>>;

/** Os filtros moram na URL: dá para compartilhar o link e o "voltar" do navegador funciona. */
function useFiltrosDaUrl() {
  const [parametros, setParametros] = useSearchParams();
  const faixa = parametros.get("faixa");
  // Na URL vai a sigla do jogo (?jogo=cs2), mais legível que o appid.
  const sigla = parametros.get("jogo")?.toUpperCase();
  const jogo = Object.entries(JOGOS).find(([, dados]) => dados.sigla === sigla)?.[0];
  const filtros: Filtros = {
    busca: parametros.get("busca") ?? undefined,
    jogo: jogo ? Number(jogo) : undefined,
    categoria: parametros.get("categoria") ?? undefined,
    faixa: faixa && faixa in FAIXAS ? (faixa as Faixa) : undefined,
    ordenar: (parametros.get("ordenar") as Ordenacao | null) ?? "volume_7d",
    direcao: (parametros.get("direcao") as Direcao | null) ?? "desc",
    pagina: Math.max(1, Number(parametros.get("pagina") ?? 1) || 1),
    visao: parametros.get("visao") === "lista" ? "lista" : "grade",
  };

  function atualizar(mudancas: Mudancas) {
    setParametros(
      (atual) => {
        const novo = new URLSearchParams(atual);
        for (const [nome, valor] of Object.entries(mudancas)) {
          if (valor) novo.set(nome, valor);
          else novo.delete(nome);
        }
        // Mudar filtro ou ordem volta para a primeira página; trocar grade/lista, não.
        if (!("pagina" in mudancas) && !("visao" in mudancas)) novo.delete("pagina");
        return novo;
      },
      { replace: true },
    );
  }

  return { filtros, atualizar };
}

/**
 * Busca, faixa de preço, ordem e página vão para a API. A categoria não existe na API (sai do nome do
 * item): com ela, pede o resultado filtrado inteiro e filtra e pagina aqui.
 */
function useResultado(filtros: Filtros) {
  const faixa = filtros.faixa ? FAIXAS[filtros.faixa] : undefined;
  const base: FiltrosItens = {
    busca: filtros.busca,
    appid: filtros.jogo,
    ordenar: filtros.ordenar,
    direcao: filtros.direcao,
    preco_min: faixa && "min" in faixa ? faixa.min : undefined,
    preco_max: faixa && "max" in faixa ? faixa.max : undefined,
  };
  const consulta = useItens(
    filtros.categoria ? { ...base, por_pagina: TETO_CATALOGO } : { ...base, pagina: filtros.pagina, por_pagina: POR_PAGINA },
  );
  const { data } = consulta;

  if (!data || !filtros.categoria) {
    return { ...consulta, itens: data?.itens, total: data?.total, pagina: data?.pagina ?? filtros.pagina };
  }
  const daCategoria = data.itens.filter((item) => categoriaDoItem(item)?.nome === filtros.categoria);
  const inicio = (filtros.pagina - 1) * POR_PAGINA;
  return {
    ...consulta,
    itens: daCategoria.slice(inicio, inicio + POR_PAGINA),
    total: daCategoria.length,
    pagina: filtros.pagina,
  };
}

export function ExplorarItens() {
  useIdioma(); // os terminais de destaque têm textos traduzidos
  const { filtros, atualizar } = useFiltrosDaUrl();
  const { itens, total, pagina, isPending, isError, isPlaceholderData } = useResultado(filtros);
  const { itens: catalogo, medalhas } = useDestaquesDaSemana();
  const filtrando = Boolean(filtros.busca || filtros.jogo || filtros.categoria || filtros.faixa);
  // Muda a cada "Limpar filtros", para o campo de busca recomeçar vazio (sem remontar a cada tecla).
  const [limpezas, setLimpezas] = useState(0);
  // As mesmas previsões que os cards pedem (cache dividido): os mascotes contam touros e ursos da página.
  const previsoes = usePrevisoes((itens ?? []).map((item) => item.id));
  const sinais = (itens ?? []).flatMap((item, i) => {
    const previsao = previsoes[i]?.data;
    return previsao ? [sinalDoModelo(previsao, item.volume_7d)] : [];
  });
  const falas = analiseDoExplorar({ sinais, catalogo, resultado: itens, total, categoria: filtros.categoria, filtrando });
  const limpar = () => {
    atualizar({ busca: "", jogo: "", categoria: "", faixa: "" });
    setLimpezas((n) => n + 1);
  };

  return (
    // pb: o fim da página não fica escondido atrás dos mascotes de plantão no canto.
    <div className="mx-auto max-w-6xl space-y-10 pb-44">
      <CabecalhoSecao
        nivel={1}
        rotulo={t("Mercado da Steam", "Steam Market")}
        titulo={t("Explorar itens", "Explore items")}
        texto={t(
          "Compare preço, movimento da semana e liquidez. Filtre por jogo, categoria e faixa de preço, e clique num item para ver o histórico e a previsão.",
          "Compare price, weekly movement and liquidity. Filter by game, category and price range, and click an item to see its history and forecast.",
        )}
      />

      {/* Sem filtro, a página abre com o que mais se mexeu na semana, como na landing. */}
      {!filtrando && filtros.pagina === 1 && (
        // lg:pb: espaço para os chaveiros dos terminais, que pendem embaixo deles (só aparecem do lg em diante).
        <section data-tv={t("Destaques da semana", "Weekly highlights")} className="space-y-4 lg:pb-16">
          <Rotulo destaque>{t("Destaques da semana", "Weekly highlights")}</Rotulo>
          <TerminaisDestaque tour="destaques-explorar" />
        </section>
      )}

      <section data-tv={t("Itens", "Items")} className="space-y-4">
        <BarraFiltros
          limpezas={limpezas}
          filtros={filtros}
          atualizar={atualizar}
          catalogo={catalogo}
          total={total}
          filtrando={filtrando}
          aoLimpar={limpar}
        />

        {isPending ? (
          filtros.visao === "grade" ? (
            <GradeItens>
              {Array.from({ length: 8 }, (_, i) => (
                <CardItemCarregando key={i} />
              ))}
            </GradeItens>
          ) : (
            <Painel>
              <Carregando texto={t("Carregando itens…", "Loading items…")} />
            </Painel>
          )
        ) : isError ? (
          <Painel>
            <MensagemErro titulo={t("Não foi possível carregar os itens.", "Couldn't load the items.")} detalhe={t("Confira se a API está no ar.", "Check that the API is up.")} />
          </Painel>
        ) : !itens || itens.length === 0 ? (
          <Painel className="flex flex-col items-center pb-8">
            <MensagemErro titulo={t("Nenhum item encontrado.", "No items found.")} detalhe={t("Tente outro termo ou tire algum filtro.", "Try another term or remove a filter.")} />
            {filtrando && (
              <button type="button" onClick={limpar} className="text-sm text-destaque underline-offset-4 hover:underline">
                {t("Limpar filtros", "Clear filters")}
              </button>
            )}
          </Painel>
        ) : (
          <div data-tour="resultados" className={`transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
            {filtros.visao === "grade" ? (
              <GradeItens>
                {itens.map((item) => (
                  <CardItem key={item.id} item={item} medalha={medalhas.get(item.id)} />
                ))}
              </GradeItens>
            ) : (
              <TabelaItens itens={itens} filtros={filtros} atualizar={atualizar} medalhas={medalhas} />
            )}
          </div>
        )}

        {total !== undefined && total > POR_PAGINA && (
          <Paginacao pagina={pagina} total={total} aoMudar={(nova) => atualizar({ pagina: String(nova) })} />
        )}
      </section>

      <p className="text-xs text-apagado">
        {t(
          "Preços em dólar (US$) do Mercado da Comunidade Steam, um ponto por dia. Variação e volume contam os últimos 7 dias com preço de cada item. As medalhas marcam os destaques da semana.",
          "Prices in US dollars from the Steam Community Market, one point per day. Change and volume count each item's last 7 days with a price. Medals mark the week's highlights.",
        )}
      </p>

      <MascotesFixos falas={falas} />
    </div>
  );
}

function GradeItens({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function BarraFiltros({
  limpezas,
  filtros,
  atualizar,
  catalogo,
  total,
  filtrando,
  aoLimpar,
}: {
  limpezas: number;
  filtros: Filtros;
  atualizar: (mudancas: Mudancas) => void;
  catalogo: ItemResumo[];
  total: number | undefined;
  filtrando: boolean;
  aoLimpar: () => void;
}) {
  // Os jogos que existem no catálogo, com quantos itens cada um tem.
  const jogos = new Map<number, number>();
  for (const item of catalogo) jogos.set(item.appid, (jogos.get(item.appid) ?? 0) + 1);

  // Só as categorias que existem no catálogo (do jogo escolhido), das mais comuns para as mais raras.
  const contagem = new Map<string, { tema: TemaChaveiro; quantos: number }>();
  for (const item of catalogo) {
    if (filtros.jogo && item.appid !== filtros.jogo) continue;
    const tema = categoriaDoItem(item);
    if (!tema) continue;
    const atual = contagem.get(tema.nome);
    contagem.set(tema.nome, { tema, quantos: (atual?.quantos ?? 0) + 1 });
  }
  const categorias = [...contagem.values()].sort((a, b) => b.quantos - a.quantos);

  return (
    <Painel className="divide-y divide-borda">
      <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <CampoBusca key={limpezas} valorInicial={filtros.busca ?? ""} aoBuscar={(busca) => atualizar({ busca })} />
        <span className="font-mono text-xs text-suave">{total !== undefined ? t(`${formatarInteiro(total)} itens`, `${formatarInteiro(total)} items`) : " "}</span>
        {filtrando && (
          <button type="button" onClick={aoLimpar} className="font-mono text-xs text-apagado transition-colors hover:text-destaque">
            × {t("Limpar filtros", "Clear filters")}
          </button>
        )}
        <AlternarVisao visao={filtros.visao} aoMudar={(visao) => atualizar({ visao: visao === "grade" ? "" : visao })} />
      </div>

      <div data-tour="filtros" className="space-y-3 p-3 sm:p-4">
        <GrupoFiltro rotulo={t("Jogo", "Game")}>
          {[...jogos.entries()].map(([appid, quantos]) => {
            const dados = JOGOS[appid];
            if (!dados) return null;
            const ativo = filtros.jogo === appid;
            return (
              // As categorias mudam de um jogo para o outro: trocar de jogo tira a categoria.
              <Chip key={appid} ativo={ativo} aoClicar={() => atualizar({ jogo: ativo ? "" : dados.sigla.toLowerCase(), categoria: "" })}>
                <SeloJogo sigla={dados.sigla} cor={ativo ? "currentColor" : dados.cor} />
                {dados.nome}
                <span className={`font-mono text-[10px] ${ativo ? "opacity-70" : "text-apagado"}`}>{quantos}</span>
              </Chip>
            );
          })}
        </GrupoFiltro>
        <GrupoFiltro rotulo={t("Categoria", "Category")}>
          {categorias.map(({ tema, quantos }) => {
            const ativo = filtros.categoria === tema.nome;
            return (
              <Chip key={tema.nome} ativo={ativo} aoClicar={() => atualizar({ categoria: ativo ? "" : tema.nome })}>
                <IconeTema tema={tema} cor={ativo ? "currentColor" : undefined} />
                {nomeDoTema(tema.nome)}
                <span className={`font-mono text-[10px] ${ativo ? "opacity-70" : "text-apagado"}`}>{quantos}</span>
              </Chip>
            );
          })}
        </GrupoFiltro>
        <GrupoFiltro rotulo={t("Preço", "Price")}>
          {(Object.keys(FAIXAS) as Faixa[]).map((chave) => {
            const ativo = filtros.faixa === chave;
            return (
              <Chip key={chave} ativo={ativo} aoClicar={() => atualizar({ faixa: ativo ? "" : chave })}>
                {FAIXAS[chave].rotulo()}
              </Chip>
            );
          })}
        </GrupoFiltro>
        <GrupoFiltro rotulo={t("Ordenar", "Sort")}>
          {ORDENS.map((ordem) => (
            <Chip
              key={ordem.chave}
              ativo={filtros.ordenar === ordem.ordenar && filtros.direcao === ordem.direcao}
              aoClicar={() => atualizar({ ordenar: ordem.ordenar, direcao: ordem.direcao })}
            >
              {ordem.rotulo()}
            </Chip>
          ))}
        </GrupoFiltro>
      </div>
    </Painel>
  );
}

/** A sigla do jogo numa bolinha com o contorno na cor dele, como o chaveiro do jogo. */
function SeloJogo({ sigla, cor }: { sigla: string; cor: string }) {
  return (
    <span
      className="grid size-[18px] place-items-center rounded-full border font-mono text-[7px] leading-none font-semibold"
      style={{ borderColor: cor, color: cor }}
    >
      {sigla}
    </span>
  );
}

function GrupoFiltro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-center">
      <Rotulo>{rotulo}</Rotulo>
      {/* No celular, uma faixa que rola de lado em vez de várias linhas de chips. */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {children}
      </div>
    </div>
  );
}

/** Chip de filtro: contorno que se preenche de verde no hover (como o botão secundário); ativo, verde-limão. */
function Chip({ ativo, aoClicar, children }: { ativo: boolean; aoClicar: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`group/botao relative inline-flex shrink-0 items-center overflow-hidden rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-[color,border-color,background-color] duration-300 active:scale-[0.97] ${
        ativo ? "border-destaque bg-destaque font-medium text-fundo" : "border-borda text-suave hover:border-destaque/60 hover:text-destaque"
      }`}
    >
      {!ativo && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-destaque/10 transition-transform duration-300 ease-out group-hover/botao:scale-x-100"
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

function AlternarVisao({ visao, aoMudar }: { visao: Visao; aoMudar: (visao: Visao) => void }) {
  const opcoes: { valor: Visao; rotulo: string; icone: string }[] = [
    { valor: "grade", rotulo: t("Grade", "Grid"), icone: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" },
    { valor: "lista", rotulo: t("Lista", "List"), icone: "M4 6h16M4 12h16M4 18h16" },
  ];
  return (
    <div data-tour="visao" className="ml-auto flex rounded-lg border border-borda p-0.5" role="group" aria-label={t("Modo de exibição", "View mode")}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={visao === opcao.valor}
          onClick={() => aoMudar(opcao.valor)}
          title={opcao.rotulo}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            visao === opcao.valor ? "bg-painel-alto text-destaque" : "text-apagado hover:text-texto"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={opcao.icone} />
          </svg>
          <span className="hidden sm:inline">{opcao.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

function CampoBusca({ valorInicial, aoBuscar }: { valorInicial: string; aoBuscar: (busca: string) => void }) {
  const [texto, setTexto] = useState(valorInicial);
  // useEffectEvent: chama sempre o aoBuscar mais recente sem reiniciar a espera a cada render.
  const buscar = useEffectEvent((termo: string) => aoBuscar(termo));

  // Espera a pessoa parar de digitar antes de consultar a API.
  useEffect(() => {
    if (texto === valorInicial) return;
    const espera = setTimeout(() => buscar(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto, valorInicial]);

  return (
    <label data-tour="busca" className="flex w-full items-center gap-2 rounded-lg border border-borda bg-fundo px-3 py-2 transition-colors focus-within:border-destaque/50 sm:w-80">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-apagado" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={t("Buscar item…", "Search item…")}
        aria-label={t("Buscar item", "Search item")}
        className="w-full bg-transparent text-sm outline-none placeholder:text-apagado"
      />
    </label>
  );
}

function TabelaItens({
  itens,
  filtros,
  atualizar,
  medalhas,
}: {
  itens: ItemResumo[];
  filtros: Filtros;
  atualizar: (mudancas: Mudancas) => void;
  medalhas: Map<number, TipoMedalha>;
}) {
  return (
    <Painel className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left">
        <thead className="whitespace-nowrap">
          <tr className="border-b border-borda">
            <Cabecalho rotulo={t("Item", "Item")} coluna="nome" filtros={filtros} atualizar={atualizar} />
            <Cabecalho rotulo={t("Preço", "Price")} coluna="preco" filtros={filtros} atualizar={atualizar} alinharDireita />
            <Cabecalho rotulo={t("Var. 7d", "7d change")} coluna="variacao_7d" filtros={filtros} atualizar={atualizar} alinharDireita />
            <th className="px-4 py-3"><Rotulo>{t("Tendência 30d", "30d trend")}</Rotulo></th>
            <Cabecalho rotulo={t("Volume 7d", "7d volume")} coluna="volume_7d" filtros={filtros} atualizar={atualizar} alinharDireita />
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <LinhaItem key={item.id} item={item} medalha={medalhas.get(item.id)} chaveiros />
          ))}
        </tbody>
      </table>
    </Painel>
  );
}

function Cabecalho({
  rotulo,
  coluna,
  filtros,
  atualizar,
  alinharDireita = false,
}: {
  rotulo: string;
  coluna: Ordenacao;
  filtros: Filtros;
  atualizar: (mudancas: Mudancas) => void;
  alinharDireita?: boolean;
}) {
  const ativa = filtros.ordenar === coluna;
  // Primeiro clique: nome em ordem alfabética, números do maior para o menor.
  const proxima: Direcao = ativa ? (filtros.direcao === "desc" ? "asc" : "desc") : coluna === "nome" ? "asc" : "desc";

  return (
    <th className={`px-4 py-3 ${alinharDireita ? "text-right" : ""}`} aria-sort={ativa ? (filtros.direcao === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => atualizar({ ordenar: coluna, direcao: proxima })}
        className={`inline-flex items-center gap-1 ${ativa ? "[&>span]:text-texto" : "hover:[&>span]:text-texto"}`}
      >
        <Rotulo>{rotulo}</Rotulo>
        {ativa && <span className="font-mono text-[11px]">{filtros.direcao === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

/**
 * Linha da tabela de itens. Com `chaveiros`, mostra os chaveiros mini do item (jogo, tipo, evento);
 * com `medalha`, a medalha do destaque da semana no canto do ícone.
 */
export function LinhaItem({ item, chaveiros = false, medalha }: { item: ItemResumo; chaveiros?: boolean; medalha?: TipoMedalha }) {
  const inicio = item.data_preco ? diasAntes(item.data_preco, 30) : undefined;
  const historico = useHistorico(item.id, inicio, item.data_preco !== null);

  return (
    // A linha inteira é clicável: o link do nome se estende sobre ela (after:absolute).
    <tr className="relative border-b border-borda/60 transition-colors last:border-0 hover:bg-painel-alto">
      <td className="relative px-4 py-3">
        {chaveiros && <ChaveirosDoItem item={item} tamanho="mini" direita="0.75rem" className="hidden sm:block" />}
        <div className="flex items-center gap-3">
          <span className="relative shrink-0">
            <IconeItem url={item.icon_url} nome={item.nome} />
            {medalha && <Medalha tipo={medalha} tamanho="pequena" className="absolute -top-2 -right-2 scale-75" />}
          </span>
          <div className="min-w-0">
            <Link to={`/itens/${item.id}`} className="block truncate text-sm after:absolute after:inset-0">
              {item.nome}
            </Link>
            <span className="text-xs text-apagado">{nomeDaCategoria(item) ?? item.tipo ?? jogoDoItem(item.appid)?.nome}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">
        {item.preco_atual !== null ? formatarPreco(item.preco_atual) : <span className="text-apagado">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <Variacao valor={item.variacao_7d} />
      </td>
      <td className="px-4 py-3">
        <Tendencia pontos={historico.data} />
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-suave">
        {item.volume_7d !== null ? formatarInteiro(item.volume_7d) : "—"}
      </td>
      <td className="pr-4 text-right text-apagado" aria-hidden>↗</td>
    </tr>
  );
}

/**
 * Mini gráfico de 30 dias com a variação do mês ao lado. Sem o número, um item que subiu
 * na semana (Var. 7d verde) mas caiu no mês (gráfico vermelho) parecia um erro.
 */
export function Tendencia({ pontos }: { pontos: PontoHistorico[] | undefined }) {
  const primeiro = pontos?.[0];
  const ultimo = pontos?.at(-1);
  if (!pontos || !primeiro || !ultimo || pontos.length < 2) {
    return <Sparkline valores={[]} />;
  }

  const variacao = ultimo.preco / primeiro.preco - 1;
  const titulo = `${formatarData(primeiro.data)} – ${formatarData(ultimo.data)}: ${formatarVariacao(variacao)}`;
  return (
    <div className="flex items-center gap-3">
      <Sparkline valores={pontos.map((ponto) => ponto.preco)} titulo={titulo} />
      <span className="text-xs">
        <Variacao valor={variacao} />
      </span>
    </div>
  );
}

function Paginacao({ pagina, total, aoMudar }: { pagina: number; total: number; aoMudar: (pagina: number) => void }) {
  const ultima = Math.ceil(total / POR_PAGINA);
  const botao = "rounded-md border border-borda px-3 py-1.5 font-mono text-xs transition-colors enabled:hover:border-destaque/60 enabled:hover:text-destaque disabled:opacity-40";
  return (
    <div className="flex items-center justify-between rounded-xl border border-borda bg-painel p-3 sm:px-4">
      <span className="font-mono text-xs text-suave">
        {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} {t("de", "of")} {total}
      </span>
      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-xs text-apagado sm:inline">
          {t(`página ${pagina} de ${ultima}`, `page ${pagina} of ${ultima}`)}
        </span>
        <button type="button" className={botao} disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
          {t("Anterior", "Previous")}
        </button>
        <button type="button" className={botao} disabled={pagina >= ultima} onClick={() => aoMudar(pagina + 1)}>
          {t("Próxima", "Next")}
        </button>
      </div>
    </div>
  );
}
