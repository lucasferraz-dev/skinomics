// Esqueleto e poses do corvo. Coordenadas do viewBox do desenho (120 × 100), olhando para a direita,
// y para baixo. O chão fica em y = 96 e o ponto de apoio (entre os pés) em x = 55.
// As pernas têm duas partes resolvidas por cinemática inversa, com o "calcanhar" dobrando para trás,
// como nas aves.

export type Vetor = { x: number; y: number };

export const CHAO = 96;
export const APOIO_X = 55;
const TIBIA = 12;
const TARSO = 15;
const QUADRIS: [Vetor, Vetor] = [
  { x: 65, y: 69 },
  { x: 60, y: 69 },
];
const PES_PARADO: [number, number] = [62, 55];

export type Pe = Vetor & { fechado: number }; // fechado: 0 = dedos abertos no chão, 1 = encolhidos
export type Pose = {
  corpoY: number;
  inclinacao: number; // graus, em torno do quadril (+ = bico para baixo)
  cabecaX: number;
  cabecaY: number;
  cabecaGiro: number; // graus, em torno do pescoço
  pes: [Pe, Pe]; // [perto, longe]
  asa: "fechada" | "aberta";
  asaAngulo: number; // graus da asa aberta: 0 = para cima, 90 = para trás, 120 = para trás e para baixo
  asaLonge: number;
  asaFechadaGiro: number;
  cauda: number;
};

export function poseParada(): Pose {
  return {
    corpoY: 0,
    inclinacao: 0,
    cabecaX: 0,
    cabecaY: 0,
    cabecaGiro: 0,
    pes: [
      { x: PES_PARADO[0], y: CHAO, fechado: 0 },
      { x: PES_PARADO[1], y: CHAO, fechado: 0 },
    ],
    asa: "fechada",
    asaAngulo: 90,
    asaLonge: 90,
    asaFechadaGiro: 0,
    cauda: 0,
  };
}

export const AMPLITUDE_PASSO = 5;
const ALTURA_PASSO = 5;

/** Caminhada: `fase` avança com a distância, então o pé de apoio não escorrega. */
export function poseAndando(fase: number): Pose {
  const pe = (theta: number, base: number): Pe => {
    const noAr = Math.max(0, -Math.sin(theta));
    return { x: base + AMPLITUDE_PASSO * Math.cos(theta), y: CHAO - noAr * ALTURA_PASSO, fechado: noAr };
  };
  const p = poseParada();
  return {
    ...p,
    // O corpo sobe no meio do apoio e desce na troca de pés; a cabeça vai à frente a cada passo.
    corpoY: -(Math.abs(Math.sin(fase)) - 0.5) * 1.6,
    inclinacao: 4,
    cabecaX: Math.cos(fase * 2) * 2.2,
    cabecaY: Math.abs(Math.cos(fase)) * 0.8,
    pes: [pe(fase, PES_PARADO[0]), pe(fase + Math.PI, PES_PARADO[1])],
    cauda: Math.sin(fase * 2) * 2,
  };
}

/** Agachado (impulso antes de pular/decolar e amortecimento ao pousar), de 0 a 1. */
export function poseAgachada(quanto: number): Pose {
  const p = poseParada();
  return {
    ...p,
    corpoY: 6 * quanto,
    inclinacao: 10 * quanto,
    cabecaY: 2 * quanto,
    cabecaGiro: 6 * quanto,
    asaFechadaGiro: -6 * quanto,
    cauda: -10 * quanto,
  };
}

/** Pulo curto entre cards lado a lado: asas entreabertas, patas encolhidas. `t` de 0 a 1. */
export function posePulo(t: number): Pose {
  const p = poseParada();
  const recolher = Math.sin(Math.PI * Math.min(1, t * 1.4));
  return {
    ...p,
    corpoY: -1,
    inclinacao: t < 0.5 ? -6 : 6,
    cabecaY: -1,
    pes: [
      { x: 62 - 4 * recolher, y: CHAO - 9 * recolher, fechado: recolher },
      { x: 56 - 4 * recolher, y: CHAO - 8 * recolher, fechado: recolher },
    ],
    asa: "aberta",
    // Uma batida só: sobe a asa na saída e empurra para baixo no meio do pulo.
    // Asas erguidas, com uma batida para trás no meio do pulo.
    asaAngulo: 18 + 42 * Math.sin(t * Math.PI),
    asaLonge: 24 + 36 * Math.sin(t * Math.PI - 0.3),
    cauda: -8,
  };
}

/** Voo batendo as asas. `tempo` em ms; `inclinacao` segue a direção do voo. */
export function poseVoando(tempo: number, inclinacao: number): Pose {
  const batida = Math.sin(tempo / 55);
  return {
    ...poseParada(),
    corpoY: -batida * 1.5,
    inclinacao,
    cabecaX: 1.5,
    cabecaGiro: -inclinacao * 0.5,
    pes: [
      { x: 52, y: CHAO - 10, fechado: 1 },
      { x: 48, y: CHAO - 11, fechado: 1 },
    ],
    asa: "aberta",
    // Batida: de quase vertical (para cima) até para trás e para baixo.
    asaAngulo: 12 + 108 * (batida * 0.5 + 0.5),
    asaLonge: 18 + 92 * (Math.sin(tempo / 55 - 0.5) * 0.5 + 0.5),
    cauda: -6,
  };
}

/** Chegando para pousar: asas abertas freando, patas esticadas para a frente. */
export function poseFreando(tempo: number): Pose {
  const tremor = Math.sin(tempo / 40) * 6;
  return {
    ...poseParada(),
    inclinacao: -14,
    cabecaGiro: 8,
    pes: [
      { x: 67, y: CHAO - 1, fechado: 0.2 },
      { x: 62, y: CHAO - 2, fechado: 0.3 },
    ],
    asa: "aberta",
    asaAngulo: 18 + tremor,
    asaLonge: 24 + tremor,
    cauda: 10,
  };
}

export function misturar(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const pe = (p: Pe, q: Pe): Pe => ({ x: l(p.x, q.x), y: l(p.y, q.y), fechado: l(p.fechado, q.fechado) });
  return {
    corpoY: l(a.corpoY, b.corpoY),
    inclinacao: l(a.inclinacao, b.inclinacao),
    cabecaX: l(a.cabecaX, b.cabecaX),
    cabecaY: l(a.cabecaY, b.cabecaY),
    cabecaGiro: l(a.cabecaGiro, b.cabecaGiro),
    pes: [pe(a.pes[0], b.pes[0]), pe(a.pes[1], b.pes[1])],
    asa: t < 0.5 ? a.asa : b.asa,
    asaAngulo: l(a.asaAngulo, b.asaAngulo),
    asaLonge: l(a.asaLonge, b.asaLonge),
    asaFechadaGiro: l(a.asaFechadaGiro, b.asaFechadaGiro),
    cauda: l(a.cauda, b.cauda),
  };
}

const f = (n: number) => n.toFixed(2);

/** Quadril depois da inclinação e do sobe-e-desce do corpo (gira em torno do quadril de perto). */
function quadril(pose: Pose, lado: 0 | 1): Vetor {
  const q = QUADRIS[lado];
  const centro = QUADRIS[0];
  const a = (pose.inclinacao * Math.PI) / 180;
  const dx = q.x - centro.x;
  const dy = q.y - centro.y;
  return {
    x: centro.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: centro.y + dx * Math.sin(a) + dy * Math.cos(a) + pose.corpoY,
  };
}

/** Perna: tíbia (coberta de penas), tarso e dedos. Devolve os caminhos SVG de cada parte. */
export function perna(pose: Pose, lado: 0 | 1): { tibia: string; tarso: string; dedos: string } {
  const h = quadril(pose, lado);
  const pe = pose.pes[lado];
  const dx = pe.x - h.x;
  const dy = pe.y - h.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), 1), TIBIA + TARSO - 0.01);
  const base = Math.atan2(dy, dx);
  const abertura = Math.acos((TIBIA * TIBIA + d * d - TARSO * TARSO) / (2 * TIBIA * d));
  const angulo = base + abertura; // calcanhar para trás
  const calcanhar = { x: h.x + Math.cos(angulo) * TIBIA, y: h.y + Math.sin(angulo) * TIBIA };
  // Dedos: três para a frente e um para trás; encolhem (giram para baixo) com o pé no ar.
  const curva = pe.fechado * 0.9;
  const dedo = (anguloBase: number, tamanho: number) => {
    const a = anguloBase + (anguloBase > Math.PI / 2 ? -curva : curva);
    return `M${f(pe.x)} ${f(pe.y)}l${f(Math.cos(a) * tamanho)} ${f(Math.sin(a) * tamanho)}`;
  };
  return {
    tibia: `M${f(h.x)} ${f(h.y)}L${f(calcanhar.x)} ${f(calcanhar.y)}`,
    tarso: `M${f(calcanhar.x)} ${f(calcanhar.y)}L${f(pe.x)} ${f(pe.y)}`,
    dedos: [dedo(0, 7.5), dedo(0.22, 6), dedo(-0.12, 5.5), dedo(Math.PI, 5)].join(""),
  };
}

export function transformarCorpo(pose: Pose): string {
  const q = QUADRIS[0];
  return `translate(0 ${f(pose.corpoY)}) rotate(${f(pose.inclinacao)} ${q.x} ${q.y})`;
}

export const PESCOCO = { x: 88, y: 38 };
export const OMBRO = { x: 80, y: 41 };
export const BASE_CAUDA = { x: 40, y: 64 };
