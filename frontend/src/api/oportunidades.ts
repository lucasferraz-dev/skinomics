import { useQuery } from "@tanstack/react-query";

import { obter } from "./cliente";
import type { components } from "./esquema";
import type { HorizontePrevisao } from "./itens";

export type Oportunidade = components["schemas"]["Oportunidade"];
export type RankingOportunidades = components["schemas"]["RankingOportunidades"];

export function useOportunidades(horizonte: HorizontePrevisao, pagina: number) {
  return useQuery({
    queryKey: ["oportunidades", horizonte, pagina],
    queryFn: () => obter<RankingOportunidades>("/oportunidades", { horizonte, pagina, por_pagina: 20 }),
  });
}
