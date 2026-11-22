// Física dos chaveiros: cada um é uma linha (integração de Verlet com restrições de distância)
// presa num ponto fixo, com o círculo do jogo como peso na ponta. Todos os chaveiros da página
// dividem o mesmo laço de animação, para os círculos colidirem entre si. O laço dorme quando
// tudo para e acorda com qualquer interação.

export type Vetor = { x: number; y: number };

export type Corpo = {
  /** Posições locais (px) relativas ao ponto de fixação; o índice 0 é a fixação, o último é a ponta. */
  pontos: Vetor[];
  anteriores: Vetor[];
  comprimentoElo: number;
  /** Raio do círculo e distância da ponta da linha até o centro dele. */
  raio: number;
  deslocamentoDisco: number;
  /** Posição do ponto de fixação na tela (coordenadas do viewport). */
  ancora: () => Vetor;
  /** Posição do cursor (local) enquanto alguém segura o círculo; null quando solto. */
  arrasto: Vetor | null;
  /** Retângulo (viewport) que funciona como parede: a linha e o círculo não entram nele. */
  parede?: () => DOMRect | undefined;
  desenhar: () => void;
};

const GRAVIDADE = 2200; // px/s²
const AMORTECIMENTO = 0.985; // por subpasso: deixa o chaveiro "pesado", sem balançar à toa
const VELOCIDADE_MAXIMA = 12; // px por subpasso, para um arremesso não virar bagunça
const SUBPASSOS = 3;
const ITERACOES = 10;
const MASSA_ELO = 1;
const MASSA_PONTA = 5;
const EMPURRAO_MAXIMO = 1.2; // px por subpasso
const RICOCHETE = 0.35; // fração da velocidade devolvida ao bater na parede

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

/** Direção da fixação até a ponta: estável mesmo quando a linha dobra. */
function direcao(ponta: Vetor): Vetor {
  const d = Math.hypot(ponta.x, ponta.y) || 1;
  return { x: ponta.x / d, y: ponta.y / d };
}

/** Ângulo (graus) para desenhar o círculo pendendo da ponta. */
export function anguloDisco(corpo: Corpo): number {
  const ponta = corpo.pontos[corpo.pontos.length - 1]!;
  return (Math.atan2(ponta.y, ponta.x) * 180) / Math.PI - 90;
}

/** Centro do círculo, em coordenadas locais. */
export function centroDisco(corpo: Corpo, ponta = corpo.pontos[corpo.pontos.length - 1]!): Vetor {
  const u = direcao(ponta);
  return { x: ponta.x + u.x * corpo.deslocamentoDisco, y: ponta.y + u.y * corpo.deslocamentoDisco };
}

function quadro(agora: number) {
  // Aba em segundo plano devolve intervalos enormes: limita para a simulação não explodir.
  const dt = Math.min((agora - ultimoTempo) / 1000, 1 / 30) / SUBPASSOS;
  ultimoTempo = agora;

  for (let s = 0; s < SUBPASSOS; s++) {
    corpos.forEach((corpo) => integrar(corpo, dt));
    for (let i = 0; i < ITERACOES; i++) {
      corpos.forEach((corpo) => {
        restringir(corpo);
        afastarLinhaDaParede(corpo);
      });
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
      // Segurado: vai direto para o ponto válido mais perto do cursor (fora do card e dentro do
      // alcance da linha). O deslocamento entre quadros vira a velocidade quando soltar.
      const alvo = alvoValido(corpo, corpo.arrasto);
      a.x = p.x;
      a.y = p.y;
      p.x = alvo.x;
      p.y = alvo.y;
      continue;
    }
    let vx = (p.x - a.x) * AMORTECIMENTO;
    let vy = (p.y - a.y) * AMORTECIMENTO;
    const v = Math.hypot(vx, vy);
    if (v > VELOCIDADE_MAXIMA) {
      vx *= VELOCIDADE_MAXIMA / v;
      vy *= VELOCIDADE_MAXIMA / v;
    }
    a.x = p.x;
    a.y = p.y;
    p.x += vx;
    p.y += vy + GRAVIDADE * dt * dt;
  }
}

/** Ponto mais perto do cursor onde a ponta pode ficar: linha sem esticar e círculo fora do card. */
function alvoValido(corpo: Corpo, cursor: Vetor): Vetor {
  const alcance = (corpo.pontos.length - 1) * corpo.comprimentoElo;
  const r = corpo.parede?.();
  const ancora = corpo.ancora();
  let { x, y } = cursor;
  for (let k = 0; k < 4; k++) {
    const d = Math.hypot(x, y);
    if (d > alcance) {
      x *= alcance / d;
      y *= alcance / d;
    }
    if (!r) break;
    const c = centroDisco(corpo, { x, y });
    const saida = separacao(r, ancora.x + c.x, ancora.y + c.y, corpo.raio);
    if (!saida) break;
    x += saida.nx * saida.penetracao;
    y += saida.ny * saida.penetracao;
  }
  return { x, y };
}

function restringir(corpo: Corpo) {
  const ultimo = corpo.pontos.length - 1;
  const inversa = (i: number) => {
    if (i === 0 || (i === ultimo && corpo.arrasto)) return 0;
    return 1 / (i === ultimo ? MASSA_PONTA : MASSA_ELO);
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

/** Círculos que se encostam são afastados; na integração de Verlet isso já vira o "empurrão". */
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

/** Quanto e para onde um círculo precisa sair do retângulo; null se já está fora. */
function separacao(r: DOMRect, cx: number, cy: number, raio: number) {
  const px = Math.min(Math.max(cx, r.left), r.right);
  const py = Math.min(Math.max(cy, r.top), r.bottom);
  const dx = cx - px;
  const dy = cy - py;
  const d = Math.hypot(dx, dy);
  if (d >= raio) return null;
  if (d > 0) return { nx: dx / d, ny: dy / d, penetracao: raio - d };
  // Centro dentro do card: sai por baixo, que é de onde o chaveiro pende.
  return { nx: 0, ny: 1, penetracao: r.bottom - cy + raio };
}

/** Pontos da linha que entraram no card saem pela borda mais próxima. */
function afastarLinhaDaParede(corpo: Corpo) {
  const r = corpo.parede?.();
  if (!r) return;
  const ancora = corpo.ancora();
  for (let i = 1; i < corpo.pontos.length - 1; i++) {
    const p = corpo.pontos[i]!;
    const x = ancora.x + p.x;
    const y = ancora.y + p.y;
    if (x <= r.left || x >= r.right || y <= r.top || y >= r.bottom) continue;
    const saida = [
      { d: x - r.left, dx: -(x - r.left), dy: 0 },
      { d: r.right - x, dx: r.right - x, dy: 0 },
      { d: y - r.top, dx: 0, dy: -(y - r.top) },
      { d: r.bottom - y, dx: 0, dy: r.bottom - y },
    ].sort((a, b) => a.d - b.d)[0]!;
    p.x += saida.dx;
    p.y += saida.dy;
  }
}

/** Mantém o círculo fora do card; solto, ele ricocheteia ao bater. */
function baterNaParede(corpo: Corpo) {
  const r = corpo.parede?.();
  if (!r || corpo.arrasto) return; // segurado, o alvo já respeita a parede
  const ancora = corpo.ancora();
  const c = centroDisco(corpo);
  const saida = separacao(r, ancora.x + c.x, ancora.y + c.y, corpo.raio);
  if (!saida) return;
  const ultimo = corpo.pontos.length - 1;
  const ponta = corpo.pontos[ultimo]!;
  const anterior = corpo.anteriores[ultimo]!;
  ponta.x += saida.nx * saida.penetracao;
  ponta.y += saida.ny * saida.penetracao;
  // Inverte (e amortece) a componente da velocidade que entrava na parede.
  const vx = ponta.x - anterior.x;
  const vy = ponta.y - anterior.y;
  const vn = vx * saida.nx + vy * saida.ny;
  if (vn < 0) {
    anterior.x = ponta.x - (vx - (1 + RICOCHETE) * vn * saida.nx);
    anterior.y = ponta.y - (vy - (1 + RICOCHETE) * vn * saida.ny);
  }
}
