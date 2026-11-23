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
  ["Corvos guardam coisas brilhantes. Eu guardo cotações.", "Crows hoard shiny things. I hoard quotes."],
  ["Ninguém acerta o mercado sempre. Nem eu, e olha que eu sou um corvo.", "Nobody times the market every time. Not even me, and I'm a crow."],
  ["Entre com a Steam e salve itens na Minha lista.", "Sign in with Steam and save items to My list."],
  ["Clique num terminal dos destaques para ver o item inteiro.", "Click a highlights terminal to see the whole item."],
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
      return () => t("Oi! Sou o corvo do Skinomics. Clica em mim que eu conto umas coisas.", "Hi! I'm the Skinomics crow. Click me and I'll tell you things.");
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

/** A coruja é a analista: fala pouco e sobre previsão. */
export const falaDaCoruja = () =>
  sortearPar([
    ["Huu-huu.", "Hoo-hoo."],
    ["Uma previsão boa diz o quanto pode errar.", "A good forecast tells you how wrong it can be."],
    ["Eu olho a faixa de 80%, não só o número.", "I look at the 80% range, not just the number."],
    ["Previsão de 30 dias erra mais que a de 7. É normal.", "A 30-day forecast misses more than a 7-day one. That's normal."],
    ["Paciência. Item raro anda devagar.", "Patience. Rare items move slowly."],
    ["Eu enxergo melhor à noite. Os preços, de dia.", "I see better at night. Prices, during the day."],
    ["O corvo fala demais.", "The crow talks too much."],
  ]);

/** O que cada um diz quando é espantado. */
export const queixa = (especie: "corvo" | "coruja") =>
  especie === "corvo"
    ? sortearPar([
        ["Cróc!", "Caw!"],
        ["Crá, crá!", "Caw, caw!"],
        ["Ei!", "Hey!"],
        ["Meu poleiro!", "My perch!"],
        ["Cróc?!", "Caw?!"],
      ])
    : sortearPar([
        ["Huu?!", "Hoo?!"],
        ["Que susto.", "What a fright."],
        ["Calma!", "Easy!"],
      ]);

/** A implicância: o corvo pousa do lado da coruja e provoca; ela responde e vai embora. */
export const provocacao = () =>
  sortearPar([
    ["Cróc! Esse card é meu.", "Caw! This card is mine."],
    ["Sai, coruja!", "Shoo, owl!"],
    ["Cróc cróc cróc!", "Caw caw caw!"],
    ["Previsão? Eu tenho é palpite.", "Forecasts? I've got hunches."],
  ]);

export const respostaDaCoruja = () =>
  sortearPar([
    ["Huu... de novo?", "Hoo... again?"],
    ["Que corvo chato.", "What an annoying crow."],
    ["Tá bom, tá bom.", "Fine, fine."],
    ["Vou analisar em outro lugar.", "I'll analyze somewhere else."],
  ]);
