import type { ReactNode } from "react";

import { formatarVariacao } from "../lib/formato";

/** Rótulo em caixa alta e fonte mono, com o quadradinho verde do design. */
export function Rotulo({ children, marcador = false }: { children: ReactNode; marcador?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-suave">
      {marcador && <span className="size-1.5 bg-destaque" aria-hidden />}
      {children}
    </span>
  );
}

export function Variacao({ valor, sufixo }: { valor: number | null | undefined; sufixo?: string }) {
  if (valor === null || valor === undefined) {
    return <span className="font-mono text-apagado">—</span>;
  }
  // A cor segue o número exibido: +0,04% aparece como "0,0%" e não deve ficar verde.
  const exibido = Math.round(valor * 1000);
  const cor = exibido > 0 ? "text-destaque" : exibido < 0 ? "text-queda" : "text-suave";
  return (
    <span className={`font-mono ${cor}`}>
      {formatarVariacao(valor)}
      {sufixo && <span className="text-apagado"> / {sufixo}</span>}
    </span>
  );
}

export function IconeItem({ url, nome, tamanho = 40 }: { url: string | null; nome: string; tamanho?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-md border border-borda bg-painel-alto"
      style={{ width: tamanho, height: tamanho }}
    >
      {url ? (
        // A Steam serve a imagem no tamanho pedido no fim da URL.
        <img src={`${url}/${tamanho * 2}fx${tamanho * 2}f`} alt="" className="size-full object-contain p-1" />
      ) : (
        <span className="font-mono text-xs text-apagado">{nome.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

export function Painel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-borda bg-painel ${className}`}>{children}</section>;
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <p className="animate-pulse p-8 text-center font-mono text-xs text-apagado">{texto}</p>;
}

export function MensagemErro({ titulo, detalhe }: { titulo: string; detalhe?: string }) {
  return (
    <div className="p-8 text-center">
      <p className="text-texto">{titulo}</p>
      {detalhe && <p className="mt-1 text-sm text-suave">{detalhe}</p>}
    </div>
  );
}
