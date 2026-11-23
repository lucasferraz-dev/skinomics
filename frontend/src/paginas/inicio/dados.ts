import { t } from "../../lib/idioma";
import { useSyncExternalStore } from "react";

import { type ItemResumo, useHistorico, useItens } from "../../api/itens";
import { diasAntes } from "../../lib/formato";

// A vitrine da landing não fixa nenhum item: a cada visita sorteia um motivo (maior alta, maior queda,
// mais negociado ou um item qualquer) e um item que se encaixa nele. O botão "Outro item" sorteia de
// novo. A escolha fica num estado do módulo para a vitrine e a prévia do Terminal mostrarem o mesmo item.

export type Motivo = "alta" | "queda" | "volume" | "aleatorio";

const ROTULOS: Record<Motivo, string> = {
  get alta() {
    return t("Maior alta em 7 dias", "Biggest 7-day rise");
  },
  get queda() {
    return t("Maior queda em 7 dias", "Biggest 7-day drop");
  },
  get volume() {
    return t("Mais negociado da semana", "Most traded this week");
  },
  get aleatorio() {
    return t("Item aleatório", "Random item");
  },
};

// Abaixo disso a variação vem de pouquíssimas vendas e não diz muito.
const VOLUME_MINIMO = 50;
// Alta/queda/volume sorteiam entre os primeiros do ranking, para a vitrine variar entre visitas.
const TOPO = 3;

let escolha: { id: number; motivo: Motivo } | null = null;
const ouvintes = new Set<() => void>();

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function sortear<T>(lista: T[]): T | undefined {
  return lista[Math.floor(Math.random() * lista.length)];
}

function escolher(itens: ItemResumo[], evitar?: number, notificar = true) {
  const validos = itens.filter(
    (item) => item.icon_url && item.preco_atual != null && item.variacao_7d != null && item.id !== evitar,
  );
  const negociados = validos.filter((item) => (item.volume_7d ?? 0) >= VOLUME_MINIMO);
  const ordenar = (chave: (item: ItemResumo) => number) => [...negociados].sort((a, b) => chave(b) - chave(a));
  const opcoes: Record<Motivo, ItemResumo[]> = {
    alta: ordenar((item) => item.variacao_7d!).filter((item) => item.variacao_7d! > 0).slice(0, TOPO),
    queda: ordenar((item) => -item.variacao_7d!).filter((item) => item.variacao_7d! < 0).slice(0, TOPO),
    volume: ordenar((item) => item.volume_7d ?? 0).slice(0, TOPO),
    aleatorio: validos,
  };
  const motivo = sortear((Object.keys(opcoes) as Motivo[]).filter((m) => opcoes[m].length > 0));
  const item = motivo && sortear(opcoes[motivo]);
  if (motivo && item) {
    escolha = { id: item.id, motivo };
    if (notificar) ouvintes.forEach((ouvinte) => ouvinte());
  }
}

export function useItemVitrine(dias: number) {
  const { data } = useItens({ por_pagina: 100 });
  const atual = useSyncExternalStore(assinar, () => escolha);
  const itens = data?.itens ?? [];
  // Primeira escolha, durante a renderização: sem notificar (os outros leem o valor ao renderizar).
  if (!atual && !escolha && itens.length) escolher(itens, undefined, false);

  const item = itens.find((candidato) => candidato.id === (atual ?? escolha)?.id);
  const motivo = (atual ?? escolha)?.motivo;
  const inicio = item?.data_preco ? diasAntes(item.data_preco, dias) : undefined;
  const historico = useHistorico(item?.id ?? 0, inicio, item?.data_preco != null);

  return {
    item,
    pontos: historico.data,
    motivo: motivo ? ROTULOS[motivo] : undefined,
    tipoMotivo: motivo,
    trocar: () => escolher(itens, item?.id),
  };
}
