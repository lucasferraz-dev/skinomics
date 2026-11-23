import { useId } from "react";

import { t } from "../../lib/idioma";
import { type Esqueleto, espiral, lamina, n, type Partes, type Ponto } from "./desenho";

// Glaux, a coruja do Skinomics, no traço do corvo (contorno verde-limão sobre preto, penas em lâmina),
// mas sombria: encolhida no poleiro, sem pescoço, embrulhada nas asas fechadas na frente do corpo como
// um manto. Do escuro saem os tufos em V, a sobrancelha pesada e os olhos que brilham sem pupila; a
// textura das penas fica apagada. Em voo, penas barradas. Mesmo viewBox 120 × 100 e mesmos quadris do
// corvo, então as pernas servem para ela (as poses próprias estão em coruja.ts).

const OLHO_Y = 21.6;

export const ESQUELETO_CORUJA: Esqueleto = {
  pescoco: { x: 67, y: 31 },
  ombro: { x: 62, y: 38 },
  baseCauda: { x: 58, y: 86 },
  olhoY: OLHO_Y,
  bico: { x: 70, y: 26.4 },
};

const CORPO =
  "M55 30L72 27.6C78.6 33 80.4 43 78.4 53.6C76.6 63.4 72 73.6 66.4 82.6L62 88L57.4 79C52.6 70 50.6 58 50.8 47C51 39.6 52.4 34 55 30Z";
// Asas fechadas como um manto: a de perto cruza na frente do peito, a de longe fica atrás; entre as
// duas sobra só uma fresta do peito barrado.
const MANTO = "M73.4 29.2C79.6 35 82.2 46 80.6 58C79 70 73 82.4 63 94L60 86.6C60.8 74 62.2 61.4 64.6 50.6C66.4 42.6 69 35.4 73.4 29.2Z";
const ASA_ATRAS = "M56 29.6C49.4 35.6 46.8 48 47.2 60.4C47.6 72.6 50.4 84 54 94.4L58.6 86C58 72 57.6 58 58 46C58.2 39.6 57.6 34 56 29.6Z";
const CABECA = "M55.4 16L61 11.6L71 11.2L80.2 15L82 22.6L78.4 29.8L70.6 33.4L61 32.4L55.4 26.4Z";
const BICO_CIMA = "M69.6 22.4L72.4 25L71.2 29.6L69.8 26.4Z";
const BICO_BAIXO = "M69.8 26.4L71.4 27.4L71 28.8L69.6 27.8Z";

/** Barras curtas atravessando uma pena (a plumagem barrada das referências). */
function barras(base: Ponto, anguloGraus: number, comprimento: number, largura: number, quantas = 4) {
  const a = (anguloGraus * Math.PI) / 180;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  const nrm = { x: -d.y, y: d.x };
  let caminho = "";
  for (let i = 1; i <= quantas; i++) {
    const f = 0.18 + (i / (quantas + 1)) * 0.66;
    const c = { x: base.x + d.x * comprimento * f, y: base.y + d.y * comprimento * f };
    const meia = largura * 0.85;
    caminho += `M${n(c.x - nrm.x * meia)} ${n(c.y - nrm.y * meia)}L${n(c.x + nrm.x * meia + d.x * 1.2)} ${n(c.y + nrm.y * meia + d.y * 1.2)}`;
  }
  return caminho;
}

/** Pena em lâmina já com as barras. */
function pena(base: Ponto, angulo: number, comprimento: number, largura: number, quantas = 4) {
  return { ...lamina(base, angulo, comprimento, largura), barras: barras(base, angulo, comprimento, largura, quantas) };
}

function PenasBarradas({ penas }: { penas: ReturnType<typeof pena>[] }) {
  return (
    <>
      {penas.map(({ contorno, nervura, barras: b }) => (
        <g key={contorno}>
          <path d={contorno} />
          <path d={nervura} fill="none" strokeWidth="0.4" strokeOpacity="0.5" />
          <path d={b} fill="none" strokeWidth="0.7" />
        </g>
      ))}
    </>
  );
}

// Tufos: lascas curtas e retas, abertas em V como chifres.
const TUFOS = [
  lamina({ x: 57.6, y: 14.4 }, -130, 11.5, 1.7),
  lamina({ x: 59, y: 13 }, -114, 9, 1.4),
  lamina({ x: 60.6, y: 12 }, -100, 6.5, 1.1),
  lamina({ x: 79, y: 14 }, -50, 11.5, 1.7),
  lamina({ x: 77.2, y: 12.6 }, -66, 9, 1.4),
  lamina({ x: 75.2, y: 11.8 }, -80, 6.5, 1.1),
];
// Pontas das penas na barra do manto e da asa de trás, descendo.
const PONTAS_MANTO = [pena({ x: 66.4, y: 84 }, 112, 10, 2, 2), pena({ x: 70.4, y: 79 }, 104, 10, 2, 2), pena({ x: 74, y: 72 }, 98, 9, 1.9, 2)];
const PONTAS_ATRAS = [pena({ x: 50.4, y: 82 }, 98, 11, 2, 2), pena({ x: 53.2, y: 84 }, 94, 10, 1.9, 2)];
// Coberteiras no ombro do manto: lâminas curtas sobrepostas.
const COBERTEIRAS = [lamina({ x: 75.6, y: 33 }, 112, 8, 2.2), lamina({ x: 77.6, y: 38.6 }, 106, 8, 2.2), lamina({ x: 78.8, y: 44.6 }, 100, 8, 2.2)];
// Asa aberta (voo), do ombro (0, 0) apontando para cima, como a do corvo, mas com as penas barradas.
const PRIMARIAS_ABERTAS = Array.from({ length: 7 }, (_, i) => pena({ x: -7 - i * 3.6, y: -19 + i * 1.6 }, -92 - i * 10, 33 - i * 1.6, 2.7, 5));
const SECUNDARIAS_ABERTAS = Array.from({ length: 6 }, (_, i) => pena({ x: -4 - i * 4.4, y: -3 - i * 2.6 }, 150 + i * 6, 17 - i * 0.4, 2.7, 3));
const BRACO_ASA = "M0 0L-8 -20L-20 -22L-33.6 -15.4L-18 -5Z";

function AsaAbertaCoruja({ fundo = false }: { fundo?: boolean }) {
  return (
    <g strokeOpacity={fundo ? 0.4 : 1}>
      <PenasBarradas penas={[...SECUNDARIAS_ABERTAS].reverse()} />
      <PenasBarradas penas={[...PRIMARIAS_ABERTAS].reverse()} />
      <path d={BRACO_ASA} />
      <path d="M-4 -6L-14 -16M-9 -4L-22 -16M-15 -5L-28 -15" fill="none" strokeWidth="0.5" strokeOpacity="0.6" />
    </g>
  );
}

export function CorujaSvg({ partes, largura, altura, aoClicar }: { partes: Partes; largura: number; altura: number; aoClicar?: () => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 100" width={largura} height={altura} className="overflow-visible" role="img" data-coruja aria-label={t("Glaux, a coruja do Skinomics", "Glaux, the Skinomics owl")}>
      <defs>
        <clipPath id={`${id}-corpo`}>
          <path d={CORPO} />
        </clipPath>
        <clipPath id={`${id}-manto`}>
          <path d={MANTO} />
        </clipPath>
        <clipPath id={`${id}-cabeca`}>
          <path d={CABECA} />
        </clipPath>
      </defs>
      <g ref={partes.espelho} fill="#000" stroke="var(--color-destaque)" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round">
        {([1, 0] as const).map((lado) => (
          <g key={lado} strokeOpacity={lado === 1 ? 0.4 : 0.9}>
            <path ref={(e) => void (partes.pernas.current[lado * 4] = e)} fill="none" strokeWidth="1.1" />
            <path ref={(e) => void (partes.pernas.current[lado * 4 + 1] = e)} fill="none" strokeWidth="1" />
            <path ref={(e) => void (partes.pernas.current[lado * 4 + 2] = e)} />
            <path ref={(e) => void (partes.pernas.current[lado * 4 + 3] = e)} fill="none" strokeWidth="0.45" strokeOpacity="0.5" />
          </g>
        ))}

        <g ref={partes.corpo}>
          <g ref={partes.asaLonge} opacity="0">
            <AsaAbertaCoruja fundo />
          </g>

          <g ref={partes.cauda} strokeOpacity="0.6">
            <PenasBarradas penas={[pena({ x: 58, y: 86 }, 104, 9, 2, 2), pena({ x: 60.4, y: 86.4 }, 94, 8, 1.9, 2)]} />
          </g>

          {/* Corpo: quase todo coberto; só a fresta do peito barrado aparece entre as asas */}
          <path d={CORPO} strokeOpacity="0.5" />
          <g clipPath={`url(#${id}-corpo)`} fill="none" strokeOpacity="0.6">
            <path d="M60 36l3.6.8M59.4 41l4 .4M59.2 46l4.2 0M59.4 51l4-.4M59.8 56l3.6-.8M61 40.6l1 1.6M61.6 49.6l.8 1.4" strokeWidth="0.7" />
          </g>

          {/* Asa de longe, atrás, apagada */}
          <g strokeOpacity="0.5">
            <PenasBarradas penas={PONTAS_ATRAS} />
            <path d={ASA_ATRAS} />
            <path d="M54 38C51 50 50.6 66 52.4 84" fill="none" strokeWidth="0.45" strokeOpacity="0.5" />
          </g>

          {/* Asa de perto: o manto cruzando na frente do corpo (some quando ela abre as asas) */}
          <g ref={partes.asaFechada}>
            <PenasBarradas penas={PONTAS_MANTO} />
            <path d={MANTO} strokeWidth="1" />
            <g clipPath={`url(#${id}-manto)`} fill="none" strokeOpacity="0.35" strokeWidth="0.5">
              <path d="M75.6 36C79.4 46 79.6 58 75.8 70C73.2 78 69.6 84 65.6 89.6M71.6 38C75 48 75 60 71.6 72C69.6 79 66.8 84.4 63.6 88.6M68 42C70.6 52 70.4 64 67.4 76" />
              <path d="M74 50l3.4 1.2M71 58l3.4 1.2M73.4 64l3.2 1.4M69.6 70l3 1.4M66.4 78l2.8 1.4" strokeWidth="0.7" />
            </g>
            {COBERTEIRAS.map(({ contorno }) => (
              <path key={contorno} d={contorno} strokeWidth="0.6" strokeOpacity="0.7" />
            ))}
            <path d={espiral(75.4, 40.4, 3, 1.6, 3.4)} fill="none" strokeWidth="0.6" strokeOpacity="0.6" />
          </g>

          {/* Cabeça afundada entre os ombros: tufos em V, sobrancelha pesada, olhos que brilham */}
          <g ref={partes.cabeca}>
            {TUFOS.map(({ contorno, nervura }) => (
              <g key={contorno}>
                <path d={contorno} />
                <path d={nervura} fill="none" strokeWidth="0.35" strokeOpacity="0.5" />
              </g>
            ))}
            <path d={CABECA} />
            <g clipPath={`url(#${id}-cabeca)`} fill="none" strokeWidth="0.4" strokeOpacity="0.35">
              <path d="M57 18l2.6 1.4M56.6 22l2.8.6M57 26l2.8-.4M58.4 29.6l2.6-1M81 20l-2.4 1M80.4 24.4l-2.6.2M78.8 28.4l-2.4-.8" />
            </g>
            <path d="M60.2 19.6L61.6 28.4L68.8 33.2M80.6 18.4L78.2 28L71.6 32.8" fill="none" strokeWidth="0.7" />
            <path d="M63 29.4L65.6 27.4M64.8 31.4L67 29M76.8 28.4L74.6 26.6M75 30.6L73.2 28.4" fill="none" strokeWidth="0.4" strokeOpacity="0.45" />
            <g ref={partes.olho} style={{ filter: "drop-shadow(0 0 1.6px var(--color-destaque))" }}>
              <path d="M62.2 21.6L66.6 19.6L69.2 22L65.4 23.6Z" fill="var(--color-destaque)" fillOpacity="0.8" stroke="none" />
              <path d="M71.6 22.2L76.6 19.4L80.2 22L75.2 24.4Z" fill="var(--color-destaque)" stroke="none" />
            </g>
            <path d="M59.2 17.2L70.2 21.6L69.4 23L60 19.6ZM70.8 21.6L81.6 16L81.2 18.6L71.6 23Z" fill="var(--color-destaque)" strokeWidth="0.5" />
            <g ref={partes.bico}>
              <path d={BICO_BAIXO} />
            </g>
            <path d={BICO_CIMA} />
          </g>

          <g ref={partes.asaPerto} opacity="0">
            <AsaAbertaCoruja />
          </g>
        </g>
      </g>

      {aoClicar && (
        <rect x="44" y="2" width="42" height="94" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={aoClicar} />
      )}
    </svg>
  );
}
