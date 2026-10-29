import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { components, paths } from "./esquema";

// Os tipos vêm do contrato da API (src/api/esquema.d.ts, gerado por `npm run api:tipos`):
// se o back-end mudar um campo, o TypeScript acusa aqui no front.
export type ItemResumo = components["schemas"]["ItemResumo"];
export type PaginaItens = components["schemas"]["PaginaItens"];
export type PontoHistorico = components["schemas"]["PontoHistorico"];
export type FiltrosItens = NonNullable<paths["/itens"]["get"]["parameters"]["query"]>;

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

type Parametros = Record<string, string | number | null | undefined>;

async function obter<T>(caminho: string, parametros: Parametros = {}): Promise<T> {
  const url = new URL(BASE + caminho, window.location.origin);
  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(nome, String(valor));
    }
  }

  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, `GET ${caminho} respondeu ${resposta.status}`);
  }
  return resposta.json() as Promise<T>;
}

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
