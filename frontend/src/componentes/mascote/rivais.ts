import type { Poleiro } from "./poleiros";

/**
 * Onde cada mascote está (no mesmo sistema de coordenadas, o da página) e como enxotá-lo. É assim
 * que o corvo acha a coruja para implicar com ela.
 */
export type Presenca = { x: number; y: number; poleiro: Poleiro | null; enxotar: () => void };

export const presencas = new Map<string, Presenca>();
