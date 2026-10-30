import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { obter } from "./cliente";
import type { components, paths } from "./esquema";

// Os tipos vêm do contrato da API (src/api/esquema.d.ts, gerado por `npm run api:tipos`):
// se o back-end mudar um campo, o TypeScript acusa aqui no front.
export type ItemResumo = components["schemas"]["ItemResumo"];
export type PaginaItens = components["schemas"]["PaginaItens"];
export type PontoHistorico = components["schemas"]["PontoHistorico"];
export type FiltrosItens = NonNullable<paths["/itens"]["get"]["parameters"]["query"]>;

export function useItens(filtros: FiltrosItens) {
  return useQuery({
    queryKey: ["itens", filtros],
    queryFn: () => obter<PaginaItens>("/itens", filtros),
    // Ao trocar de página ou filtro, a tabela antiga fica na tela até a nova chegar.
    placeholderData: keepPreviousData,
  });
}

export function useItem(id: number) {
  return useQuery({
    queryKey: ["item", id],
    queryFn: () => obter<ItemResumo>(`/itens/${id}`),
  });
}

export function useHistorico(id: number, inicio: string | undefined, habilitado = true) {
  return useQuery({
    queryKey: ["historico", id, inicio],
    queryFn: () => obter<PontoHistorico[]>(`/itens/${id}/historico`, { inicio }),
    enabled: habilitado,
    // O histórico só muda uma vez por dia, com a coleta.
    staleTime: 5 * 60_000,
  });
}
