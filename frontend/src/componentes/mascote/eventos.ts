/**
 * Avisos que o resto da página manda para o corvo, sem precisar conhecê-lo: alguém mexeu no poleiro
 * dele, o modo TV mudou de seção, o tutorial mudou de passo. `null` como detalhe quer dizer "acabou".
 */
export const EVENTO_POLEIRO_MEXIDO = "skinomics:poleiro-mexido"; // detalhe: o elemento mexido
export const EVENTO_TV = "skinomics:tv-secao"; // detalhe: a seção na tela, ou null ao sair
export const EVENTO_PUXAR_CHAVEIRO = "skinomics:puxar-chaveiro"; // detalhe: o svg do chaveiro
export const EVENTO_TUTORIAL = "skinomics:tutorial-passo"; // detalhe: PassoTutorial, ou null ao fechar

/** O passo atual e o que cada mascote diz nele. */
export type PassoTutorial = { alvo: Element | null; titulo: string; corvo?: string; coruja?: string };

export function avisar(evento: string, detalhe: unknown) {
  window.dispatchEvent(new CustomEvent(evento, { detail: detalhe }));
}
