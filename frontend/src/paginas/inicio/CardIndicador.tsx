import type { CSSProperties, ReactNode } from "react";

import { Adesivo } from "./Adesivo";

// Ícones de traço (24×24), no mesmo estilo dos demais da landing.
export const ICONES = {
  itens: "M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5",
  calendario: "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 8h3v3H8z",
  oportunidade: "M3 17l6-6 4 4 7-7m0 0h-5m5 0v5",
  horizonte: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  preco: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  volume: "M5 20v-5M10 20V9M15 20v-8M20 20V4",
  variacao: "M3 17l6-6 4 4 7-7m0 0h-5m5 0v5",
} as const;

export type Indicador = {
  rotulo: string;
  valor: ReactNode;
  detalhe: string;
  icone: keyof typeof ICONES;
  para?: string;
  /** O que aparece escrito embaixo do adesivo quando ele é descolado. */
  verso: { rotulo: string; valor: ReactNode; extra?: string };
};

// Os indicadores são adesivos compactos nas cores do site, alternando verde-limão e preto. Dá para
// descolar puxando a ponta (ver Adesivo.tsx), e um reflexo de vinil passa ao mover o mouse.
const TINTAS = {
  verde: {
    "--fundo": "var(--color-destaque)",
    "--contorno": "transparent",
    "--numero": "#0b0d0c",
    "--rotulo": "rgba(11, 13, 12, 0.72)",
    "--detalhe": "rgba(11, 13, 12, 0.62)",
    "--icone-fundo": "#0b0d0c",
    "--icone-traco": "var(--color-destaque)",
    "--verso": "#97bd4f",
  },
  preto: {
    "--fundo": "#10140f",
    "--contorno": "rgba(198, 243, 107, 0.35)",
    "--numero": "var(--color-destaque)",
    "--rotulo": "var(--color-suave)",
    "--detalhe": "var(--color-apagado)",
    "--icone-fundo": "var(--color-destaque)",
    "--icone-traco": "#0b0d0c",
    "--verso": "#2b3427",
  },
} as const;

export const ADESIVOS = ["verde", "preto", "verde", "preto"] as const;

export function CardIndicador({ rotulo, valor, detalhe, icone, para, verso, adesivo }: Indicador & { adesivo: (typeof ADESIVOS)[number] }) {
  return (
    <Adesivo
      estilo={TINTAS[adesivo] as unknown as CSSProperties}
      para={para}
      titulo={detalhe}
      verso={verso}
      frente={
        <>
          {/* Reflexo do vinil: desliza pelo adesivo quando o mouse passa */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,0.28)_47%,transparent_56%)] bg-[length:250%_100%] bg-[position:100%_0] transition-[background-position] duration-700 group-hover:bg-[position:0%_0]"
          />
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--icone-fundo)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--icone-traco)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICONES[icone]} />
            </svg>
          </span>
          <div className="relative min-w-0">
            <span className="block truncate font-rotulo text-[11px] font-bold tracking-[0.06em] text-[var(--rotulo)]">
              {rotulo}
              {para && <span aria-hidden> ↗</span>}
            </span>
            <p className="titulo text-xl leading-tight text-[var(--numero)] sm:text-2xl">{valor}</p>
            <p className="truncate font-mono text-[10px] text-[var(--detalhe)]">{detalhe}</p>
          </div>
        </>
      }
    />
  );
}
