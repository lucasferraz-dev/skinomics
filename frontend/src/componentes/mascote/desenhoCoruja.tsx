import { useId } from "react";

import { t } from "../../lib/idioma";
import { AsaAberta, escamas, type Esqueleto, espiral, lamina, n, Penas, type Partes } from "./desenho";

// A coruja do Skinomics, no mesmo traço do corvo (contorno verde-limão sobre preto, penas em lâmina,
// escamas e espirais). Inspirada no corujão-orelhudo: alta e enxuta, tufos longos abertos para fora,
// disco facial em coração, olhar fechado sob sobrancelhas pesadas, bico em gancho, peito barrado em
// divisas e pontas das asas longas cruzando abaixo do corpo. Mesmo viewBox 120 × 100 e mesmos quadris
// do corvo, então as pernas e as poses servem para ela.

const OLHO_Y = 21.4;

export const ESQUELETO_CORUJA: Esqueleto = {
  pescoco: { x: 66, y: 32 },
  ombro: { x: 58, y: 40 },
  baseCauda: { x: 55, y: 82 },
  olhoY: OLHO_Y,
  bico: { x: 69.8, y: 25.6 },
};

const CORPO =
  "M58 31C64 28.6 69 28.8 71 31C75.6 36 77.6 44 77 52C76.4 62 73.4 72 68 80C64.6 84 58.6 85 54.6 81C50.6 76 49.6 66 50 58C50.4 48 52.6 38 58 31Z";
const CABECA =
  "M54.6 14C57.4 10.4 62 9 66.4 9.4C71 9.6 75.6 10.8 79 14C81.2 17.6 81 22.6 79 26.6C76.8 30.6 72.6 33.4 68.6 34.2C64 34.6 59.6 32.6 56.8 29C54 25.2 53.2 18.8 54.6 14Z";
const DISCO =
  "M60.4 14.6C64.6 13.4 68.4 15.8 70 19C71.8 15.8 75.6 13.8 79.6 15.4C80.4 21.4 78.4 27.6 73.4 31.4C71.6 32.6 69.8 33 68.6 33.2C64.4 31.4 61 27.6 60.2 22.4C59.8 19.8 59.8 17 60.4 14.6Z";
const ASA_FECHADA = "M57 33C51.6 38 49.4 48 49.6 58C49.8 68 51.4 78 54 86L56 74C58.6 64 60.6 52 60.6 44C60.6 38.8 59.4 35 57 33Z";
const BICO_CIMA = "M69.2 21.6C71.4 22 72.6 24 72.4 27.6C71.6 26.4 70.6 25.6 69.6 25.4Z";
const BICO_BAIXO = "M69.6 25.4C70.4 25.8 71.2 26.6 71.6 27.6C70.8 27.8 70 27.4 69.6 26.8Z";

// Tufos: duas lâminas de cada lado, abertas para fora como chifres.
const TUFOS = [
  lamina({ x: 57.4, y: 12.6 }, -128, 13, 2.2),
  lamina({ x: 59.6, y: 11.4 }, -112, 10, 1.8),
  lamina({ x: 76.2, y: 12 }, -58, 12.6, 2.2),
  lamina({ x: 73.8, y: 10.8 }, -76, 9.6, 1.8),
];
// Pontas das asas longas, cruzando abaixo do corpo.
const PRIMARIAS = [
  lamina({ x: 52.2, y: 66 }, 101, 23, 2.3),
  lamina({ x: 54.4, y: 64 }, 97, 22, 2.2),
  lamina({ x: 56.4, y: 62 }, 94, 20, 2.1),
];
const CAUDA = [lamina({ x: 55, y: 82 }, 112, 9, 1.9), lamina({ x: 57.4, y: 82.6 }, 100, 9, 1.9)];

/** Peito barrado: fileiras de divisas (pequenos "v"), mais duras que as escamas do corvo. */
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

          <g ref={partes.cauda}>
            <Penas penas={CAUDA} />
          </g>

          {/* Corpo alto e enxuto, peito barrado em divisas */}
          <path d={CORPO} />
          <path d={divisas(58, 36, 80, 82, 3.2)} fill="none" strokeWidth="0.5" strokeOpacity="0.6" clipPath={`url(#${id}-corpo)`} />

          {/* Asa dobrada ao longo das costas, com as pontas longas cruzando abaixo do corpo */}
          <g ref={partes.asaFechada}>
            <Penas penas={PRIMARIAS} />
            <path d={ASA_FECHADA} />
            <path d={escamas(48, 34, 62, 86, 3)} fill="none" strokeWidth="0.45" strokeOpacity="0.6" clipPath={`url(#${id}-asa)`} />
            <path d={espiral(55.4, 46, 3.6, 1.7, 3.4)} fill="none" strokeWidth="0.85" />
          </g>

          {/* Cabeça: tufos em chifre, disco facial em coração, olhar fechado e bico em gancho */}
          <g ref={partes.cabeca}>
            <Penas penas={TUFOS} />
            <path d={CABECA} />
            <path d={escamas(53, 9, 62, 30, 2.4)} fill="none" strokeWidth="0.4" strokeOpacity="0.45" clipPath={`url(#${id}-cabeca)`} />
            <path d={DISCO} strokeWidth="0.7" />
            {/* Raios finos do disco facial */}
            <path d="M62 27.4L64.6 25.6M63.6 30.4L66 27.8M77.6 27.2L75.4 25.6M75.6 30L73.8 27.8M61.2 18.6L63.4 19.4" fill="none" strokeWidth="0.4" strokeOpacity="0.5" />
            <g ref={partes.olho}>
              <path d="M62.6 21Q65.4 18.8 68.2 20.8Q65.4 23.8 62.6 21Z" fill="var(--color-destaque)" fillOpacity="0.75" strokeWidth="0.4" />
              <circle cx="65.6" cy="21.2" r="1" fill="#000" stroke="none" />
              <path d="M71.6 21.2Q75.2 18.6 78.6 21Q75.4 24.6 71.6 21.2Z" fill="var(--color-destaque)" strokeWidth="0.4" />
              <circle cx="75.4" cy="21.4" r="1.1" fill="#000" stroke="none" />
            </g>
            {/* Sobrancelhas pesadas em V, fechando o olhar */}
            <path d="M60.6 17.4Q65.4 16.2 69.6 20.2M70.4 20.2Q74.4 16 79.8 17" fill="none" strokeWidth="1.6" />
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
        <rect x="46" y="2" width="36" height="94" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={aoClicar} />
      )}
    </svg>
  );
}
