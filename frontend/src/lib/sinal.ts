/**
 * Leitura do modelo, no estilo touro e urso: cinco níveis tirados da previsão e da faixa de 80%, sem
 * nenhuma conta nova. É uma leitura do que o modelo prevê, não uma recomendação de investimento.
 *
 * Alta forte: até o limite de baixo da faixa fica acima do preço-base (o pior caso ainda sobe).
 * Baixa forte: até o limite de cima fica abaixo (o melhor caso ainda cai).
 * Alta e baixa: o centro da previsão sobe ou cai mais que MARGEM_NEUTRA, mas a faixa cruza o preço.
 * Neutro: o centro fica perto do preço-base.
 * Sem leitura: sem previsão com faixa, item no piso de preço da Steam, pouco volume (o preço de item pouco
 * negociado engana) ou faixa larga demais (o mesmo limite de "incerteza elevada" do risco das oportunidades).
 *
 * O piso: no teste do modelo de 7 dias, 99,6% das "altas fortes" eram itens a US$ 0,03, o menor preço do
 * mercado. Dali o preço não tem como cair, então o pior caso "sobe" quase por definição, mas um centavo a
 * mais não paga a taxa da Steam. Sem essa regra, o medidor mostraria isso como oportunidade.
 */

export type NivelSinal = "baixa_forte" | "baixa" | "neutro" | "alta" | "alta_forte";
export type MotivoSemSinal = "sem_previsao" | "piso" | "pouco_volume" | "incerteza_alta";

export type Sinal =
  | {
      tipo: "leitura";
      nivel: NivelSinal;
      /** Variação prevista do centro, do pior caso e do melhor caso, sobre o preço-base (frações). */
      margem: number;
      piso: number;
      teto: number;
      /** Posição do ponteiro do medidor, de -1 (urso) a 1 (touro). */
      ponteiro: number;
      desatualizado: boolean;
    }
  | { tipo: "sem"; motivo: MotivoSemSinal };

type PrevisaoParaSinal = {
  disponivel: boolean;
  desatualizada?: boolean;
  preco_base?: number | null;
  preco_previsto?: number | null;
  intervalo_inferior?: number | null;
  intervalo_superior?: number | null;
};

export const NIVEIS: NivelSinal[] = ["baixa_forte", "baixa", "neutro", "alta", "alta_forte"];
// Cerca de 10 vendas por dia na semana.
export const VOLUME_MINIMO_SINAL = 70;
export const MARGEM_NEUTRA = 0.01;
// Faixa mais larga que metade do preço previsto.
export const LARGURA_MAXIMA = 0.5;
// O menor preço do Mercado da Steam é US$ 0,03; até meio centavo acima ainda conta como piso.
export const PRECO_PISO = 0.035;
// O comprador paga cerca de 15% a mais do que o vendedor recebe (taxas da Steam e do jogo).
export const TAXA_STEAM = 0.15;

const CENTRO_DO_NIVEL: Record<NivelSinal, number> = { baixa_forte: -0.8, baixa: -0.4, neutro: 0, alta: 0.4, alta_forte: 0.8 };

export function sinalDoModelo(previsao: PrevisaoParaSinal | undefined, volume7d: number | null | undefined): Sinal {
  const base = previsao?.preco_base;
  const previsto = previsao?.preco_previsto;
  const inferior = previsao?.intervalo_inferior;
  const superior = previsao?.intervalo_superior;
  if (!previsao?.disponivel || base == null || previsto == null || inferior == null || superior == null || base <= 0 || previsto <= 0) {
    return { tipo: "sem", motivo: "sem_previsao" };
  }
  if (base <= PRECO_PISO) return { tipo: "sem", motivo: "piso" };
  if ((volume7d ?? 0) < VOLUME_MINIMO_SINAL) return { tipo: "sem", motivo: "pouco_volume" };
  if ((superior - inferior) / previsto > LARGURA_MAXIMA) return { tipo: "sem", motivo: "incerteza_alta" };

  const margem = previsto / base - 1;
  const piso = inferior / base - 1;
  const teto = superior / base - 1;
  const nivel: NivelSinal =
    piso > 0 ? "alta_forte" : teto < 0 ? "baixa_forte" : margem > MARGEM_NEUTRA ? "alta" : margem < -MARGEM_NEUTRA ? "baixa" : "neutro";
  // Dentro do setor do nível, o ponteiro ainda se inclina um pouco conforme o tamanho da margem.
  const ajuste = Math.max(-1, Math.min(1, margem / 0.1)) * 0.12;
  const ponteiro = Math.max(-0.95, Math.min(0.95, CENTRO_DO_NIVEL[nivel] + ajuste));
  return { tipo: "leitura", nivel, margem, piso, teto, ponteiro, desatualizado: Boolean(previsao.desatualizada) };
}
