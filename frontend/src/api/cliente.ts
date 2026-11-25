export const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

type Parametros = Record<string, string | number | null | undefined>;

export async function obter<T>(caminho: string, parametros: Parametros = {}): Promise<T> {
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

/**
 * Envia um corpo JSON e devolve a resposta. No erro, a mensagem é o `detail` da API (em português),
 * para a tela mostrar o motivo de verdade (ex.: "o preço de hoje já passou desse alvo").
 */
export async function enviarJson<T>(caminho: string, metodo: "POST" | "PATCH", corpo: unknown): Promise<T> {
  const resposta = await fetch(BASE + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.json().then((json: { detail?: unknown }) => json.detail, () => undefined);
    throw new ErroApi(resposta.status, typeof detalhe === "string" ? detalhe : `${metodo} ${caminho} respondeu ${resposta.status}`);
  }
  return resposta.json() as Promise<T>;
}

export async function enviar(caminho: string, metodo: "POST" | "PUT" | "DELETE" = "POST"): Promise<void> {
  const resposta = await fetch(BASE + caminho, { method: metodo });
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, `${metodo} ${caminho} respondeu ${resposta.status}`);
  }
}
