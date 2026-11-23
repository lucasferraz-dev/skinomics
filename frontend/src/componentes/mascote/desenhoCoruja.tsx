import { useId, useRef } from "react";

import { t } from "../../lib/idioma";
import { espiral, lamina, n, type Ponto } from "./desenho";

// Glaux, a coruja do Skinomics: de frente, encolhida, embrulhada nas asas fechadas como um manto que
// se encontra no meio do corpo, garras cravadas no poleiro. O corpo não se mexe; só a cabeça, como
// coruja de verdade: acompanha o cursor, inclina, pisca devagar e às vezes gira 180° e mostra a nuca.
// Do escuro saem os olhos que brilham sem pupila, a sobrancelha pesada em V e os tufos. Em voo abre
// as duas asas barradas. Mesmo traço do corvo (contorno verde-limão sobre preto, penas em lâmina,
// espiral no ombro). viewBox 120 × 100, garras no chão em y = 96, centro em x = 60.

const OLHO_Y = 25.6;
// Proporção: corpo baixo e largo, cabeça grande afundada nos ombros (ver os grupos em CorujaSvg).
const CORPO_COMPACTO = "translate(0 96) scale(1.08 0.72) translate(0 -96)";
const CABECA_GRANDE = "translate(0 16) translate(60 39.6) scale(1.45) translate(-60 -39.6)";
const PESCOCO = { x: 60, y: 38 };

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

/** Desenha só a metade esquerda (do ponto de vista de quem olha) e espelha para a direita. */
function Espelhado({ children }: { children: React.ReactNode }) {
  return (
    <>
      <g>{children}</g>
      <g transform="matrix(-1 0 0 1 120 0)">{children}</g>
    </>
  );
}

// ---- Formas ----

const CABECA = "M41.6 30.6L40.6 21.6L45.4 11.4L52.6 15.6L60 14.4L67.4 15.6L74.6 11.4L79.4 21.6L78.4 30.6L71.6 37.4L60 39.6L48.4 37.4Z";
const TORSO = "M47 35.4L60 39.4L73 35.4L76.6 48L72.4 64L66 78L60 85L54 78L47.6 64L43.4 48Z";
// Asa esquerda fechada (a direita é o espelho): cobre o corpo e se encontra com a outra no meio.
const MANTO = "M48 35.6C42.6 36.6 38.6 41 37.4 48C36 57 38 68 43 78C47.2 86.4 53 92.6 59.6 96.2L60.6 86C58.2 76 56.8 64 57 52C57.2 45 55.8 39.6 48 35.6Z";
const LOBULO = "M43.4 21.8L49.6 19.6L57.6 22.8L59.4 28.6L56.4 33.6L49.6 34.6L44.2 30.6Z";
const OLHO = "M44.8 25.6L51.4 22L57.8 25.2L52.6 29.4Z";
const BRASA = "M48.6 25.4L51.6 23.8L54.6 25.4L52.2 27.2Z";
const SOBRANCELHA = "M42.8 20.2L59.2 25L60 27.4L60.8 25L77.2 20.2L76.4 22.6L61 27.6L60 29.8L59 27.6L43.6 22.6Z";
const BICO = "M57.8 28.8L62.2 28.8L61.4 34L60 36.2L58.6 34Z";

const TUFOS = [lamina({ x: 46.6, y: 13.8 }, -112, 9.5, 1.8), lamina({ x: 44.4, y: 15 }, -130, 7.5, 1.5), lamina({ x: 48.6, y: 14.6 }, -96, 6, 1.2)];
const COBERTEIRAS = [lamina({ x: 46.6, y: 37.4 }, 128, 7, 2), lamina({ x: 42.8, y: 40.6 }, 118, 7, 2), lamina({ x: 40.2, y: 45 }, 108, 7, 2)];
const PONTAS_MANTO = [pena({ x: 46.8, y: 81.6 }, 66, 12, 2), pena({ x: 51.4, y: 86.2 }, 74, 10, 1.9), pena({ x: 42.6, y: 75.6 }, 60, 11, 1.9)];

// Asa aberta (voo), a partir do ombro (0, 0) apontando para fora (para a direita, antes do espelho).
const PRIMARIAS = Array.from({ length: 7 }, (_, i) => pena({ x: 24 + i * 1.4, y: -6 + i * 2.4 }, -34 + i * 13, 26 - i * 1.4, 2.6, 4));
const SECUNDARIAS = Array.from({ length: 5 }, (_, i) => pena({ x: 5 + i * 4.2, y: 5 }, 84 - i * 6, 13 - i * 0.3, 2.4, 2));
const BRACO = "M0 -2L12 -8L26 -8.6L35 -3L29 6L14 8.4L0 6Z";

/** Rosto da metade esquerda: lóbulo do disco facial, raios do disco e o olho que brilha. */
function MeioRosto() {
  return (
    <>
      <path d={LOBULO} strokeWidth="0.7" strokeOpacity="0.8" />
      <path d="M45.6 23.6l1.6 1M44.6 27.4l2 .2M45.6 31.2l1.8-1M49 33.6l.8-1.8M53.6 33.6l-.6-1.8M57 30.4l-1.6-.6" fill="none" strokeWidth="0.4" strokeOpacity="0.5" />
    </>
  );
}

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
  /** Para onde a cabeça olha: 0 de frente, ±0,7 de lado, ±1 virada para trás (mostra a nuca). */
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
  t(partes.corpo, `translate(0 ${n(Math.min(e.respiro, 1.2))}) rotate(${n(e.inclinacao * 0.5)} 60 70)`);
  o(partes.manto, e.voando ? 0 : 1);
  o(partes.asas, e.voando ? 1 : 0);
  t(partes.asaDireita, `translate(71 58) rotate(${n(e.asa)})`);
  t(partes.asaEsquerda, `translate(71 58) rotate(${n(e.asa)})`);
  t(partes.cabeca, `translate(${n(e.cabecaX)} ${n(e.cabecaY)}) rotate(${n(e.inclinacaoCabeca)} ${PESCOCO.x} ${PESCOCO.y})`);
  // Girar a cabeça: o rosto desliza para o lado e se comprime (3/4); passando de ±0,8, dá lugar à nuca.
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
        <clipPath id={`${id}-torso`}>
          <path d={TORSO} />
        </clipPath>
        <clipPath id={`${id}-manto`}>
          <path d={MANTO} />
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

          <g transform={CORPO_COMPACTO} strokeOpacity="0.7">
          {/* Tronco: o peito barrado só aparece na fresta entre as asas (e inteiro em voo) */}
          <path d={TORSO} strokeOpacity="0.55" />
          <g clipPath={`url(#${id}-torso)`} fill="none" strokeOpacity="0.55" strokeWidth="0.6">
            <path d="M55.4 42l3 .9 3-.9M54.6 47l3.4.9 3.4-.9M55 52l3 .9 3-.9M55.6 57l2.4.8 2.4-.8M54.2 62l3.8 1 3.8-1M55.6 67l2.4.8 2.4-.8M56.2 72l1.8.6 1.8-.6" />
            <path d="M60 41V80" strokeOpacity="0.3" />
          </g>

          {/* O manto: as duas asas fechadas na frente, encontrando-se no meio */}
          <g ref={partes.manto}>
            <Espelhado>
              <Penas penas={PONTAS_MANTO} brilho={0.85} />
              <path d={MANTO} strokeWidth="1" />
              <g clipPath={`url(#${id}-manto)`} fill="none">
                <path d="M41.4 48C40.4 58 42.6 70 48 80M45.4 44C44.4 56 46.4 70 51.6 82M49.8 41.6C49.6 54 51 70 55.4 84M53.6 42C53.6 56 54.6 70 57.8 84" strokeWidth="0.45" strokeOpacity="0.4" />
                <path d="M40 54l2.6 .6M43.6 52l2.6.6M47.6 50l2.4.6M39.6 60l2.6.4M43.6 59l2.6.4M47.8 58l2.4.4M51.6 57l2.2.4M41 66l2.6 0M45 66l2.6 0M49 65l2.4 0M52.8 65l2.2 0M43.6 72l2.4-.4M47.6 72l2.4-.4M51.4 72l2.2-.4M47.6 78l2.2-.6M51.4 78l2-.6" strokeWidth="0.65" strokeOpacity="0.55" />
              </g>
              {COBERTEIRAS.map(({ contorno }) => (
                <path key={contorno} d={contorno} strokeWidth="0.6" strokeOpacity="0.75" />
              ))}
              <path d={espiral(44.6, 46.4, 2.6, 1.6, 3.4)} fill="none" strokeWidth="0.55" strokeOpacity="0.6" />
            </Espelhado>
            {/* Costura do manto no meio */}
            <path d="M60 52V93" fill="none" strokeWidth="0.5" strokeOpacity="0.5" />
          </g>
          </g>

          {/* Garras cravadas no poleiro, à frente do manto */}
          <Espelhado>
            <path d="M53.2 90.2L57.8 90L57.6 93L53.4 93.2Z" strokeWidth="0.6" />
            <path d="M53.8 91.2l.8 1M55.4 91l.8 1M57 91.2l-.4.8" fill="none" strokeWidth="0.35" strokeOpacity="0.6" />
            <path d="M53.8 93C52.6 94.2 52.2 95.6 52.8 97.4M55.6 93.2C55.2 94.6 55.2 96 55.8 97.6M57.4 93C57.8 94.4 58.4 95.6 59 97" fill="none" strokeWidth="1.05" />
          </Espelhado>

          {/* Cabeça grande, afundada entre os ombros */}
          <g transform={CABECA_GRANDE}>
          <g ref={partes.cabeca}>
            <Espelhado>
              {TUFOS.map(({ contorno, nervura }) => (
                <g key={contorno}>
                  <path d={contorno} />
                  <path d={nervura} fill="none" strokeWidth="0.3" strokeOpacity="0.45" />
                </g>
              ))}
            </Espelhado>
            <path d={CABECA} strokeWidth="0.8" strokeOpacity="0.75" />

            {/* Nuca (aparece quando ela gira a cabeça para trás) */}
            <g ref={partes.nuca} opacity="0" fill="none" clipPath={`url(#${id}-cabeca)`}>
              <path d="M60 15V39" strokeWidth="0.5" strokeOpacity="0.5" />
              <path d="M46 20l3 2.4 3-2.4M52 21l3 2.4 3-2.4M62 21l3 2.4 3-2.4M68 20l3 2.4 3-2.4M44 26l3 2.4 3-2.4M50 27l3 2.4 3-2.4M64 27l3 2.4 3-2.4M70 26l3 2.4 3-2.4M47 32l3 2.4 3-2.4M53 33l3 2l1.6-1.4M62.4 33l1.6 1.4 3-2 3 1.6M67 32l3 2.4" strokeWidth="0.6" strokeOpacity="0.6" />
            </g>

            <g ref={partes.rosto}>
              {/* Coroa */}
              <path d="M50.4 17.4l2 1.4 2-1.4M56 16.8l2 1.4 2-1.4 2 1.4 2-1.4M65.6 17.4l2 1.4 2-1.4" fill="none" strokeWidth="0.45" strokeOpacity="0.45" />
              <Espelhado>
                <MeioRosto />
              </Espelhado>
              {/* Olhos que brilham, sem pupila, com um núcleo mais claro */}
              <g ref={partes.olhos} filter={`url(#${id}-brilho)`}>
                <Espelhado>
                  <path d={OLHO} fill="var(--color-destaque)" stroke="none" />
                  <path d={BRASA} fill="#f3ffd2" stroke="none" fillOpacity="0.9" />
                </Espelhado>
              </g>
              {/* Sobrancelha pesada em V descendo até o bico */}
              <path d={SOBRANCELHA} fill="var(--color-destaque)" strokeWidth="0.4" />
              <path d={BICO} fill="var(--color-destaque)" fillOpacity="0.22" strokeWidth="0.8" />
            </g>
          </g>
          </g>
        </g>
      </g>

      {aoClicar && (
        <rect x="36" y="4" width="48" height="94" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={aoClicar} />
      )}
    </svg>
  );
}
