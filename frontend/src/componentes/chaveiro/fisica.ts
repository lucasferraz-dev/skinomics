// Física dos chaveiros: cada um é uma linha (integração de Verlet com restrições de distância)
// presa num ponto fixo, com o círculo do jogo como peso na ponta. Todos os chaveiros da página
// dividem o mesmo laço de animação, para os medalhões colidirem entre si. O laço dorme quando
// tudo para e acorda com qualquer interação.

export type Vetor = { x: number; y: number };

export type Corpo = {
  /** Posições locais (px) relativas à argola; o índice 0 é a argola, o último é o medalhão. */
  pontos: Vetor[];
  anteriores: Vetor[];
  comprimentoElo: number;
  /** Raio do disco do medalhão e distância da ponta da corrente até o centro dele. */
  raio: number;
  deslocamentoDisco: number;
  /** Posição da argola na tela (coordenadas do viewport). */
  ancora: () => Vetor;
  /** Alvo do arraste, em coordenadas locais; null quando ninguém está segurando. */
  arrasto: Vetor | null;
  /** Retângulo (viewport) que funciona como parede: a linha e o círculo não entram nele. */
  parede?: () => DOMRect | undefined;
  desenhar: () => void;
};

const GRAVIDADE = 1800; // px/s²
const AMORTECIMENTO = 0.992; // por subpasso
const SUBPASSOS = 3;
const ITERACOES = 10;
const MASSA_ELO = 1;
const MASSA_MEDALHAO = 5;
const EMPURRAO_MAXIMO = 1.2; // px por subpasso
const RICOCHETE = 0.45; // fração da velocidade devolvida ao bater na parede

const corpos = new Set<Corpo>();
let rodando = false;
let quadrosParados = 0;
let ultimoTempo = 0;

export function registrar(corpo: Corpo): () => void {
  corpos.add(corpo);
  acordar();
  return () => {
    corpos.delete(corpo);
  };
}

export function acordar() {
  quadrosParados = 0;
  if (!rodando) {
    rodando = true;
    ultimoTempo = performance.now();
    requestAnimationFrame(quadro);
  }
}

/** Centro do disco do medalhão, em coordenadas locais (segue o ângulo do último elo). */
export function centroDisco(corpo: Corpo): Vetor {
  const n = corpo.pontos.length;
  const ponta = corpo.pontos[n - 1]!;
  const antes = corpo.pontos[n - 2]!;
  const dx = ponta.x - antes.x;
  const dy = ponta.y - antes.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: ponta.x + (dx / d) * corpo.deslocamentoDisco, y: ponta.y + (dy / d) * corpo.deslocamentoDisco };
}

function quadro(agora: number) {
  // Aba em segundo plano devolve intervalos enormes: limita para a simulação não explodir.
  const dt = Math.min((agora - ultimoTempo) / 1000, 1 / 30) / SUBPASSOS;
  ultimoTempo = agora;

  for (let s = 0; s < SUBPASSOS; s++) {
    corpos.forEach((corpo) => integrar(corpo, dt));
    for (let i = 0; i < ITERACOES; i++) {
      corpos.forEach(restringir);
    }
    colidir();
    corpos.forEach(baterNaParede);
  }

  let movimento = 0;
  corpos.forEach((corpo) => {
    corpo.desenhar();
    corpo.pontos.forEach((p, i) => {
      const a = corpo.anteriores[i]!;
      movimento = Math.max(movimento, Math.abs(p.x - a.x) + Math.abs(p.y - a.y));
    });
  });

  const segurando = [...corpos].some((corpo) => corpo.arrasto);
  quadrosParados = !segurando && movimento < 0.01 ? quadrosParados + 1 : 0;
  if (corpos.size === 0 || quadrosParados > 45) {
    rodando = false;
    return;
  }
  requestAnimationFrame(quadro);
}

function integrar(corpo: Corpo, dt: number) {
  const ultimo = corpo.pontos.length - 1;
  for (let i = 1; i <= ultimo; i++) {
    const p = corpo.pontos[i]!;
    const a = corpo.anteriores[i]!;
    if (i === ultimo && corpo.arrasto) {
      // Segurado: segue o cursor; a diferença para a posição anterior vira a velocidade ao soltar.
      a.x = p.x;
      a.y = p.y;
      p.x += (corpo.arrasto.x - p.x) * 0.5;
      p.y += (corpo.arrasto.y - p.y) * 0.5;
      continue;
    }
    const vx = (p.x - a.x) * AMORTECIMENTO;
    const vy = (p.y - a.y) * AMORTECIMENTO;
    a.x = p.x;
    a.y = p.y;
    p.x += vx;
    p.y += vy + GRAVIDADE * dt * dt;
  }
}

function restringir(corpo: Corpo) {
  const ultimo = corpo.pontos.length - 1;
  const inversa = (i: number) => {
    if (i === 0 || (i === ultimo && corpo.arrasto)) return 0;
    return 1 / (i === ultimo ? MASSA_MEDALHAO : MASSA_ELO);
  };
  for (let i = 0; i < ultimo; i++) {
    const p = corpo.pontos[i]!;
    const q = corpo.pontos[i + 1]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const wp = inversa(i);
    const wq = inversa(i + 1);
    if (wp + wq === 0) continue;
    const erro = (d - corpo.comprimentoElo) / d / (wp + wq);
    p.x += dx * erro * wp;
    p.y += dy * erro * wp;
    q.x -= dx * erro * wq;
    q.y -= dy * erro * wq;
  }
}

/** Medalhões que se encostam são afastados; na integração de Verlet isso já vira o "empurrão". */
function colidir() {
  const lista = [...corpos];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i]!;
      const b = lista[j]!;
      const oa = a.ancora();
      const ob = b.ancora();
      const ca = centroDisco(a);
      const cb = centroDisco(b);
      const dx = ob.x + cb.x - (oa.x + ca.x);
      const dy = ob.y + cb.y - (oa.y + ca.y);
      const d = Math.hypot(dx, dy);
      const minimo = a.raio + b.raio;
      if (d >= minimo || d === 0) continue;
      const pa = a.arrasto ? 0 : 1;
      const pb = b.arrasto ? 0 : 1;
      if (pa + pb === 0) continue;
      // Correção limitada por subpasso: o empurrão vira uma batida suave, não um arremesso.
      const empurrao = Math.min(minimo - d, EMPURRAO_MAXIMO) / (pa + pb);
      const nx = dx / d;
      const ny = dy / d;
      const pontaA = a.pontos[a.pontos.length - 1]!;
      const pontaB = b.pontos[b.pontos.length - 1]!;
      pontaA.x -= nx * empurrao * pa;
      pontaA.y -= ny * empurrao * pa;
      pontaB.x += nx * empurrao * pb;
      pontaB.y += ny * empurrao * pb;
    }
  }
}

/** Mantém a linha e o círculo fora do card; o círculo ricocheteia ao bater. */
function baterNaParede(corpo: Corpo) {
  const r = corpo.parede?.();
  if (!r) return;
  const ancora = corpo.ancora();
  const ultimo = corpo.pontos.length - 1;

  // Pontos da linha: se entraram no retângulo, saem pela borda mais próxima.
  for (let i = 1; i < ultimo; i++) {
    const p = corpo.pontos[i]!;
    const x = ancora.x + p.x;
    const y = ancora.y + p.y;
    if (x <= r.left || x >= r.right || y <= r.top || y >= r.bottom) continue;
    const saidas = [
      { d: x - r.left, dx: -(x - r.left), dy: 0 },
      { d: r.right - x, dx: r.right - x, dy: 0 },
      { d: y - r.top, dx: 0, dy: -(y - r.top) },
      { d: r.bottom - y, dx: 0, dy: r.bottom - y },
    ].sort((a, b) => a.d - b.d)[0]!;
    p.x += saidas.dx;
    p.y += saidas.dy;
  }

  // Círculo: distância do centro ao ponto mais próximo do retângulo.
  const centro = centroDisco(corpo);
  const cx = ancora.x + centro.x;
  const cy = ancora.y + centro.y;
  const px = Math.min(Math.max(cx, r.left), r.right);
  const py = Math.min(Math.max(cy, r.top), r.bottom);
  let nx = cx - px;
  let ny = cy - py;
  let d = Math.hypot(nx, ny);
  let penetracao: number;
  if (d > 0) {
    if (d >= corpo.raio) return;
    nx /= d;
    ny /= d;
    penetracao = corpo.raio - d;
  } else {
    // Centro dentro do card: sai por baixo, que é de onde o chaveiro pende.
    nx = 0;
    ny = 1;
    d = r.bottom - cy;
    penetracao = d + corpo.raio;
  }

  const ponta = corpo.pontos[ultimo]!;
  const anterior = corpo.anteriores[ultimo]!;
  ponta.x += nx * penetracao;
  ponta.y += ny * penetracao;
  if (corpo.arrasto) return;
  // Inverte (e amortece) a componente da velocidade que entrava na parede.
  const vx = ponta.x - anterior.x;
  const vy = ponta.y - anterior.y;
  const vn = vx * nx + vy * ny;
  if (vn < 0) {
    anterior.x = ponta.x - (vx - (1 + RICOCHETE) * vn * nx);
    anterior.y = ponta.y - (vy - (1 + RICOCHETE) * vn * ny);
  }
}
