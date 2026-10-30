import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { BASE, enviar, ErroApi, obter } from "./cliente";
import type { components } from "./esquema";

export type UsuarioAtual = components["schemas"]["UsuarioAtual"];

/** Navegação de página inteira, não fetch: a API redireciona para a Steam e a Steam volta para o site. */
export const URL_LOGIN_STEAM = `${BASE}/auth/steam`;

/** Usuário logado, ou `null` quando não há sessão. */
export function useUsuario() {
  return useQuery({
    queryKey: ["usuario"],
    queryFn: async (): Promise<UsuarioAtual | null> => {
      try {
        return await obter<UsuarioAtual>("/auth/eu");
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) return null;
        throw erro;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useSair() {
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: () => enviar("/auth/sair"),
    onSuccess: () => consultas.setQueryData(["usuario"], null),
  });
}
