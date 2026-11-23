import { useSyncExternalStore } from "react";

/**
 * Idioma do site (português ou inglês). Os textos são escritos lado a lado no próprio componente,
 * `t("Olá", "Hello")`. A página que usa textos traduzidos chama `useIdioma()` no topo, e a troca
 * de idioma a redesenha inteira (sem remontar), então `t` pode ser uma função comum. Textos em
 * constantes de módulo usam getters, para serem lidos na hora.
 */
export type Idioma = "pt" | "en";

const CHAVE = "skinomics:idioma";
const ouvintes = new Set<() => void>();

function inicial(): Idioma {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === "pt" || salvo === "en") return salvo;
  } catch {
    /* sem armazenamento: decide pelo navegador */
  }
  return navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en";
}

let atual: Idioma = typeof window === "undefined" ? "pt" : inicial();
if (typeof document !== "undefined") document.documentElement.lang = atual === "pt" ? "pt-BR" : "en";

export const idiomaAtual = () => atual;
export const localeAtual = () => (atual === "en" ? "en-US" : "pt-BR");

/** Texto no idioma atual. */
export const t = (pt: string, en: string) => (atual === "en" ? en : pt);

export function trocarIdioma(novo: Idioma) {
  atual = novo;
  document.documentElement.lang = novo === "pt" ? "pt-BR" : "en";
  try {
    localStorage.setItem(CHAVE, novo);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function useIdioma(): Idioma {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    idiomaAtual,
    () => "pt",
  );
}
