import { useQuery } from "@tanstack/react-query";

import { obter } from "./cliente";
import type { components } from "./esquema";

export type ModeloAtivoResumo = components["schemas"]["ModeloAtivoResumo"];

/** Modelo publicado em cada horizonte, com as métricas do teste temporal. */
export function useModelosAtivos() {
  return useQuery({
    queryKey: ["modelos", "ativos"],
    queryFn: () => obter<ModeloAtivoResumo[]>("/modelos/ativos"),
    staleTime: 10 * 60_000,
  });
}
