import { localeAtual, t } from "../../lib/idioma";
import { useModelosAtivos } from "../../api/modelos";
import { Rotulo } from "../../componentes/Basicos";
import { CabecalhoSecao, Container } from "./ui";

// t("Como funciona", "How it works") em uma faixa compacta: três passos com ícone e uma frase curta, ligados por uma linha.
const PASSOS = [
  {
    get titulo() {
    return t("Busque o item", "Find the item");
  },
    get texto() {
    return t("pelo nome, entre os itens monitorados", "by name, among the tracked items");
  },
    icone: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20",
  },
  {
    get titulo() {
    return t("Veja histórico e previsão", "See history and forecast");
  },
    get texto() {
    return t("7, 15 ou 30 dias, com faixa de 80%", "7, 15 or 30 days, with an 80% range");
  },
    icone: "M4 18 9 12l4 3 7-9M15 6h5v5",
  },
  {
    get titulo() {
    return t("Acompanhe", "Follow it");
  },
    get texto() {
    return t("na sua lista ou no ranking de oportunidades", "in your list or the opportunities ranking");
  },
    icone: "M7 4h10v16l-5-3.5L7 20z",
  },
];

/** Seção 4: como funciona, em três passos. */
export function FluxoSimples() {
  return (
    <section id="como-funciona" data-tv={t("Como funciona", "How it works")} data-tv-chave="como-funciona" className="scroll-mt-32 py-14 sm:py-20">
      <Container className="space-y-8">
        <Rotulo destaque>{t("Como funciona", "How it works")}</Rotulo>
        <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {/* Linha tracejada ligando os passos (só lado a lado) */}
          <span
            aria-hidden
            className="absolute top-6 right-[16%] left-[16%] hidden border-t-2 border-dashed border-destaque/25 md:block"
          />
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="relative flex items-center gap-4 md:flex-col md:text-center">
              <span className="relative grid size-12 shrink-0 place-items-center rounded-full border border-destaque/40 bg-fundo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-destaque)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={passo.icone} />
                </svg>
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-destaque font-mono text-[10px] font-bold text-fundo">
                  {i + 1}
                </span>
              </span>
              <div className="space-y-0.5">
                <h3 className="text-lg">{passo.titulo}</h3>
                <p className="text-sm text-suave">{passo.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

const COMPROMISSOS = [
  {
    get titulo() {
    return t("De onde vêm os dados", "Where the data comes from");
  },
    get texto() {
    return t("Do histórico diário do Mercado da Comunidade Steam: preço e volume de cada item, alguns desde 2012. Nada é inventado ou ajustado à mão.", "From the daily history of the Steam Community Market: price and volume for each item, some since 2012. Nothing is made up or adjusted by hand.");
  },
  },
  {
    get titulo() {
    return t("Quão bom é o modelo", "How good the model is");
  },
    // Preenchido com as métricas do modelo ativo (ver TextoQualidade).
    texto: "",
  },
  {
    get titulo() {
    return t("O que não fazemos", "What we don't do");
  },
    get texto() {
    return t("Não compramos nem vendemos itens, não guardamos dinheiro e não damos recomendação de investimento. Previsão é estimativa; a decisão é sua.", "We don't buy or sell items, hold money or give investment advice. A forecast is an estimate; the decision is yours.");
  },
  },
];

const percentual = () => new Intl.NumberFormat(localeAtual(), { maximumFractionDigits: 1 });

/** Métricas do modelo de 7 dias em produção, lidas da API: mudam sozinhas a cada retreino. */
function TextoQualidade() {
  const { data, isError } = useModelosAtivos();
  const sete = data?.find((modelo) => modelo.horizonte === 7);
  // Ex.: o site publicado antes da API com a rota de modelos.
  if (isError) return <>{t("As métricas do modelo em produção estão indisponíveis no momento.", "The production model metrics are unavailable right now.")}</>;
  if (!data) return <>{t("Carregando as métricas do modelo…", "Loading the model metrics…")}</>;
  if (!sete?.mape_pct || !sete.acerto_preco_pct) {
    return <>{t("As métricas do modelo em produção ainda não foram publicadas.", "The production model metrics haven't been published yet.")}</>;
  }
  return (
    <>
      {t("No teste com os últimos 180 dias, o modelo de 7 dias errou em média", "Tested on the last 180 days, the 7-day model was off by")}{" "}
      <span className="text-texto">{percentual().format(sete.mape_pct)}%</span>
      {t(" e acertou o preço, com tolerância de 15%, em ", " on average and got the price right, within 15%, in ")}
      <span className="text-texto">{percentual().format(sete.acerto_preco_pct)}%</span>
      {t(" das previsões. Cada versão treinada fica registrada com seus números.", " of forecasts. Every trained version is logged with its numbers.")}
    </>
  );
}

/** Transparência: de onde vêm os números e os limites do produto. */
export function Transparencia() {
  return (
    <section id="transparencia" data-tv={t("Transparência", "Transparency")} data-tv-chave="transparencia" className="scroll-mt-32 py-14 sm:py-28">
      <Container className="space-y-12">
        <CabecalhoSecao
          rotulo={t("Transparência", "Transparency")}
          titulo={t("De onde vêm os números.", "Where the numbers come from.")}
          texto={t("A origem dos dados, a qualidade do modelo e o que a plataforma não faz.", "Where the data comes from, how good the model is and what the platform doesn't do.")}
        />
        <div data-tour="transparencia" className="grid gap-4 md:grid-cols-3">
          {COMPROMISSOS.map(({ titulo, texto }) => (
            <div key={titulo} data-poleiro className="space-y-3 rounded-2xl border border-borda bg-painel p-6">
              <h3 className="text-lg">{titulo}</h3>
              <p className="text-sm text-suave">{texto || <TextoQualidade />}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

const PERGUNTAS = [
  {
    get pergunta() {
    return t("Preciso de uma conta Steam?", "Do I need a Steam account?");
  },
    get resposta() {
    return t("Para ver preços, históricos e previsões, não. O login com a Steam libera a Minha lista, onde você salva os itens que acompanha.", "Not to see prices, history and forecasts. Signing in with Steam unlocks My list, where you save the items you follow.");
  },
  },
  {
    get pergunta() {
    return t("Com que frequência os preços são atualizados?", "How often are prices updated?");
  },
    get resposta() {
    return t("A base guarda um preço por dia para cada item. A coleta automática diária está em construção; até lá, cada tela mostra a data do último preço.", "The database keeps one price per day for each item. Automatic daily collection is being built; until then, each screen shows the date of the latest price.");
  },
  },
  {
    get pergunta() {
    return t("As previsões são garantidas?", "Are the forecasts guaranteed?");
  },
    get resposta() {
    return t("Não. São estimativas com uma faixa de incerteza, e o mercado pode sair do esperado — numa atualização do jogo ou num movimento de manipulação, por exemplo.", "No. They are estimates with an uncertainty range, and the market can move unexpectedly — after a game update or a manipulation move, for example.");
  },
  },
  {
    get pergunta() {
    return t("Quais jogos são cobertos?", "Which games are covered?");
  },
    get resposta() {
    return t("Hoje, itens de Team Fortress 2. Outros jogos da Steam vão entrar.", "Team Fortress 2 items for now. Other Steam games are coming.");
  },
  },
];

export function Faq() {
  return (
    <section id="faq" data-tv={t("Perguntas frequentes", "Frequently asked questions")} data-tv-chave="faq" className="scroll-mt-32 py-14 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Rotulo destaque>FAQ</Rotulo>
          <h2 data-poleiro="texto" className="text-4xl titulo sm:text-5xl">{t("Perguntas frequentes", "Frequently asked questions")}</h2>
        </div>
        <div data-poleiro className="divide-y divide-borda border-y border-borda">
          {PERGUNTAS.map(({ pergunta, resposta }) => (
            <details key={pergunta} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg">
                {pergunta}
                <span className="font-mono text-destaque transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-suave">{resposta}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
