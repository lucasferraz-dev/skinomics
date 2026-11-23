import { t } from "../../lib/idioma";

/** Dicas e comentários do corvo, além dos dados do dia. Pares [português, inglês]. */
const DICAS: [string, string][] = [
  ["Preço que sobe com pouco volume costuma voltar.", "A price rising on low volume often comes back down."],
  ["Previsão é faixa, não promessa. Olhe a faixa de 80%.", "A forecast is a range, not a promise. Check the 80% range."],
  ["Comprar no pânico, vender na euforia. Ou pelo menos tentar.", "Buy in panic, sell in euphoria. Or at least try."],
  ["Item com histórico curto: desconfie da previsão.", "Short price history? Be wary of the forecast."],
  ["Volume alto quer dizer que dá para vender rápido.", "High volume means you can sell quickly."],
  ["A Steam fica com uma parte de cada venda. Conte com isso no lucro.", "Steam keeps a cut of every sale. Count it in your profit."],
  ["Eventos como o Halloween mexem no preço de itens temáticos.", "Events like Halloween move the prices of themed items."],
  ["Caixa que sai de circulação tende a ficar mais rara.", "A crate that leaves circulation tends to get rarer."],
  ["Corvos reconhecem rostos. Eu reconheço preços.", "Crows recognize faces. I recognize prices."],
  ["Muninn quer dizer memória. Por isso eu não esqueço um preço.", "Muninn means memory. That's why I never forget a price."],
  ["Corvos guardam coisas brilhantes. Eu guardo cotações.", "Crows hoard shiny things. I hoard quotes."],
  ["Ninguém acerta o mercado sempre. Nem eu, e olha que eu sou um corvo.", "Nobody times the market every time. Not even me, and I'm a crow."],
  ["Entre com a Steam e salve itens na Minha lista.", "Sign in with Steam and save items to My list."],
  ["Clique num terminal dos destaques para ver o item inteiro.", "Click a highlights terminal to see the whole item."],
  ["Sabia que eu lembro de TODO preço? Todo! Pergunta! Não, sério, pergunta!", "Did you know I remember EVERY price? Every one! Ask me! No, really, ask!"],
  ["A coruja acha que é sábia. Eu acho que ela é lenta. Lenta!", "The owl thinks she's wise. I think she's slow. Slow!"],
  ["Clica de novo! De novo! Eu tenho mais coisa pra falar!", "Click again! Again! I've got more to say!"],
];

export function dicaAleatoria(): string {
  const [pt, en] = DICAS[Math.floor(Math.random() * DICAS.length)]!;
  return t(pt, en);
}

/**
 * Memória do corvo: conta as visitas (só neste navegador) e devolve a saudação desta visita, ou null
 * quando não há nada a dizer. Devolve uma função para o texto sair no idioma da hora em que ele fala.
 */
const CHAVE_VISITAS = "skinomics:corvo-visitas";
type Visitas = { total: number; ultima: string; noDia: number };

function hojeLocal() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function registrarVisita(): (() => string) | null {
  try {
    const hoje = hojeLocal();
    const antes = JSON.parse(localStorage.getItem(CHAVE_VISITAS) ?? "null") as Visitas | null;
    const agora: Visitas = {
      total: (antes?.total ?? 0) + 1,
      ultima: hoje,
      noDia: antes?.ultima === hoje ? antes.noDia + 1 : 1,
    };
    localStorage.setItem(CHAVE_VISITAS, JSON.stringify(agora));
    if (!antes) {
      return () => t("Oi! Sou o Muninn, corvo de Odin. Clica em mim que eu conto umas coisas.", "Hi! I'm Muninn, Odin's raven. Click me and I'll tell you things.");
    }
    const dias = Math.round((Date.parse(hoje) - Date.parse(antes.ultima)) / 86_400_000);
    if (agora.total % 10 === 0) return () => t(`Visita número ${agora.total}! Já é de casa.`, `Visit number ${agora.total}! You're a regular.`);
    if (dias >= 2) return () => t(`Voltou! Faz ${dias} dias.`, `You're back! It's been ${dias} days.`);
    if (dias === 1) return () => t("De volta! Ontem você também passou aqui.", "Back again! You were here yesterday too.");
    if (agora.noDia === 3) return () => t("Terceira visita hoje? Gostou, hein.", "Third visit today? You like it here.");
    if (agora.noDia > 3) return () => t(`Visita ${agora.noDia} de hoje. Eu tô contando.`, `Visit ${agora.noDia} today. I'm counting.`);
    return null;
  } catch {
    return null; // sem armazenamento: ele só não lembra
  }
}

// Uma contagem por carregamento da página (o React pode montar o componente duas vezes em dev).
let saudacao: (() => string) | null | undefined;
let saudacaoDita = false;

export function saudacaoDaVisita(): (() => string) | null {
  if (saudacao === undefined) saudacao = registrarVisita();
  return saudacaoDita ? null : saudacao;
}

export function marcarSaudacaoDita() {
  saudacaoDita = true;
}

const sortearPar = (pares: [string, string][]) => {
  const [pt, en] = pares[Math.floor(Math.random() * pares.length)]!;
  return t(pt, en);
};

/** Glaux: fria, seca, quase sem palavras. Fala o mínimo e sobre o que importa. */
export const falaDaCoruja = () =>
  sortearPar([
    ["Hm.", "Hm."],
    ["Estou analisando. Não interrompa.", "I'm analyzing. Don't interrupt."],
    ["A faixa de 80% diz mais que o número. Leia.", "The 80% range says more than the number. Read it."],
    ["Previsão de 30 dias erra mais que a de 7. Óbvio.", "A 30-day forecast misses more than a 7-day one. Obviously."],
    ["Volume baixo, preço mentiroso.", "Low volume, lying price."],
    ["Ele fala. Eu observo.", "He talks. I watch."],
    ["Já disse o que tinha para dizer.", "I've said what I had to say."],
  ]);

/** O que cada um diz quando é tirado do lugar: ele escandaliza, ela mal reage. */
export const queixa = (especie: "corvo" | "coruja") =>
  especie === "corvo"
    ? sortearPar([
        ["Ei! Ei! EI!", "Hey! Hey! HEY!"],
        ["Meu poleiro! Volta aqui!", "My perch! Come back!"],
        ["Cróc! Que isso?!", "Caw! What was that?!"],
        ["Quem mexeu? Quem foi?!", "Who did that? Who?!"],
      ])
    : sortearPar([
        ["Tch.", "Tsk."],
        ["Que seja.", "Whatever."],
        ["...", "..."],
      ]);

type Especie = "corvo" | "coruja";

/**
 * A rixa: Muninn é ligado no 220, chato, repete, provoca e não larga o osso; Glaux não perde tempo
 * nem com ele. Quem chega provoca; o outro cede ou finca o pé.
 */
export const provocacao = (quem: Especie) =>
  quem === "corvo"
    ? sortearPar([
        ["Glaux! Glaux! Glaux! Sai daí!", "Glaux! Glaux! Glaux! Move!"],
        ["Adivinha quem viu o preço primeiro? EU!", "Guess who saw the price first? ME!"],
        ["Teu modelo é lento! Eu já tô três cotações na frente!", "Your model is slow! I'm three quotes ahead already!"],
        ["Odin mandou dizer que esse card é meu. Mentira, mas sai mesmo assim!", "Odin says this card is mine. Not really, but move anyway!"],
      ])
    : sortearPar([
        ["Saia.", "Leave."],
        ["Você está no meu campo de visão, Muninn.", "You're in my line of sight, Muninn."],
        ["Silêncio. Estou contando volume.", "Quiet. I'm counting volume."],
      ]);

/** Provocado, cede e vai embora. */
export const resposta = (quem: Especie) =>
  quem === "coruja"
    ? sortearPar([
        ["Tá bom, Muninn. Fica com o card.", "Fine, Muninn. Keep the card."],
        ["Tanto faz. Pega esse lugar e me deixa em paz.", "Doesn't matter. Take the spot and leave me alone."],
        ["Que seja. Faz o que quiser com ele.", "Whatever. Do what you want with it."],
      ])
    : sortearPar([
        ["Tá, tá, tá! Mas eu volto já já!", "Fine, fine, fine! But I'll be right back!"],
        ["Coruja chata! Chata, chata, chata!", "Boring owl! Boring, boring, boring!"],
        ["Vou! Mas vou contar pro Odin!", "I'm going! But I'm telling Odin!"],
      ]);

/** Provocado, finca o pé. */
export const resistencia = (quem: Especie) =>
  quem === "coruja"
    ? sortearPar([
        ["Não.", "No."],
        ["Tente de novo daqui a cem anos.", "Try again in a hundred years."],
      ])
    : sortearPar([
        ["Não saio! Não saio! Não saio!", "Not moving! Not moving! Not moving!"],
        ["Pode encarar o quanto quiser, eu fico!", "Stare all you want, I'm staying!"],
      ]);

/** Quem provocou e não levou: recua. */
export const derrota = (quem: Especie) =>
  quem === "corvo"
    ? sortearPar([
        ["Tá bom, mas isso não acabou!", "Fine, but this isn't over!"],
        ["Eu ia sair mesmo! Juro!", "I was leaving anyway! I swear!"],
      ])
    : sortearPar([
        ["Não vale meu tempo.", "Not worth my time."],
        ["Pode ficar. Eu não ligo.", "Keep it. I don't care."],
      ]);

/**
 * O que cada um comenta no modo TV, por seção: algo que ajude quem está assistindo (como a taxa da
 * Steam em cada venda), cada um do seu jeito. Pares [português, inglês].
 */
const FALAS_TV: Record<string, { corvo: [string, string]; coruja: [string, string] }> = {
  inicio: {
    corvo: ["Esse item foi sorteado! Não gostou? \"Outro item\"! Eu troco sempre!", "This item was drawn! Don't like it? \"Another item\"! I always switch!"],
    coruja: ["A previsão diz para onde o preço tende a ir. Não garante.", "The forecast says where the price tends to go. No guarantees."],
  },
  previa: {
    corvo: ["A Steam fica com uma parte de cada venda! Lucro de verdade é depois da taxa!", "Steam keeps a cut of every sale! Real profit comes after the fee!"],
    coruja: ["Se a margem prevista é menor que a taxa da Steam, não há lucro.", "If the forecast margin is smaller than Steam's fee, there's no profit."],
  },
  radar: {
    corvo: ["Muito volume, muita gente comprando! Ou vendendo! Ou os dois!", "Lots of volume, lots of buying! Or selling! Or both!"],
    coruja: ["Volume baixo engana. Desconfie de preço que ninguém negocia.", "Thin volume misleads. Distrust prices nobody trades."],
  },
  "como-funciona": {
    corvo: ["Busca, vê a previsão, acompanha. Fácil! Até a Glaux entende!", "Search, see the forecast, track it. Easy! Even Glaux gets it!"],
    coruja: ["Quanto mais longe a previsão, mais larga a faixa.", "The further out the forecast, the wider the range."],
  },
  destaques: {
    corvo: ["Subiu muito? Caiu muito? Eu quero saber de tudo! TUDO!", "Big rise? Big drop? I want to know everything! EVERYTHING!"],
    coruja: ["Alta forte em pouco volume costuma voltar.", "A sharp rise on thin volume tends to fade."],
  },
  transparencia: {
    corvo: ["Aqui mostra quanto o modelo erra! Eu nunca erro! Quase nunca!", "This shows how much the model misses! I never miss! Almost never!"],
    coruja: ["Desconte a taxa da Steam antes de comemorar uma alta.", "Subtract Steam's fee before celebrating a rise."],
  },
  faq: {
    corvo: ["Dúvida? Pergunta pra mim! Respondo mais rápido! E mais alto!", "Questions? Ask me! I answer faster! And louder!"],
    coruja: ["Item novo tem histórico curto. Previsão fraca.", "A new item has a short history. Weak forecast."],
  },
};

export function falaDaSecao(chave: string, quem: "corvo" | "coruja"): string | null {
  const par = FALAS_TV[chave]?.[quem];
  return par ? t(...par) : null;
}
