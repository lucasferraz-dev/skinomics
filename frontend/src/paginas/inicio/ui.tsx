import type { ReactNode } from "react";
import { Link } from "react-router";

import { Rotulo } from "../../componentes/Basicos";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

/** Seta ↗ que, no hover do botão, sai pela diagonal e é substituída por outra entrando do lado oposto. */
export function SetaTrocando() {
  return (
    <span aria-hidden className="relative inline-block size-3.5 overflow-hidden leading-none">
      <span className="absolute inset-0 grid place-items-center transition-transform duration-300 ease-out group-hover/botao:translate-x-full group-hover/botao:-translate-y-full">
        ↗
      </span>
      <span className="absolute inset-0 grid -translate-x-full translate-y-full place-items-center transition-transform duration-300 ease-out group-hover/botao:translate-x-0 group-hover/botao:translate-y-0">
        ↗
      </span>
    </span>
  );
}

/**
 * Botão principal: verde-limão. No hover sobe com um brilho verde embaixo, uma faixa de luz
 * atravessa e a seta é trocada; ao clicar, afunda um pouco.
 */
export function BotaoPrimario({ para, children }: { para: string; children: ReactNode }) {
  return (
    <Link
      to={para}
      className="group/botao relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-destaque px-4 py-2.5 text-sm font-medium whitespace-nowrap text-fundo transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_rgba(198,243,107,0.7)] active:translate-y-0 active:scale-[0.97]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/45 opacity-0 transition-[left,opacity] duration-700 group-hover/botao:left-[120%] group-hover/botao:opacity-100"
      />
      <span className="relative">{children}</span>
      <SetaTrocando />
    </Link>
  );
}

const CLASSE_SECUNDARIO = {
  md: "px-4 py-2.5 text-sm",
  sm: "px-3 py-1.5 text-xs",
};

/**
 * Botão secundário: contorno. No hover o fundo se preenche da esquerda para a direita em verde
 * translúcido, a borda e o texto ficam verdes e o ícone se mexe; ao clicar, afunda um pouco.
 * Vira link interno (`para`), âncora (`href`) ou botão (`aoClicar`).
 */
export function BotaoSecundario({
  para,
  href,
  aoClicar,
  icone,
  tamanho = "md",
  className = "",
  children,
}: {
  para?: string;
  href?: string;
  aoClicar?: () => void;
  icone?: ReactNode;
  tamanho?: keyof typeof CLASSE_SECUNDARIO;
  className?: string;
  children: ReactNode;
}) {
  const classe = `group/botao relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-lg border border-borda whitespace-nowrap transition-[color,border-color,transform] duration-300 hover:border-destaque/60 hover:text-destaque active:scale-[0.97] ${CLASSE_SECUNDARIO[tamanho]} ${className}`;
  const conteudo = (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-destaque/10 transition-transform duration-300 ease-out group-hover/botao:scale-x-100"
      />
      {icone && <span className="relative inline-flex">{icone}</span>}
      <span className="relative">{children}</span>
    </>
  );
  if (para) {
    return (
      <Link to={para} className={classe}>
        {conteudo}
      </Link>
    );
  }
  if (href) {
    // Link de fora do site abre em outra aba, para não perder a página atual.
    const externo = /^https?:/.test(href);
    return (
      <a href={href} className={classe} {...(externo && { target: "_blank", rel: "noopener noreferrer" })}>
        {conteudo}
      </a>
    );
  }
  return (
    <button type="button" onClick={aoClicar} className={classe}>
      {conteudo}
    </button>
  );
}

/** Rótulo + título grande à esquerda, texto de apoio à direita: o padrão das seções do Figma. */
export function CabecalhoSecao({
  rotulo,
  titulo,
  texto,
  selo,
  nivel = 2,
}: {
  /** 1 quando o cabeçalho é o título da página (fora da landing). */
  nivel?: 1 | 2;
  rotulo: string;
  titulo: ReactNode;
  texto: string;
  selo?: string;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    // Grade, não flex-wrap: título comprido quebra dentro da coluna em vez de empurrar o texto para baixo.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-16">
      <div className="max-w-2xl space-y-4">
        <Rotulo destaque>{rotulo}</Rotulo>
        <Titulo data-poleiro="texto" className="text-4xl leading-[1.08] titulo sm:text-5xl">{titulo}</Titulo>
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
