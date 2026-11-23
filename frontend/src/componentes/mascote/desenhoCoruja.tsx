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

// ---- Corpo (de costas, meio de lado) ----

const CORPO = "M43 38C52 33 70 33 80 40C83.6 48 83.4 62 80.6 74C78.8 82 76 88 72.4 93C60 95.4 44 97.6 30 99C32.4 86 35.4 70 38 58C39.4 50 40.6 43 43 38Z";
// A asa cobre as costas e desce em diagonal até a ponta; à direita sobra a lateral escura do corpo.
const ASA = "M44 40C54 37 68 37 75.4 42.4C78.4 52.4 77 66 72 78C68 86 62.4 91.4 56 94.6C48 96.6 39 98 30 99C33 86 36 70 39 58C40.4 50 41.6 44 44 40Z";
const GOLA = "M48.6 41.4C55.6 38.4 66.6 38.2 76.4 42.6";
const PONTAS = [
  pena({ x: 38.6, y: 88 }, 118, 12, 2.1),
  pena({ x: 43, y: 89.6 }, 112, 11, 2),
  pena({ x: 47.6, y: 90.8 }, 106, 9.5, 1.9),
];
// Coberteiras do ombro: lâminas longas e finas, varrendo para baixo e para trás.
const COBERTEIRAS = [
  lamina({ x: 71, y: 44 }, 126, 12, 1.4),
  lamina({ x: 65.4, y: 43.4 }, 124, 12, 1.4),
  lamina({ x: 59.8, y: 43.6 }, 122, 11.4, 1.4),
  lamina({ x: 54.4, y: 44.6 }, 120, 10.6, 1.3),
  lamina({ x: 68.6, y: 50.4 }, 124, 11, 1.3),
  lamina({ x: 63, y: 50.4 }, 122, 10.6, 1.3),
  lamina({ x: 57.4, y: 51.2 }, 120, 10, 1.3),
]

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
  manto: React.RefObject<SVGGElement | null>;
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
    manto: useRef(null),
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
  o(partes.manto, e.voando ? 0 : 1);
  o(partes.asas, e.voando ? 1 : 0);
  t(partes.asaDireita, `translate(78 44) rotate(${n(e.asa)})`);
  t(partes.asaEsquerda, `translate(78 44) rotate(${n(e.asa)})`);
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
        <clipPath id={`${id}-asa`}>
          <path d={ASA} />
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
              <g key={i} transform={i === 0 ? "matrix(-1 0 0 1 120 0)" : undefined}>
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

          {/* Corpo de costas: a lateral escura, com estrias que escorrem para baixo */}
          <path d={CORPO} strokeOpacity="0.7" />
          <g clipPath={`url(#${id}-corpo)`} fill="none" strokeOpacity="0.45" strokeWidth="0.5">
            <path d="M79.4 48L79.8 60M81.2 54L81 68M77.8 62L77.4 76M80 70L78.6 82M75.6 78L74 88" />
          </g>
          {/* Escorridos que pingam da barra do corpo */}
          <path d="M74.6 89.6V97.6M70 93.6V99M41.6 97.6V101.4M36 98.4V100.6" fill="none" strokeWidth="0.45" strokeOpacity="0.4" />

          {/* A asa sobre as costas (some quando ela abre as asas para voar) */}
          <g ref={partes.manto}>
            <Penas penas={PONTAS} brilho={0.9} />
            <path d={ASA} strokeWidth="0.95" />
            <g clipPath={`url(#${id}-asa)`} fill="none">
              {/* Penas longas varrendo das costas até a ponta, como nos traços da referência */}
              <path d="M72 46C66 58 54 74 36 95M75 54C69 66 57 81 42 96M66 44C60 54 50 69 37 88M60 44C54 52 46 64 39 78M74.4 64C70 74 62 85 50 95" strokeWidth="0.55" strokeOpacity="0.5" />
              <path d="M62 60l3 1.6M56 66l3 1.6M50 72l3 1.6M44 78l3 1.6M66 66l2.8 1.6M60 72l2.8 1.6M54 78l2.8 1.6M48 84l2.8 1.6M70 70l2.6 1.4M64 78l2.6 1.4M58 84l2.6 1.4" strokeWidth="0.7" strokeOpacity="0.55" />
            </g>
            {COBERTEIRAS.map(({ contorno }) => (
              <path key={contorno} d={contorno} strokeWidth="0.6" strokeOpacity="0.8" />
            ))}
            <path d={espiral(47.4, 50, 3, 1.6, 3.4)} fill="none" strokeWidth="0.6" strokeOpacity="0.7" />
            {/* A borda da asa fazendo a gola sob o rosto */}
            <path d={GOLA} fill="none" strokeWidth="1.3" />
          </g>

          {/* Garras cravadas no poleiro, sob a barriga */}
          <path d="M64.6 91.4C63.8 93 63.4 94.6 64 97M66.8 91.6C66.6 93.4 66.8 95 67.4 97.2M69 91.4C69.6 93 70.2 94.6 71 96.6" fill="none" strokeWidth="1.05" />

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
