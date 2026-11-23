import { useId } from "react";

import { t } from "../../lib/idioma";
import { AsaAberta, escamas, type Esqueleto, espiral, lamina, Penas, type Partes } from "./desenho";

// A coruja do Skinomics, no mesmo traço do corvo (contorno verde-limão sobre preto, escamas, penas em
// lâmina e espirais), mas em pé: corpo em ovo, cabeça grande com disco facial, tufos e olhos redondos.
// Mesmo viewBox 120 × 100 e mesmos quadris do corvo, então as pernas e todas as poses servem para ela.

const OLHO_Y = 21;

export const ESQUELETO_CORUJA: Esqueleto = {
  pescoco: { x: 64, y: 34 },
  ombro: { x: 60, y: 44 },
  baseCauda: { x: 52, y: 78 },
  olhoY: OLHO_Y,
  bico: { x: 70, y: 26.8 },
};

const CORPO = "M63 33C76 33 81 46 81 58C81 71 74 81 63 81C52 81 45 71 45 58C45 46 50 33 63 33Z";
const CABECA = "M66 8C74.4 8 80.4 14.2 80.4 22.4C80.4 30.4 74.2 36 66 36C57.8 36 51.6 30.4 51.6 22.4C51.6 14.2 57.6 8 66 8Z";
const DISCO = "M70.2 13.6C76.2 13.6 80 17.8 80 23C80 28.2 76 32 70.2 32C64.4 32 60.4 28.2 60.4 23C60.4 17.8 64.2 13.6 70.2 13.6Z";
const ASA_FECHADA = "M60 38C52 42 47 52 47 62C47 70 49 76 52 80C56 74 60 64 62 54C63 48 63 42 60 38Z";
const BICO_CIMA = "M69.4 23.4C71.6 23.6 73.4 25 73.6 27.6C72.4 27 71 26.6 69.8 26.6Z";
const BICO_BAIXO = "M69.8 26.6C71 26.8 72.2 27.4 73 28.4C71.8 28.6 70.6 28.2 69.8 27.6Z";

const TUFOS = [lamina({ x: 58.6, y: 12 }, -116, 9, 2), lamina({ x: 73.4, y: 11.2 }, -66, 9.4, 2)];
const PRIMARIAS = [
  lamina({ x: 53, y: 66 }, 104, 15, 2.2),
  lamina({ x: 55.4, y: 64 }, 98, 15, 2.2),
  lamina({ x: 57.8, y: 61 }, 94, 14, 2.1),
];
const CAUDA = [lamina({ x: 52, y: 78 }, 118, 9, 2), lamina({ x: 54.6, y: 79 }, 104, 9, 2), lamina({ x: 57.4, y: 79.4 }, 92, 8, 1.9)];

export function CorujaSvg({ partes, largura, altura, aoClicar }: { partes: Partes; largura: number; altura: number; aoClicar?: () => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 100" width={largura} height={altura} className="overflow-visible" role="img" data-coruja aria-label={t("Coruja do Skinomics", "Skinomics owl")}>
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
      <g ref={partes.espelho} fill="#000" stroke="var(--color-destaque)" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round">
        {([1, 0] as const).map((lado) => (
          <g key={lado} strokeOpacity={lado === 1 ? 0.45 : 1}>
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

          {/* Cauda curta, saindo de baixo do corpo */}
          <g ref={partes.cauda}>
            <Penas penas={CAUDA} />
          </g>

          {/* Corpo em ovo com o peito estriado em escamas e uma espiral */}
          <path d={CORPO} />
          <path d={escamas(46, 38, 82, 82, 3.4)} fill="none" strokeWidth="0.45" strokeOpacity="0.55" clipPath={`url(#${id}-corpo)`} />
          <path d={espiral(70, 66, 4.6, 1.6, 4.2)} fill="none" strokeWidth="0.8" />

          {/* Asa dobrada junto ao corpo, primárias descendo */}
          <g ref={partes.asaFechada}>
            <Penas penas={PRIMARIAS} />
            <path d={ASA_FECHADA} />
            <path d={escamas(46, 38, 64, 80, 3)} fill="none" strokeWidth="0.45" strokeOpacity="0.6" clipPath={`url(#${id}-asa)`} />
            <path d={espiral(55, 52, 4.2, 1.7, 3.4)} fill="none" strokeWidth="0.85" />
          </g>

          {/* Cabeça grande: tufos, disco facial, olhos redondos e bico curvo */}
          <g ref={partes.cabeca}>
            <Penas penas={TUFOS} />
            <path d={CABECA} />
            <path d={escamas(52, 8, 66, 22, 2.6)} fill="none" strokeWidth="0.4" strokeOpacity="0.45" clipPath={`url(#${id}-cabeca)`} />
            <path d={DISCO} strokeWidth="0.7" />
            <path d="M62.4 28.6Q66 31.4 70.2 31.6M64 16.2Q60.8 19.6 61 23.6" fill="none" strokeWidth="0.45" strokeOpacity="0.5" />
            <g ref={partes.olho}>
              <circle cx="65.4" cy={OLHO_Y} r="3.1" fill="var(--color-destaque)" strokeWidth="0.4" fillOpacity="0.75" />
              <circle cx="65.9" cy={OLHO_Y} r="1.4" fill="#000" stroke="none" />
              <circle cx="74.4" cy={OLHO_Y} r="3.6" fill="var(--color-destaque)" strokeWidth="0.4" />
              <circle cx="74.9" cy={OLHO_Y} r="1.6" fill="#000" stroke="none" />
            </g>
            {/* Sobrancelhas em V: a mesma cara de poucos amigos do corvo */}
            <path d="M61 16.6Q65.4 15.6 69.4 18.6M71 18.4Q75 15.2 79.6 16.4" fill="none" strokeWidth="1.3" />
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
        <rect x="40" y="6" width="46" height="90" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={aoClicar} />
      )}
    </svg>
  );
}
