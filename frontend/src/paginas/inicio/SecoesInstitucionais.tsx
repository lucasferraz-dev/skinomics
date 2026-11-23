import { useModelosAtivos } from "../../api/modelos";
import { Rotulo } from "../../componentes/Basicos";
import { CabecalhoSecao, Container } from "./ui";

// "Como funciona" em uma faixa compacta: três passos com ícone e uma frase curta, ligados por uma linha.
const PASSOS = [
  {
    titulo: "Busque o item",
    texto: "pelo nome, entre os itens monitorados",
    icone: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20",
  },
  {
    titulo: "Veja histórico e previsão",
    texto: "7, 15 ou 30 dias, com faixa de 80%",
    icone: "M4 18 9 12l4 3 7-9M15 6h5v5",
  },
  {
    titulo: "Acompanhe",
    texto: "na sua lista ou no ranking de oportunidades",
    icone: "M7 4h10v16l-5-3.5L7 20z",
  },
];

/** Seção 4: como funciona, em três passos. */
export function FluxoSimples() {
  return (
    <section id="como-funciona" className="scroll-mt-32 py-14 sm:py-20">
      <Container className="space-y-8">
        <Rotulo destaque>Como funciona</Rotulo>
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
    titulo: "De onde vêm os dados",
    texto:
      "Do histórico diário do Mercado da Comunidade Steam: preço e volume de cada item, alguns desde 2012. Nada é inventado ou ajustado à mão.",
  },
  {
    titulo: "Quão bom é o modelo",
    // Preenchido com as métricas do modelo ativo (ver TextoQualidade).
    texto: "",
  },
  {
    titulo: "O que não fazemos",
    texto:
      "Não compramos nem vendemos itens, não guardamos dinheiro e não damos recomendação de investimento. Previsão é estimativa; a decisão é sua.",
  },
];

const percentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Métricas do modelo de 7 dias em produção, lidas da API: mudam sozinhas a cada retreino. */
function TextoQualidade() {
  const { data, isError } = useModelosAtivos();
  const sete = data?.find((modelo) => modelo.horizonte === 7);
  // Ex.: o site publicado antes da API com a rota de modelos.
  if (isError) return <>As métricas do modelo em produção estão indisponíveis no momento.</>;
  if (!data) return <>Carregando as métricas do modelo…</>;
  if (!sete?.mape_pct || !sete.acerto_preco_pct) {
    return <>As métricas do modelo em produção ainda não foram publicadas.</>;
  }
  return (
    <>
      No teste com os últimos 180 dias, o modelo de 7 dias errou em média{" "}
      <span className="text-texto">{percentual.format(sete.mape_pct)}%</span> e acertou o preço, com tolerância de
      15%, em <span className="text-texto">{percentual.format(sete.acerto_preco_pct)}%</span> das previsões. Cada
      versão treinada fica registrada com seus números.
    </>
  );
}

/** Transparência: de onde vêm os números e os limites do produto. */
export function Transparencia() {
  return (
    <section id="transparencia" className="scroll-mt-32 py-14 sm:py-28">
      <Container className="space-y-12">
        <CabecalhoSecao
          rotulo="Transparência"
          titulo="De onde vêm os números."
          texto="A origem dos dados, a qualidade do modelo e o que a plataforma não faz."
        />
        <div className="grid gap-4 md:grid-cols-3">
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
    pergunta: "Preciso de uma conta Steam?",
    resposta:
      "Para ver preços, históricos e previsões, não. O login com a Steam libera a Minha lista, onde você salva os itens que acompanha.",
  },
  {
    pergunta: "Com que frequência os preços são atualizados?",
    resposta:
      "A base guarda um preço por dia para cada item. A coleta automática diária está em construção; até lá, cada tela mostra a data do último preço.",
  },
  {
    pergunta: "As previsões são garantidas?",
    resposta:
      "Não. São estimativas com uma faixa de incerteza, e o mercado pode sair do esperado — numa atualização do jogo ou num movimento de manipulação, por exemplo.",
  },
  {
    pergunta: "Quais jogos são cobertos?",
    resposta: "Hoje, itens de Team Fortress 2. Outros jogos da Steam vão entrar.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-32 py-14 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Rotulo destaque>FAQ</Rotulo>
          <h2 data-poleiro="texto" className="text-4xl titulo sm:text-5xl">Perguntas frequentes</h2>
        </div>
        <div className="divide-y divide-borda border-y border-borda">
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
