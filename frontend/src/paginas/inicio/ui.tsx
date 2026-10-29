import type { ReactNode } from "react";
import { Link } from "react-router";

import { Rotulo } from "../../componentes/Basicos";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function BotaoPrimario({ para, children }: { para: string; children: ReactNode }) {
  return (
    <Link
      to={para}
      className="inline-flex items-center gap-2 rounded-lg bg-destaque px-4 py-2.5 text-sm font-medium whitespace-nowrap text-fundo transition-opacity hover:opacity-90"
    >
      {children}
      <span aria-hidden>↗</span>
    </Link>
  );
}

/** Rótulo + título grande à esquerda, texto de apoio à direita: o padrão das seções do Figma. */
export function CabecalhoSecao({
  rotulo,
  titulo,
  texto,
  selo,
}: {
  rotulo: string;
  titulo: ReactNode;
  texto: string;
  selo?: string;
}) {
  return (
    // Grade, não flex-wrap: título comprido quebra dentro da coluna em vez de empurrar o texto para baixo.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-16">
      <div className="max-w-2xl space-y-4">
        <Rotulo destaque>{rotulo}</Rotulo>
        <h2 className="text-4xl leading-[1.08] titulo sm:text-5xl">{titulo}</h2>
      </div>
      <div className="space-y-3">
        <p className="text-suave">{texto}</p>
        {selo && (
          <span className="inline-block rounded bg-painel-alto px-2.5 py-1 font-rotulo text-xs font-semibold tracking-[0.06em] text-suave">
            {selo}
          </span>
        )}
      </div>
    </div>
  );
}
