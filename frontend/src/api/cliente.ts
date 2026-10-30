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

export async function enviar(caminho: string): Promise<void> {
  const resposta = await fetch(BASE + caminho, { method: "POST" });
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, `POST ${caminho} respondeu ${resposta.status}`);
  }
}
