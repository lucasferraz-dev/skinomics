import { useId, useRef } from "react";

import { t } from "../../lib/idioma";
import { espiral, lamina, n, type Ponto } from "./desenho";

// Glaux, a coruja do Skinomics, na pose da referência: de costas, meio de lado, olhando para trás por
// cima do ombro. A asa grande cobre as costas e desce em diagonal até a ponta das penas; a borda da asa
// faz uma gola sob o rosto; a cabeça grande encara quem olha, com olhos que brilham sem pupila,
// sobrancelha pesada em V e bico aceso. O corpo não se mexe: só a cabeça (acompanha o cursor, inclina,
// pisca devagar e às vezes gira de vez para frente, mostrando a nuca). Em voo abre as duas asas
// barradas. Mesmo traço do corvo (contorno verde-limão sobre preto, penas em lâmina, espiral no ombro).
// viewBox 120 × 100, garras no chão em y = 96.

const OLHO_Y = 25.6;
const PESCOCO = { x: 60, y: 38 };
// A cabeça é desenhada centrada em x = 60 e encaixada, maior, sobre a gola (um pouco à direita).
const CABECA_NO_OMBRO = "translate(4 2.6) translate(60 39.6) scale(1.25) translate(-60 -39.6)";

/** Barras curtas atravessando uma pena (plumagem barrada). */
function barras(base: Ponto, anguloGraus: number, comprimento: number, largura: number, quantas: number) {
  const a = (anguloGraus * Math.PI) / 180;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  const nrm = { x: -d.y, y: d.x };
  let caminho = "";
  for (let i = 1; i <= quantas; i++) {
    const f = 0.18 + (i / (quantas + 1)) * 0.66;
    const c = { x: base.x + d.x * comprimento * f, y: base.y + d.y * comprimento * f };
    const meia = largura * 0.85;
    caminho += `M${n(c.x - nrm.x * meia)} ${n(c.y - nrm.y * meia)}L${n(c.x + nrm.x * meia + d.x * 1.1)} ${n(c.y + nrm.y * meia + d.y * 1.1)}`;
  }
  return caminho;
}

function pena(base: Ponto, angulo: number, comprimento: number, largura: number, quantas = 3) {
  return { ...lamina(base, angulo, comprimento, largura), barras: barras(base, angulo, comprimento, largura, quantas) };
}

function Penas({ penas, brilho = 1 }: { penas: ReturnType<typeof pena>[]; brilho?: number }) {
  return (
    <g strokeOpacity={brilho}>
      {penas.map(({ contorno, nervura, barras: b }) => (
        <g key={contorno}>
          <path d={contorno} />
          <path d={nervura} fill="none" strokeWidth="0.35" strokeOpacity="0.45" />
          <path d={b} fill="none" strokeWidth="0.6" strokeOpacity="0.8" />
        </g>
      ))}
    </g>
  );
}

/** Desenha a metade esquerda do rosto e espelha para a direita. */
function Espelhado({ children }: { children: React.ReactNode }) {
  return (
    <>
      <g>{children}</g>
      <g transform="matrix(-1 0 0 1 120 0)">{children}</g>
    </>
  );
}

// ---- Corpo pousado (de costas, meio de lado) ----

// Costas com volume: o ombro e as costas arredondam para fora e só afinam perto da cauda.
const CORPO =
  "M43 38C52 33 70 33 80 40C83.6 48 83.4 62 80.6 74C78.8 82 76 88 72.4 93C60 95.4 44 97.6 30 99C29.6 88 30.4 76 31.6 66C32.8 55 36.4 44.6 43 38Z";
// A asa cobre as costas e desce em diagonal até a ponta; à direita sobra a lateral escura do corpo.
const ASA =
  "M44 40C54 37 68 37 75.4 42.4C78.4 52.4 77 66 72 78C68 86 62.4 91.4 56 94.6C48 96.6 39 98 30 99C29.8 88 30.6 76 31.8 66C33 56 37 45.6 44 40Z";
const GOLA = "M48.6 41.4C55.6 38.4 66.6 38.2 76.4 42.6";
// Linhas de volume: a curva do ombro e a dobra das costas.
const VOLUME = "M44.4 44C39.6 49 36.8 56 36 64M73.4 46.4C74.6 54 73.4 63 70 71";

/**
 * Penas da asa em fileiras sobrepostas, do ombro até a ponta: coberteiras curtas em cima, penas médias
 * no meio, primárias longas e barradas embaixo. As fileiras de cima são desenhadas por último, cobrindo
 * a base das de baixo, como numa asa de verdade; as pontas saem da silhueta, recortadas.
 */
const FILEIRAS = Array.from({ length: 8 }, (_, k) => {
  const esquerda = { x: 44.4 - 1.9 * k, y: 45.4 + 6.4 * k };
  const direita = { x: 73.4 - 4.2 * k, y: 45 + 5.6 * k };
  const quantas = Math.max(2, 7 - Math.floor(k * 0.7));
  const comprimento = 7.5 + 2.3 * k;
  return Array.from({ length: quantas }, (_, i) => {
    const f = quantas === 1 ? 0.5 : i / (quantas - 1);
    // Leve desencontro entre fileiras, para não parecer grade.
    const base = { x: esquerda.x + (direita.x - esquerda.x) * f + (k % 2) * 1.6, y: esquerda.y + (direita.y - esquerda.y) * f };
    return pena(base, 114 + k * 1.6 + f * 6, comprimento, 1.7 + k * 0.12, k >= 4 ? 3 : k >= 2 ? 2 : 0);
  });
}).reverse();

// ---- Corpo em voo (o de costas some; aparece o tronco de frente) ----

const TRONCO = "M50.4 42C56 38.6 66.4 38.6 72 42C75.6 51 74.6 63.4 70 72.4C67 78 63.4 81.4 61 81.8C58.4 81.4 54.6 78 52 72.4C47.6 63.4 46.8 51 50.4 42Z";
const CAUDA_VOO = [pena({ x: 58.4, y: 79 }, 104, 11, 2, 2), pena({ x: 61, y: 80 }, 92, 11.6, 2, 2), pena({ x: 63.6, y: 79 }, 78, 11, 2, 2)];

// ---- Cabeça (de frente, encarando) ----

const CABECA = "M41.6 30.6L40.6 21.6L45.4 11.4L52.6 15.6L60 14.4L67.4 15.6L74.6 11.4L79.4 21.6L78.4 30.6L71.6 37.4L60 39.6L48.4 37.4Z";
const LOBULO = "M43.4 21.8L49.6 19.6L57.6 22.8L59.4 28.6L56.4 33.6L49.6 34.6L44.2 30.6Z";
const OLHO = "M44.8 25.6L51.4 22L57.8 25.2L52.6 29.4Z";
const BRASA = "M48.6 25.4L51.6 23.8L54.6 25.4L52.2 27.2Z";
const SOBRANCELHA = "M42.8 20.2L59.2 25L60 27.4L60.8 25L77.2 20.2L76.4 22.6L61 27.6L60 29.8L59 27.6L43.6 22.6Z";
const BICO = "M57.8 28.8L62.2 28.8L61.4 34L60 36.2L58.6 34Z";
const TUFOS = [lamina({ x: 46.6, y: 13.8 }, -112, 9.5, 1.8), lamina({ x: 44.4, y: 15 }, -130, 7.5, 1.5), lamina({ x: 48.6, y: 14.6 }, -96, 6, 1.2)];

// ---- Asas abertas (voo): do ombro (0, 0) para fora (à direita, antes do espelho) ----

const PRIMARIAS = Array.from({ length: 7 }, (_, i) => pena({ x: 24 + i * 1.4, y: -6 + i * 2.4 }, -34 + i * 13, 26 - i * 1.4, 2.6, 4));
const SECUNDARIAS = Array.from({ length: 5 }, (_, i) => pena({ x: 5 + i * 4.2, y: 5 }, 84 - i * 6, 13 - i * 0.3, 2.4, 2));
const BRACO = "M0 -2L12 -8L26 -8.6L35 -3L29 6L14 8.4L0 6Z";

export type PartesCoruja = {
  corpo: React.RefObject<SVGGElement | null>;
  pousada: React.RefObject<SVGGElement | null>;
  emVoo: React.RefObject<SVGGElement | null>;
  asas: React.RefObject<SVGGElement | null>;
  asaEsquerda: React.RefObject<SVGGElement | null>;
  asaDireita: React.RefObject<SVGGElement | null>;
  cabeca: React.RefObject<SVGGElement | null>;
  rosto: React.RefObject<SVGGElement | null>;
  nuca: React.RefObject<SVGGElement | null>;
  olhos: React.RefObject<SVGGElement | null>;
};

export function usePartesCoruja(): PartesCoruja {
  return {
    corpo: useRef(null),
    pousada: useRef(null),
    emVoo: useRef(null),
    asas: useRef(null),
    asaEsquerda: useRef(null),
    asaDireita: useRef(null),
    cabeca: useRef(null),
    rosto: useRef(null),
    nuca: useRef(null),
    olhos: useRef(null),
  };
}

export type EstadoCoruja = {
  voando: boolean;
  /** Ângulo das asas abertas: negativo para cima, 0 na horizontal, positivo para baixo. */
  asa: number;
  /** Para onde a cabeça olha: 0 encarando, ±0,7 de lado, ±1 virada de vez (mostra a nuca). */
  virada: number;
  inclinacaoCabeca: number;
  cabecaX: number;
  cabecaY: number;
  respiro: number;
  inclinacao: number;
  piscada: number;
};

/** Aplica o estado ao desenho direto no SVG (sem passar pelo React). */
export function aplicarCoruja(partes: PartesCoruja, e: EstadoCoruja) {
  const t = (ref: React.RefObject<Element | null>, valor: string) => ref.current?.setAttribute("transform", valor);
  const o = (ref: React.RefObject<Element | null>, valor: number) => ref.current?.setAttribute("opacity", n(valor));
  t(partes.corpo, `translate(0 ${n(Math.min(e.respiro, 1))}) rotate(${n(e.inclinacao * 0.5)} 60 70)`);
  o(partes.pousada, e.voando ? 0 : 1);
  o(partes.emVoo, e.voando ? 1 : 0);
  o(partes.asas, e.voando ? 1 : 0);
  // As asas abertas saem dos ombros do tronco de voo (a esquerda é o espelho da direita).
  t(partes.asaDireita, `translate(71.6 46) rotate(${n(e.asa)}) scale(1.3)`);
  t(partes.asaEsquerda, `translate(71.6 46) rotate(${n(e.asa)}) scale(1.3)`);
  t(partes.cabeca, `translate(${n(e.cabecaX)} ${n(e.cabecaY)}) rotate(${n(e.inclinacaoCabeca)} ${PESCOCO.x} ${PESCOCO.y})`);
  // Girar a cabeça: o rosto desliza para o lado e se comprime; passando de ±0,8, dá lugar à nuca.
  const v = Math.max(-1, Math.min(1, e.virada));
  const lado = Math.abs(v);
  t(partes.rosto, `translate(${n(60 + v * 8)} 0) scale(${n(1 - 0.42 * lado)} 1) translate(-60 0)`);
  o(partes.rosto, Math.min(1, Math.max(0, (0.95 - lado) / 0.2)));
  o(partes.nuca, Math.min(1, Math.max(0, (lado - 0.78) / 0.2)));
  t(partes.olhos, `translate(0 ${OLHO_Y}) scale(1 ${n(1 - e.piscada)}) translate(0 ${-OLHO_Y})`);
}

export function CorujaSvg({ partes, largura, altura, aoClicar }: { partes: PartesCoruja; largura: number; altura: number; aoClicar?: () => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 100" width={largura} height={altura} className="overflow-visible" role="img" data-coruja aria-label={t("Glaux, a coruja do Skinomics", "Glaux, the Skinomics owl")}>
      <defs>
        <clipPath id={`${id}-corpo`}>
          <path d={CORPO} />
        </clipPath>
        <clipPath id={`${id}-tronco`}>
          <path d={TRONCO} />
        </clipPath>
        <clipPath id={`${id}-cabeca`}>
          <path d={CABECA} />
        </clipPath>
        <filter id={`${id}-brilho`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.1" result="halo" />
          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="halo" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill="#000" stroke="var(--color-destaque)" strokeWidth="0.85" strokeLinecap="round" strokeLinejoin="round">
        <g ref={partes.corpo}>
          {/* Asas abertas (só em voo), barradas, atrás do corpo */}
          <g ref={partes.asas} opacity="0">
            {[partes.asaEsquerda, partes.asaDireita].map((ref, i) => (
              <g key={i} transform={i === 0 ? "matrix(-1 0 0 1 122 0)" : undefined}>
                <g ref={ref}>
                  <Penas penas={[...SECUNDARIAS].reverse()} brilho={0.8} />
                  <Penas penas={[...PRIMARIAS].reverse()} />
                  <path d={BRACO} />
                  <path d="M4 -2L10 2M10 -5L17 1M17 -6L24 0M24 -6L30 -1" fill="none" strokeWidth="0.5" strokeOpacity="0.6" />
                  <path d={espiral(10, -1, 2.6, 1.6, 3.4)} fill="none" strokeWidth="0.55" strokeOpacity="0.7" />
                </g>
              </g>
            ))}
          </g>

          {/* Em voo: tronco de frente com o peito barrado, cauda em leque e garras penduradas */}
          <g ref={partes.emVoo} opacity="0">
            <Penas penas={CAUDA_VOO} brilho={0.85} />
            <path d={TRONCO} strokeWidth="0.95" />
            <g clipPath={`url(#${id}-tronco)`} fill="none" strokeWidth="0.6" strokeOpacity="0.6">
              <path d="M55.6 47l3 1 3-1 3 1 3-1M54.4 53l3.2 1 3.2-1 3.2 1 3.2-1M55 59l3 1 3-1 3 1 3-1M56.4 65l2.8 1 2.8-1 2.8 1 2.8-1M58 71l3 1 3-1" />
            </g>
            <path d="M57.4 81.4C56.8 83.4 56.6 85.6 57.4 88M59.4 82C59.2 84.2 59.6 86.4 60.4 88.4M63.6 82C63.8 84.2 63.4 86.4 62.6 88.4M65.6 81.4C66.2 83.4 66.4 85.6 65.6 88" fill="none" strokeWidth="1" />
          </g>

          {/* Pousada: o corpo de costas e a asa cobrindo as costas */}
          <g ref={partes.pousada}>
            <path d={CORPO} strokeOpacity="0.7" />
            <g clipPath={`url(#${id}-corpo)`} fill="none" strokeOpacity="0.45" strokeWidth="0.5">
              <path d="M79.4 48L79.8 60M81.2 54L81 68M77.8 62L77.4 76M80 70L78.6 82M75.6 78L74 88" />
            </g>
            <path d="M74.6 89.6V97.6M70 93.6V99M41.6 97.6V101.4M36 98.4V100.6" fill="none" strokeWidth="0.45" strokeOpacity="0.4" />

            <path d={ASA} strokeWidth="0.95" />
            {FILEIRAS.map((fileira, k) => (
              <Penas key={k} penas={fileira} brilho={0.92} />
            ))}
            <path d={VOLUME} fill="none" strokeWidth="0.7" strokeOpacity="0.55" />
            <path d={espiral(47.6, 49.6, 2.8, 1.6, 3.4)} fill="none" strokeWidth="0.6" strokeOpacity="0.75" />
            <path d={GOLA} fill="none" strokeWidth="1.3" />

            <path d="M64.6 91.4C63.8 93 63.4 94.6 64 97M66.8 91.6C66.6 93.4 66.8 95 67.4 97.2M69 91.4C69.6 93 70.2 94.6 71 96.6" fill="none" strokeWidth="1.05" />
          </g>

          {/* Cabeça grande, por cima do ombro, encarando */}
          <g transform={CABECA_NO_OMBRO}>
            <g ref={partes.cabeca}>
              <Espelhado>
                {TUFOS.map(({ contorno, nervura }) => (
                  <g key={contorno}>
                    <path d={contorno} />
                    <path d={nervura} fill="none" strokeWidth="0.3" strokeOpacity="0.45" />
                  </g>
                ))}
              </Espelhado>
              <path d={CABECA} strokeWidth="0.8" strokeOpacity="0.8" />

              {/* Nuca (quando ela gira a cabeça de vez para frente) */}
              <g ref={partes.nuca} opacity="0" fill="none" clipPath={`url(#${id}-cabeca)`}>
                <path d="M60 15V39" strokeWidth="0.5" strokeOpacity="0.5" />
                <path d="M46 20l3 2.4 3-2.4M52 21l3 2.4 3-2.4M62 21l3 2.4 3-2.4M68 20l3 2.4 3-2.4M44 26l3 2.4 3-2.4M50 27l3 2.4 3-2.4M64 27l3 2.4 3-2.4M70 26l3 2.4 3-2.4M47 32l3 2.4 3-2.4M53 33l3 2l1.6-1.4M62.4 33l1.6 1.4 3-2 3 1.6M67 32l3 2.4" strokeWidth="0.6" strokeOpacity="0.6" />
              </g>

              <g ref={partes.rosto}>
                <path d="M50.4 17.4l2 1.4 2-1.4M56 16.8l2 1.4 2-1.4 2 1.4 2-1.4M65.6 17.4l2 1.4 2-1.4" fill="none" strokeWidth="0.45" strokeOpacity="0.45" />
                <Espelhado>
                  <path d={LOBULO} strokeWidth="0.7" strokeOpacity="0.8" />
                  <path d="M45.6 23.6l1.6 1M44.6 27.4l2 .2M45.6 31.2l1.8-1M49 33.6l.8-1.8M53.6 33.6l-.6-1.8M57 30.4l-1.6-.6" fill="none" strokeWidth="0.4" strokeOpacity="0.5" />
                </Espelhado>
                {/* Olhos que brilham, sem pupila, com um núcleo mais claro */}
                <g ref={partes.olhos} filter={`url(#${id}-brilho)`}>
                  <Espelhado>
                    <path d={OLHO} fill="var(--color-destaque)" stroke="none" />
                    <path d={BRASA} fill="#f3ffd2" stroke="none" fillOpacity="0.9" />
                  </Espelhado>
                </g>
                <path d={SOBRANCELHA} fill="var(--color-destaque)" strokeWidth="0.4" />
                <path d={BICO} fill="var(--color-destaque)" fillOpacity="0.22" strokeWidth="0.8" />
              </g>
            </g>
          </g>
        </g>
      </g>

      {aoClicar && (
        <rect x="30" y="2" width="56" height="96" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={aoClicar} />
      )}
    </svg>
  );
}
