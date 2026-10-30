// Datas da API chegam como "AAAA-MM-DD" (dia, sem hora). Tudo aqui trata o dia em UTC
// para o fuso do navegador não empurrar a data para o dia anterior.

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" });
const moedaFina = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
});
const percentual = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const inteiro = new Intl.NumberFormat("pt-BR");
const diaMes = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const dataCompleta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" });

/** Item barato varia na terceira casa (US$ 0,255); acima de um dólar, duas casas bastam. */
export function formatarPreco(valor: number): string {
  return (valor < 1 ? moedaFina : moeda).format(valor);
}

/** 0.042 → "+4,2%" */
export function formatarVariacao(fracao: number): string {
  return percentual.format(fracao);
}

export function formatarInteiro(valor: number): string {
  return inteiro.format(valor);
}

function paraData(iso: string): Date {
  const [ano = 0, mes = 1, dia = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** "2026-10-01" → "01 OUT" (eixo do gráfico) */
export function formatarDiaMes(iso: string): string {
  return diaMes.format(paraData(iso)).replace(" de ", " ").replace(".", "").toUpperCase();
}

/** "2026-10-01" → "1 de out. de 2026" */
export function formatarData(iso: string): string {
  return dataCompleta.format(paraData(iso));
}

const instante = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

/** Data e hora completas da API (ex.: quando entrou na lista), no fuso de quem está vendo. */
export function formatarInstante(iso: string): string {
  return instante.format(new Date(iso));
}

export function diasAntes(iso: string, dias: number): string {
  const data = paraData(iso);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}
