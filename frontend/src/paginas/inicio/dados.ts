import { useHistorico, useItens } from "../../api/itens";
import { diasAntes } from "../../lib/formato";

// A vitrine não fixa nenhum item: a cada dia (UTC) mostra um dos mais negociados da semana,
// para ter dados e imagem bons sem eleger um item "principal".
const CANDIDATOS = 8;

export function useItemVitrine(dias: number) {
  const busca = useItens({ ordenar: "volume_7d", direcao: "desc", por_pagina: CANDIDATOS });
  const candidatos = busca.data?.itens ?? [];
  const diaDoAno = Math.floor(Date.now() / 86_400_000);
  const item = candidatos.length ? candidatos[diaDoAno % candidatos.length] : undefined;
  const inicio = item?.data_preco ? diasAntes(item.data_preco, dias) : undefined;
  const historico = useHistorico(item?.id ?? 0, inicio, item?.data_preco != null);
  return { item, pontos: historico.data };
}
