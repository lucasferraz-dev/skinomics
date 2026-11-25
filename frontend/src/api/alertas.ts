import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUsuario } from "./auth";
import { enviar, enviarJson, obter } from "./cliente";
import type { components } from "./esquema";

export type Alerta = components["schemas"]["AlertaResumo"];
export type CondicaoAlerta = Alerta["condicao"];
export type NovoAlerta = components["schemas"]["NovoAlerta"];
export type MudancaAlerta = components["schemas"]["MudancaAlerta"];

/** Só consulta com alguém logado: sem sessão a API responderia 401 de qualquer jeito. */
export function useAlertas() {
  const { data: usuario } = useUsuario();
  return useQuery({
    queryKey: ["alertas", "todos", usuario?.id],
    queryFn: () => obter<Alerta[]>("/alertas"),
    enabled: Boolean(usuario),
  });
}

/** Os disparados ainda não vistos, que acendem o sino. Os preços mudam uma vez por dia. */
export function useAvisos() {
  const { data: usuario } = useUsuario();
  return useQuery({
    queryKey: ["alertas", "avisos", usuario?.id],
    queryFn: () => obter<Alerta[]>("/alertas/avisos"),
    enabled: Boolean(usuario),
    refetchInterval: 10 * 60_000,
  });
}

function useInvalidarAlertas() {
  const consultas = useQueryClient();
  return () => consultas.invalidateQueries({ queryKey: ["alertas"] });
}

export function useCriarAlerta() {
  const invalidar = useInvalidarAlertas();
  return useMutation({
    mutationFn: (novo: NovoAlerta) => enviarJson<Alerta>("/alertas", "POST", novo),
    onSuccess: invalidar,
  });
}

export function useAtualizarAlerta() {
  const invalidar = useInvalidarAlertas();
  return useMutation({
    mutationFn: ({ id, ...mudanca }: MudancaAlerta & { id: number }) => enviarJson<Alerta>(`/alertas/${id}`, "PATCH", mudanca),
    onSuccess: invalidar,
  });
}

export function useRemoverAlerta() {
  const invalidar = useInvalidarAlertas();
  return useMutation({
    mutationFn: (id: number) => enviar(`/alertas/${id}`, "DELETE"),
    onSuccess: invalidar,
  });
}

export function useMarcarVistos() {
  const invalidar = useInvalidarAlertas();
  return useMutation({
    mutationFn: () => enviar("/alertas/avisos/vistos"),
    onSuccess: invalidar,
  });
}

/**
 * Quanto o preço ainda precisa andar até o alvo, em fração do preço de hoje (0.08 = falta 8%).
 * Negativo quando o preço já passou do alvo (o alerta dispara na próxima checagem).
 */
export function quantoFalta(alerta: Pick<Alerta, "condicao" | "preco_alvo">, precoAtual: number | null): number | null {
  if (precoAtual === null || precoAtual <= 0) return null;
  return alerta.condicao === "abaixo" ? 1 - alerta.preco_alvo / precoAtual : alerta.preco_alvo / precoAtual - 1;
}
