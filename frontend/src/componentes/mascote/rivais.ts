import type { Poleiro } from "./poleiros";

/**
 * Onde cada mascote está e para onde está indo (no sistema de coordenadas da página), e como provocá-lo.
 * É assim que um evita pousar dentro do outro e que os dois implicam um com o outro.
 */
export type Presenca = {
  x: number;
  y: number;
  poleiro: Poleiro | null;
  /** Destino do voo em andamento, para o outro não escolher o mesmo lugar. */
  alvo: { chave: string; x: number; y: number } | null;
  /** Foi provocado: sai ou finca o pé. */
  enxotar: () => void;
  /** Provocou e o outro fincou o pé: desiste e vai embora. */
  recuar: () => void;
};

export const presencas = new Map<string, Presenca>();

/** Distância mínima entre os dois quando estão na mesma altura (px), mesmo em poleiros vizinhos (ex.: letras). */
export const DISTANCIA = 56;
export const MESMA_ALTURA = 14;
