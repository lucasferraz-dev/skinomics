import { useId } from "react";

import { t } from "../../lib/idioma";
import { AsaAberta, type Esqueleto, lamina, n, Penas, type Partes } from "./desenho";

// A coruja do Skinomics, par do corvo de Odin: mesmo traço (contorno verde-limão sobre preto, penas em
// lâmina), mas toda em cortes retos, sem curvas. Cabeça facetada, tufos em chifre, olhos em lâmina sob
// sobrancelhas pesadas, bico em gancho, corpo em escudo marcado com a runa Algiz (ᛉ) e divisas no lugar
// das escamas. Mesmo viewBox 120 × 100 e mesmos quadris do corvo, então as pernas e as poses servem.

const OLHO_Y = 21.2;

export const ESQUELETO_CORUJA: Esqueleto = {
  pescoco: { x: 66, y: 32 },
  ombro: { x: 58, y: 40 },
  baseCauda: { x: 56, y: 84 },
  olhoY: OLHO_Y,
  bico: { x: 69.6, y: 25.6 },
};

const CORPO = "M58 31L71 30L78.4 45L76 63L68.6 79L60 87L51.6 78L49.6 58L54.6 38Z";
const CABECA = "M54.6 14.6L60.6 8.6L72 8.4L80.6 12.8L81.6 21.6L77.2 29.2L69.2 34.4L60 32.4L55 26.2Z";
const DISCO = "M59.8 14.6L69.6 19.2L79.8 14.6L80 23.4L73.4 31L69.4 33.2L63.4 30.4L59.6 24Z";
const ASA_FECHADA = "M57 33L50.4 45.4L49 62L54 86.4L56.4 74L61.2 54.6L61.4 41.4Z";
const BICO_CIMA = "M69 21.8L72.8 24.2L71.8 28.6L69.6 25.6Z";
const BICO_BAIXO = "M69.6 25.6L71.4 26.8L71 28.2L69.4 27.2Z";

// Tufos em chifre: duas lâminas longas de cada lado, abertas para fora.
const TUFOS = [
  lamina({ x: 57.2, y: 12.4 }, -132, 15, 2.2),
  lamina({ x: 59.8, y: 10.6 }, -114, 11, 1.8),
  lamina({ x: 77.4, y: 12 }, -50, 15, 2.2),
  lamina({ x: 74.6, y: 10.2 }, -70, 11, 1.8),
];
const PRIMARIAS = [
  lamina({ x: 52, y: 66 }, 101, 24, 2.3),
  lamina({ x: 54.2, y: 64 }, 97, 23, 2.2),
  lamina({ x: 56.4, y: 62 }, 94, 21, 2.1),
];
const CAUDA = [lamina({ x: 56, y: 84 }, 112, 9, 1.9), lamina({ x: 58.4, y: 84.6 }, 100, 9, 1.9)];

/** Fileiras de divisas (pequenos "v"): a "plumagem" da coruja, toda em ângulos. */
function divisas(x0: number, y0: number, x1: number, y1: number, passo: number) {
  let d = "";
  let linha = 0;
  for (let y = y0; y <= y1; y += passo * 0.9, linha++) {
    for (let x = x0 + (linha % 2 ? passo / 2 : 0); x <= x1; x += passo) {
      d += `M${n(x)} ${n(y)}l${n(passo / 2)} ${n(passo * 0.55)}l${n(passo / 2)} ${n(-passo * 0.55)}`;
    }
  }
  return d;
}

export function CorujaSvg({ partes, largura, altura, aoClicar }: { partes: Partes; largura: number; altura: number; aoClicar?: () => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 100" width={largura} height={altura} className="overflow-visible" role="img" data-coruja aria-label={t("Glaux, a coruja do Skinomics", "Glaux, the Skinomics owl")}>
      <defs>
        <clipPath id={`${id}-corpo`}>
          <path d={CORPO} />
        </clipPath>
        <clipPath id={`${id}-cabeca`}>
          <path d={CABECA} />
        </clipPath>
        <clipPath id={`${id}-asa`}>
          <path d={ASA_FECHADA} />
        </clipPath>
      </defs>
      <g ref={partes.espelho} fill="#000" stroke="var(--color-destaque)" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="miter">
        {([1, 0] as const).map((lado) => (
          <g key={lado} strokeOpacity={lado === 1 ? 0.45 : 1} strokeLinejoin="round">
            <path ref={(e) => void (partes.pernas.current[lado * 4] = e)} fill="none" strokeWidth="1" />
            <path ref={(e) => void (partes.pernas.current[lado * 4 + 1] = e)} fill="none" strokeWidth="0.8" />
            <path ref={(e) => void (partes.pernas.current[lado * 4 + 2] = e)} />
            <path ref={(e) => void (partes.pernas.current[lado * 4 + 3] = e)} fill="none" strokeWidth="0.45" strokeOpacity="0.6" />
          </g>
        ))}

        <g ref={partes.corpo}>
          <g ref={partes.asaLonge} opacity="0">
            <AsaAberta id={id} fundo />
          </g>

          <g ref={partes.cauda}>
            <Penas penas={CAUDA} />
          </g>

          {/* Corpo em escudo, barrado em divisas, com a runa Algiz no peito */}
          <path d={CORPO} />
          <path d={divisas(58, 36, 80, 84, 3.2)} fill="none" strokeWidth="0.5" strokeOpacity="0.55" clipPath={`url(#${id}-corpo)`} />
          <path d="M69 46V66M69 52L64.6 46.6M69 52L73.4 46.6" fill="none" strokeWidth="1.3" />

          {/* Asa dobrada ao longo das costas, pontas longas cruzando abaixo do corpo */}
          <g ref={partes.asaFechada}>
            <Penas penas={PRIMARIAS} />
            <path d={ASA_FECHADA} />
            <path d={divisas(48, 36, 62, 86, 2.8)} fill="none" strokeWidth="0.45" strokeOpacity="0.6" clipPath={`url(#${id}-asa)`} />
            <path d="M53.6 43L58.4 48.4L53.6 51.4Z" fill="none" strokeWidth="0.8" />
          </g>

          {/* Cabeça facetada: tufos em chifre, disco em V, olhos em lâmina e bico em gancho */}
          <g ref={partes.cabeca}>
            <Penas penas={TUFOS} />
            <path d={CABECA} />
            <path d={divisas(54, 10, 62, 30, 2.4)} fill="none" strokeWidth="0.4" strokeOpacity="0.45" clipPath={`url(#${id}-cabeca)`} />
            <path d={DISCO} strokeWidth="0.7" />
            <path d="M62 27.4L65 25.4M63.8 30.2L66.4 27.8M77.4 26.8L74.8 25.2M75.2 29.6L73.4 27.6" fill="none" strokeWidth="0.4" strokeOpacity="0.5" />
            <g ref={partes.olho}>
              <path d="M62 21.2L65.4 19.2L68.4 21L65.4 22.8Z" fill="var(--color-destaque)" fillOpacity="0.75" strokeWidth="0.4" />
              <path d="M65.2 20.4L66 21.2L65.2 22Z" fill="#000" stroke="none" />
              <path d="M71.4 21.6L75 19.2L79.2 20.8L75.2 23.4Z" fill="var(--color-destaque)" strokeWidth="0.4" />
              <path d="M75 20.4L76 21.4L75 22.4Z" fill="#000" stroke="none" />
            </g>
            {/* Sobrancelhas pesadas, em lâmina, fechando o olhar */}
            <path d="M59.6 16.4L69.8 20.6L60.6 18.2ZM70.2 20.6L80.4 15.8L79.4 17.6Z" fill="var(--color-destaque)" strokeWidth="0.6" />
            <g ref={partes.bico}>
              <path d={BICO_BAIXO} />
            </g>
            <path d={BICO_CIMA} />
          </g>

          <g ref={partes.asaPerto} opacity="0">
            <AsaAberta id={id} />
          </g>
        </g>
      </g>

      {aoClicar && (
        <rect x="46" y="0" width="38" height="96" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={aoClicar} />
      )}
    </svg>
  );
}
