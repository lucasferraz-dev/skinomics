import { useHistorico, useItens } from "../../api/itens";
import { diasAntes } from "../../lib/formato";

// A Key é a "moeda" do TF2: é o item que a landing usa como vitrine, com dados reais.
const ITEM_VITRINE = "Mann Co. Supply Crate Key";

export function useItemVitrine(dias: number) {
  const busca = useItens({ busca: ITEM_VITRINE, por_pagina: 1 });
  const item = busca.data?.itens[0];
  const inicio = item?.data_preco ? diasAntes(item.data_preco, dias) : undefined;
  const historico = useHistorico(item?.id ?? 0, inicio, item?.data_preco != null);
  return { item, pontos: historico.data };
}
