import type { PontoHistorico, PrevisaoItem } from "../api/itens";

export type PontoGrafico = {
  data: string;
  instante: number;
  preco: number | null;
  precoPrevisto?: number;
  volume: number | null;
  preenchido: boolean;
};

export function intervaloValido(previsao?: PrevisaoItem) {
  const inferior = previsao?.intervalo_inferior;
  const superior = previsao?.intervalo_superior;
  const preco = previsao?.preco_previsto;
  if (!previsao?.disponivel || previsao.nivel_confianca !== 0.8
    || inferior == null || superior == null || preco == null
    || !Number.isFinite(inferior) || !Number.isFinite(superior) || !Number.isFinite(preco)
    || inferior <= 0 || inferior > preco || superior < preco) return null;
  return { inferior, superior };
}

export function prepararGrafico(pontos: PontoHistorico[], previsao?: PrevisaoItem) {
  const dados: PontoGrafico[] = pontos.map((ponto) => ({
    ...ponto,
    instante: Date.parse(`${ponto.data}T00:00:00Z`),
  }));
  const ultimo = dados.at(-1);
  const inicio = Date.parse(`${previsao?.janela_inicio}T00:00:00Z`);
  const alvo = Date.parse(`${previsao?.data_alvo}T00:00:00Z`);
  const fim = Date.parse(`${previsao?.janela_fim}T00:00:00Z`);
  // Não conecta uma estimativa antiga a um preço-base que o modelo não utilizou.
  const compativel = !!(
    ultimo && previsao?.disponivel
    && previsao.data_base === ultimo.data
    && previsao.preco_base != null && ultimo.preco != null
    && Math.abs(previsao.preco_base - ultimo.preco) < 1e-6
    && previsao.preco_previsto != null && Number.isFinite(previsao.preco_previsto)
    && previsao.preco_previsto > 0
    && Number.isFinite(inicio) && Number.isFinite(alvo) && Number.isFinite(fim)
    && ultimo.instante < inicio && inicio <= alvo && alvo <= fim
  );
  if (!compativel || !ultimo || !previsao) return { dados, futuro: null };

  ultimo.precoPrevisto = ultimo.preco!;
  // Há uma única estimativa da média futura. A ligação não cria previsões diárias.
  dados.push({
    data: previsao.data_alvo!, instante: alvo, preco: null,
    precoPrevisto: previsao.preco_previsto!, volume: null, preenchido: false,
  });
  return { dados, futuro: { base: ultimo.instante, inicio, alvo, fim, previsao, intervalo: intervaloValido(previsao) } };
}
