import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUsuario } from "./auth";
import { enviar, obter } from "./cliente";
import type { components } from "./esquema";

export type ItemAcompanhado = components["schemas"]["ItemAcompanhadoResumo"];

/** Só consulta com alguém logado: sem sessão a API responderia 401 de qualquer jeito. */
export function useMinhaLista() {
  const { data: usuario } = useUsuario();
  return useQuery({
    queryKey: ["minha-lista", usuario?.id],
    queryFn: () => obter<ItemAcompanhado[]>("/minha-lista"),
    enabled: Boolean(usuario),
  });
}

export function useAlternarAcompanhamento() {
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, acompanhar }: { itemId: number; acompanhar: boolean }) =>
      enviar(`/minha-lista/${itemId}`, acompanhar ? "PUT" : "DELETE"),
    // Remover tira a linha na hora: recarregar a lista leva um tempo e parecia que o clique falhou.
    onMutate: async ({ itemId, acompanhar }) => {
      if (acompanhar) return;
      await consultas.cancelQueries({ queryKey: ["minha-lista"] });
      const antes = consultas.getQueriesData<ItemAcompanhado[]>({ queryKey: ["minha-lista"] });
      consultas.setQueriesData<ItemAcompanhado[]>({ queryKey: ["minha-lista"] }, (lista) =>
        lista?.filter((item) => item.id !== itemId),
      );
      return { antes };
    },
    onError: (_erro, _variaveis, contexto) => {
      for (const [chave, lista] of contexto?.antes ?? []) consultas.setQueryData(chave, lista);
    },
    onSettled: () => consultas.invalidateQueries({ queryKey: ["minha-lista"] }),
  });
}
