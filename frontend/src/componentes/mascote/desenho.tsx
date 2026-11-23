import { t } from "../../lib/idioma";
import { type CSSProperties, useId, useRef } from "react";

import { APOIO_X, BASE_CAUDA, OMBRO, perna, PESCOCO, type Pose, transformarCorpo } from "./corvo";

// Desenho do corvo em arte de linha ornamental: contorno verde-limão sobre preto, plumagem em
// escamas, penas em lâmina com nervura e espirais. Coordenadas do viewBox 120 × 100, olhando para a
// direita, chão em y = 96. As partes animadas ficam em grupos separados (ver `aplicarPose`).

export type Ponto = { x: number; y: number };
export const n = (v: number) => v.toFixed(2);

/** Pena em lâmina: base larga, ponta afilada levemente arredondada. */
export function lamina(base: Ponto, anguloGraus: number, comprimento: number, largura: number) {
  const a = (anguloGraus * Math.PI) / 180;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  const nrm = { x: -d.y * largura, y: d.x * largura };
  const ponta = { x: base.x + d.x * comprimento, y: base.y + d.y * comprimento };
  const ombroA = { x: base.x + d.x * comprimento * 0.72 + nrm.x, y: base.y + d.y * comprimento * 0.72 + nrm.y };
  const ombroB = { x: base.x + d.x * comprimento * 0.72 - nrm.x, y: base.y + d.y * comprimento * 0.72 - nrm.y };
  const contorno =
    `M${n(base.x + nrm.x * 0.7)} ${n(base.y + nrm.y * 0.7)}` +
    `L${n(ombroA.x)} ${n(ombroA.y)}` +
    `Q${n(ponta.x + nrm.x * 0.5)} ${n(ponta.y + nrm.y * 0.5)} ${n(ponta.x)} ${n(ponta.y)}` +
    `Q${n(ponta.x - nrm.x * 0.5)} ${n(ponta.y - nrm.y * 0.5)} ${n(ombroB.x)} ${n(ombroB.y)}` +
    `L${n(base.x - nrm.x * 0.7)} ${n(base.y - nrm.y * 0.7)}Z`;
  const nervura = `M${n(base.x)} ${n(base.y)}L${n(base.x + d.x * comprimento * 0.86)} ${n(base.y + d.y * comprimento * 0.86)}`;
  return { contorno, nervura };
}

/** Fileiras de "escamas" (pequenos arcos) que imitam a plumagem; recortadas pela forma da região. */
export function escamas(x0: number, y0: number, x1: number, y1: number, passo: number) {
  let d = "";
  let linha = 0;
  for (let y = y0; y <= y1; y += passo * 0.75, linha++) {
    for (let x = x0 + (linha % 2 ? passo / 2 : 0); x <= x1; x += passo) {
      d += `M${n(x)} ${n(y)}q${n(passo / 2)} ${n(passo * 0.62)} ${n(passo)} 0`;
    }
  }
  return d;
}

/** Espiral ornamental: começa por fora e fecha para dentro. */
export function espiral(cx: number, cy: number, raio: number, voltas: number, giro = 0) {
  let d = "";
  const passos = Math.round(voltas * 24);
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    const a = giro + t * voltas * Math.PI * 2;
    const r = raio * (1 - t * 0.85);
    d += `${i ? "L" : "M"}${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`;
  }
  return d;
}

/**
 * Fumaça saindo do olho (o "ego" dos mascotes): fiapos que nascem no olho, crescem enquanto se afastam
 * na direção `angulo` (graus, no sistema do SVG) e se desfazem, um atrás do outro.
 */
export function FumacaOlho({ x, y, angulo, alcance, filtro }: { x: number; y: number; angulo: number; alcance: number; filtro: string }) {
  return (
    <g filter={filtro} stroke="none" fill="var(--color-destaque)" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => {
        const a = ((angulo + ((i * 37) % 28) - 14) * Math.PI) / 180;
        const d = alcance * (0.75 + ((i * 53) % 50) / 100);
        const estilo = {
          "--dx": `${n(Math.cos(a) * d)}px`,
          "--dy": `${n(Math.sin(a) * d)}px`,
          "--s": String(2.6 + (i % 3) * 0.6),
          animationDelay: `${n(-i * 0.24)}s`,
        } as CSSProperties;
        return <ellipse key={i} className="fumaca-olho" cx={x} cy={y} rx={1.9 + (i % 3) * 0.4} ry={1.3 + (i % 2) * 0.4} style={estilo} />;
      })}
    </g>
  );
}

// ---- Formas fixas ----

const CABECA =
  "M80.4 37.4C79.6 30.4 84.4 25.2 91 24.4 96.4 23.8 101 25.2 104.2 28.4L104.4 31.6C103.8 35 101.2 38 97.6 39.8 92.6 42.4 84.8 42.2 80.4 37.4Z";
const BICO_CIMA = "M103.6 28.2C109.4 28.2 114.8 29.6 119.4 32.4 114.6 33.4 109.4 34.2 104.4 34.6Z";
const BICO_BAIXO = "M104.4 34.6C109.2 34.2 114 33.6 117.8 33.2 114 35.6 109.2 37 104.2 37.4Z";
const CORPO =
  "M84.6 30.8C76 35.6 64 42 52.6 49.6 45.6 54.4 40.4 58.6 36.6 62 L40.4 67.4C48.6 70.6 60.4 72.4 70 71.2 79.4 69.8 86.6 64.4 90.4 56.4 93.4 50 95.4 45 96 40.6 93.4 34.4 89 31 84.6 30.8Z";
const ASA_FECHADA =
  "M86.6 36.4C78.6 36.2 64.8 42.6 52.4 50.8 44.4 56 33.4 62.6 21.4 70.2L14.6 74.6C22.6 74.8 29.8 73.6 36.4 71.8 48.4 68.8 60.2 65.6 70.2 61.6 80.6 57.6 87.6 48 86.6 36.4Z";
const COBERTEIRAS = "M86.6 36.4C80.6 36.4 70.6 41 61.6 47.6 64.6 51.6 70.4 53.8 76.4 53.4 82.4 52.6 86.8 46 86.6 36.4Z";

const PENAS_CAUDA = [
  lamina({ x: 41, y: 67 }, 160, 38, 3.4),
  lamina({ x: 41, y: 65.6 }, 166, 39, 3.4),
  lamina({ x: 41, y: 64 }, 172, 39, 3.4),
  lamina({ x: 41, y: 62.6 }, 178, 37, 3.2),
];
const PRIMARIAS_FECHADAS = [
  lamina({ x: 60, y: 60.6 }, 165.6, 44, 2.4),
  lamina({ x: 57, y: 58.6 }, 164, 40, 2.4),
  lamina({ x: 54, y: 56.4 }, 162.4, 36, 2.4),
];
const SECUNDARIAS_FECHADAS = [
  lamina({ x: 76, y: 54 }, 160, 22, 2.6),
  lamina({ x: 72, y: 56 }, 161, 22, 2.6),
  lamina({ x: 68, y: 57.6 }, 162, 21, 2.6),
];

// Asa aberta, a partir do ombro (0, 0), apontando para cima. Primárias em leque para cima e para trás,
// secundárias pendendo para trás do braço, coberteiras com escamas e uma espiral.
const PRIMARIAS_ABERTAS = Array.from({ length: 7 }, (_, i) =>
  lamina({ x: -7 - i * 3.6, y: -19 + i * 1.6 }, -92 - i * 10, 33 - i * 1.6, 2.5),
);
const SECUNDARIAS_ABERTAS = Array.from({ length: 6 }, (_, i) =>
  lamina({ x: -4 - i * 4.4, y: -3 - i * 2.6 }, 150 + i * 6, 17 - i * 0.4, 2.6),
);
const BRACO_ASA = "M0 0C-1.6 -7-4.4 -14-8 -20-16 -22.4-25.6 -20.6-33.6 -15.4-24 -8-12.6 -2.4 0 0Z";

export type Partes = {
  espelho: React.RefObject<SVGGElement | null>;
  corpo: React.RefObject<SVGGElement | null>;
  cabeca: React.RefObject<SVGGElement | null>;
  cauda: React.RefObject<SVGGElement | null>;
  asaFechada: React.RefObject<SVGGElement | null>;
  asaPerto: React.RefObject<SVGGElement | null>;
  asaLonge: React.RefObject<SVGGElement | null>;
  olho: React.RefObject<SVGGElement | null>;
  bico: React.RefObject<SVGGElement | null>;
  pernas: React.RefObject<(SVGPathElement | null)[]>;
};

export function usePartes(): Partes {
  return {
    espelho: useRef(null),
    corpo: useRef(null),
    cabeca: useRef(null),
    cauda: useRef(null),
    asaFechada: useRef(null),
    asaPerto: useRef(null),
    asaLonge: useRef(null),
    olho: useRef(null),
    bico: useRef(null),
    pernas: useRef([]),
  };
}

const OLHO_Y = 30.2;

/** Pontos onde as partes giram; cada bicho tem os seus (as pernas e o corpo usam os quadris comuns). */
export type Esqueleto = { pescoco: Ponto; ombro: Ponto; baseCauda: Ponto; olhoY: number; bico: Ponto };

export const ESQUELETO_CORVO: Esqueleto = {
  pescoco: PESCOCO,
  ombro: OMBRO,
  baseCauda: BASE_CAUDA,
  olhoY: OLHO_Y,
  bico: { x: 104.2, y: 34.8 },
};

/** Aplica uma pose às partes do desenho (sem passar pelo React). `piscada` vai de 0 (aberto) a 1. */
export function aplicarPose(partes: Partes, pose: Pose, direcao: number, piscada = 0, esqueleto = ESQUELETO_CORVO) {
  const { pescoco, ombro, baseCauda, olhoY, bico } = esqueleto;
  const t = (ref: React.RefObject<Element | null>, valor: string) => ref.current?.setAttribute("transform", valor);
  t(partes.espelho, direcao < 0 ? `translate(${APOIO_X * 2} 0) scale(-1 1)` : "");
  t(partes.corpo, transformarCorpo(pose));
  t(partes.cabeca, `translate(${n(pose.cabecaX)} ${n(pose.cabecaY)}) rotate(${n(pose.cabecaGiro)} ${pescoco.x} ${pescoco.y})`);
  t(partes.cauda, `rotate(${n(pose.cauda)} ${baseCauda.x} ${baseCauda.y})`);
  t(partes.asaFechada, `rotate(${n(pose.asaFechadaGiro)} ${ombro.x} ${ombro.y})`);
  partes.asaFechada.current?.setAttribute("opacity", pose.asa === "fechada" ? "1" : "0");
  for (const [ref, angulo] of [
    [partes.asaPerto, pose.asaAngulo],
    [partes.asaLonge, pose.asaLonge],
  ] as const) {
    // A asa aberta é desenhada apontando para cima; girar no sentido anti-horário a leva para trás.
    t(ref, `translate(${ombro.x} ${ombro.y}) rotate(${n(-angulo)})`);
    ref.current?.setAttribute("opacity", pose.asa === "aberta" ? "1" : "0");
  }
  t(partes.olho, `translate(0 ${olhoY}) scale(1 ${n(1 - piscada)}) translate(0 ${-olhoY})`);
  t(partes.bico, `rotate(${n(pose.bico)} ${bico.x} ${bico.y})`);
  ([0, 1] as const).forEach((lado) => {
    const p = perna(pose, lado);
    partes.pernas.current[lado * 4]?.setAttribute("d", p.tarso);
    partes.pernas.current[lado * 4 + 1]?.setAttribute("d", p.dedos);
    partes.pernas.current[lado * 4 + 2]?.setAttribute("d", p.coxa);
    partes.pernas.current[lado * 4 + 3]?.setAttribute("d", p.penasCoxa);
  });
}

export function Penas({ penas, opacidade = 0.55 }: { penas: { contorno: string; nervura: string }[]; opacidade?: number }) {
  return (
    <>
      {penas.map(({ contorno, nervura }) => (
        <g key={contorno}>
          <path d={contorno} />
          <path d={nervura} fill="none" strokeWidth="0.45" strokeOpacity={opacidade} />
        </g>
      ))}
    </>
  );
}

export function AsaAberta({ id, fundo = false }: { id: string; fundo?: boolean }) {
  return (
    <g strokeOpacity={fundo ? 0.4 : 1}>
      <Penas penas={[...SECUNDARIAS_ABERTAS].reverse()} />
      <Penas penas={[...PRIMARIAS_ABERTAS].reverse()} />
      <path d={BRACO_ASA} />
      <clipPath id={`${id}-braco${fundo ? "-f" : ""}`}>
        <path d={BRACO_ASA} />
      </clipPath>
      <path d={escamas(-34, -22, 2, 2, 3.4)} fill="none" strokeWidth="0.45" strokeOpacity="0.6" clipPath={`url(#${id}-braco${fundo ? "-f" : ""})`} />
      <path d={espiral(-11, -11, 4.2, 1.7, 2.4)} fill="none" strokeWidth="0.8" />
    </g>
  );
}

export function CorvoSvg({ partes, largura, altura, aoClicar }: { partes: Partes; largura: number; altura: number; aoClicar?: () => void }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 100" width={largura} height={altura} className="overflow-visible" role="img" data-corvo aria-label={t("Muninn, o corvo do Skinomics", "Muninn, the Skinomics raven")}>
      <defs>
        <clipPath id={`${id}-corpo`}>
          <path d={CORPO} />
        </clipPath>
        <clipPath id={`${id}-coberteiras`}>
          <path d={COBERTEIRAS} />
        </clipPath>
        <clipPath id={`${id}-cabeca`}>
          <path d={CABECA} />
        </clipPath>
        <radialGradient id={`${id}-aura`}>
          <stop offset="0%" stopColor="var(--color-destaque)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--color-destaque)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-rastro`} gradientUnits="userSpaceOnUse" x1="93" y1="0" x2="76" y2="0">
          <stop offset="0%" stopColor="var(--color-destaque)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--color-destaque)" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-fumaca`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.75" />
        </filter>
        <filter id={`${id}-brilho`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.9" result="halo" />
          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="halo" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        ref={partes.espelho}
        fill="#000"
        stroke="var(--color-destaque)"
        strokeWidth="0.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Pernas (atrás do corpo; a de longe mais apagada): tarso fino e dedos, e por cima a coxa emplumada */}
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

          {/* Cauda longa e larga, em leque */}
          <g ref={partes.cauda}>
            <Penas penas={PENAS_CAUDA} />
          </g>

          {/* Corpo com plumagem em escamas no peito e nas costas */}
          <path d={CORPO} />
          <path d={escamas(60, 34, 98, 72, 3.6)} fill="none" strokeWidth="0.45" strokeOpacity="0.55" clipPath={`url(#${id}-corpo)`} />
          <path d={espiral(85, 60, 5, 1.6, 4.2)} fill="none" strokeWidth="0.8" />

          {/* Asa dobrada: primárias e secundárias em lâmina, coberteiras com escamas e espiral */}
          <g ref={partes.asaFechada}>
            <path d={ASA_FECHADA} />
            <Penas penas={PRIMARIAS_FECHADAS} />
            <Penas penas={SECUNDARIAS_FECHADAS} />
            <path d={COBERTEIRAS} />
            <path d={escamas(60, 36, 88, 56, 3.2)} fill="none" strokeWidth="0.45" strokeOpacity="0.6" clipPath={`url(#${id}-coberteiras)`} />
            <path d={espiral(80.6, 44.6, 4.6, 1.7, 3.4)} fill="none" strokeWidth="0.85" />
          </g>

          {/* Cabeça: gira em torno do pescoço */}
          <g ref={partes.cabeca}>
            <path d={CABECA} />
            <path d={escamas(78, 32, 96, 42, 2.6)} fill="none" strokeWidth="0.4" strokeOpacity="0.45" clipPath={`url(#${id}-cabeca)`} />
            {/* A parte de baixo do bico abre ao grasnar */}
            <g ref={partes.bico}>
              <path d={BICO_BAIXO} />
            </g>
            <path d={BICO_CIMA} />
            <path d="M99.6 26.6C101.8 26.6 104 27.6 106.4 29.4M99.4 28.4c2 .2 3.8 1 5.6 2.4" fill="none" strokeWidth="0.55" />
            {/* Olho de bravo: fenda inclinada sob a sobrancelha; pisca fechando a fenda */}
            {/* Ego: brilho em volta do olho, chama no canto e fumaça escapando para trás (não é um corvo comum) */}
            <circle className="aura-olho" cx="95.2" cy={OLHO_Y} r="9" fill={`url(#${id}-aura)`} stroke="none" />
            <FumacaOlho x={93.4} y={OLHO_Y - 0.4} angulo={196} alcance={29} filtro={`url(#${id}-fumaca)`} />
            {/* Chama maior (o grupo escala a partir do olho; a animação mexe no próprio caminho) */}
            <g transform={`translate(93 ${OLHO_Y}) scale(1.7) translate(-93 ${-OLHO_Y})`}>
            <path
              className="chama-olho"
              style={{ transformOrigin: "100% 50%" }}
              d={`M93 ${OLHO_Y - 1.1}C88.6 ${OLHO_Y - 3.4} 83.6 ${OLHO_Y - 3.2} 78.4 ${OLHO_Y - 5.6}C83.4 ${OLHO_Y - 1.6} 88.2 ${OLHO_Y + 1} 93 ${OLHO_Y + 0.8}Z`}
              fill={`url(#${id}-rastro)`}
              stroke="none"
              filter={`url(#${id}-brilho)`}
            />
            </g>
            <g ref={partes.olho} filter={`url(#${id}-brilho)`}>
              <path d={`M91.6 ${OLHO_Y - 0.2}Q95.2 ${OLHO_Y - 2.2} 98.8 ${OLHO_Y + 0.6}Q95 ${OLHO_Y + 1.5} 91.6 ${OLHO_Y - 0.2}Z`} fill="var(--color-destaque)" strokeWidth="0.4" />
              <circle cx="95.8" cy={OLHO_Y} r="0.75" fill="#000" stroke="none" />
            </g>
            <path d="M90 27C93.4 27 96.8 28 100.2 30.4" fill="none" strokeWidth="1.5" />
          </g>

          <g ref={partes.asaPerto} opacity="0">
            <AsaAberta id={id} />
          </g>
        </g>
      </g>

      {/* Área de clique (o resto não bloqueia a página) */}
      {aoClicar && (
        <rect x="20" y="20" width="90" height="78" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={aoClicar} />
      )}
    </svg>
  );
}
