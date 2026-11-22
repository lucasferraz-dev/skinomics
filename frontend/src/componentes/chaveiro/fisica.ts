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
  /** Enquanto segurado: onde a ponta está e a velocidade (suavizada) com que o cursor a move. */
  alvoArrasto?: Vetor;
  velocidadeArrasto?: Vetor;
  /** Amplitude (px) do balanço leve e constante da ponta; 0 = parado quando ninguém mexe. */
  balanco?: number;
  /** Ritmo (rad/s) e fase do balanço, sorteados por chaveiro para não balançarem juntos. */
  ritmo?: number;
  fase?: number;
  /** Posição da fixação e da parede lidas uma vez por quadro (ler o layout é caro), e se está perto da tela. */
  quadroAncora?: Vetor;
  quadroParede?: DOMRect | null;
  ativo?: boolean;
  /** Retângulo (viewport) que funciona como parede: a linha e o círculo não entram nele. */
  parede?: () => DOMRect | undefined;
  desenhar: () => void;
};

const GRAVIDADE = 2200; // px/s²
const AMORTECIMENTO = 0.997; // por subpasso: balança de um lado ao outro algumas vezes até parar
const VELOCIDADE_MAXIMA = 22; // px por subpasso, para um arremesso não virar bagunça
const SUBPASSOS = 3;
const ITERACOES = 10;
const MASSA_ELO = 1;
const MASSA_PONTA = 5;
const EMPURRAO_MAXIMO = 2.5; // px por subpasso
const ELASTICIDADE = 0.6; // quanto da velocidade de aproximação volta numa batida entre chaveiros
const RICOCHETE = 0.5; // fração da velocidade devolvida ao bater na parede

const corpos = new Set<Corpo>();
// Com "reduzir movimento" ligado, nada de balanço constante.
const calmo = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let tempo = 0; // s, para o balanço
let rodando = false;
let quadrosParados = 0;
let ultimoTempo = 0;
let movimentoAnterior = Infinity; // maior deslocamento de um ponto no quadro anterior

// Ao rolar a página, chaveiros que estavam longe da tela voltam a ser simulados.
let ouvindoRolagem = false;

/** Fixação do corpo neste quadro (lida uma vez por quadro). */
function ancoraDe(corpo: Corpo): Vetor {
  return corpo.quadroAncora ?? corpo.ancora();
}

/** Parede do corpo neste quadro (lida uma vez por quadro). */
function paredeDe(corpo: Corpo): DOMRect | undefined {
  return corpo.quadroParede === undefined ? corpo.parede?.() : (corpo.quadroParede ?? undefined);
}

function alcance(corpo: Corpo): number {
  return (corpo.pontos.length - 1) * corpo.comprimentoElo + corpo.deslocamentoDisco + corpo.raio;
}

export function registrar(corpo: Corpo): () => void {
  if (!ouvindoRolagem && typeof window !== "undefined") {
    ouvindoRolagem = true;
    window.addEventListener("scroll", () => acordar(), { passive: true });
  }
  corpo.ritmo ??= 1.25 + Math.random() * 0.55; // ida e volta em ~3,5 a 5 s
  corpo.fase ??= Math.random() * Math.PI * 2;
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
  tempo += dt * SUBPASSOS;

  // Lê o layout uma vez por corpo neste quadro e separa os que estão perto da tela: os outros ficam
  // parados até a página rolar até eles.
  const ativos: Corpo[] = [];
  corpos.forEach((corpo) => {
    const a = corpo.ancora();
    corpo.quadroAncora = a;
    corpo.quadroParede = corpo.parede?.() ?? null;
    const margem = alcance(corpo) + 200;
    corpo.ativo =
      corpo.arrasto !== null ||
      (a.y > -margem && a.y < window.innerHeight + margem && a.x > -margem && a.x < window.innerWidth + margem);
    if (corpo.ativo) ativos.push(corpo);
  });

  // Segurado: acompanha o cursor e mede a velocidade com que ele move a ponta, para o chaveiro
  // sair com esse embalo quando for solto (um arremesso continua balançando).
  ativos.forEach((corpo) => {
    if (!corpo.arrasto) {
      corpo.alvoArrasto = undefined;
      corpo.velocidadeArrasto = undefined;
      return;
    }
    const alvo = alvoValido(corpo, corpo.arrasto);
    const antes = corpo.alvoArrasto ?? alvo;
    const medida = { x: (alvo.x - antes.x) / SUBPASSOS, y: (alvo.y - antes.y) / SUBPASSOS };
    const v = corpo.velocidadeArrasto ?? medida;
    corpo.velocidadeArrasto = { x: v.x * 0.4 + medida.x * 0.6, y: v.y * 0.4 + medida.y * 0.6 };
    corpo.alvoArrasto = alvo;
  });

  // Só balançando de leve (ninguém segurando, nada se mexendo rápido), poucas iterações bastam para
  // manter a linha firme; ao arrastar, bater ou soltar, volta ao cálculo completo.
  const calmaria = !ativos.some((corpo) => corpo.arrasto) && movimentoAnterior < 0.4;
  const iteracoes = calmaria ? 3 : ITERACOES;

  for (let s = 0; s < SUBPASSOS; s++) {
    ativos.forEach((corpo) => integrar(corpo, dt));
    for (let i = 0; i < iteracoes; i++) {
      ativos.forEach((corpo) => {
        restringir(corpo);
        afastarLinhaDaParede(corpo);
      });
    }
    colidir(ativos);
    ativos.forEach(baterNaParede);
  }

  let movimento = 0;
  ativos.forEach((corpo) => {
    corpo.desenhar();
    corpo.pontos.forEach((p, i) => {
      const a = corpo.anteriores[i]!;
      movimento = Math.max(movimento, Math.abs(p.x - a.x) + Math.abs(p.y - a.y));
    });
  });

  movimentoAnterior = movimento;
  const segurando = ativos.some((corpo) => corpo.arrasto);
  // Com balanço constante o laço não dorme enquanto houver chaveiro perto da tela (o navegador já o
  // pausa com a aba escondida); longe de todos, dorme e acorda com a rolagem.
  const balancando = !calmo && ativos.some((corpo) => (corpo.balanco ?? 0) > 0);
  quadrosParados = !segurando && !balancando && movimento < 0.01 ? quadrosParados + 1 : 0;
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
    if (i === ultimo && corpo.arrasto && corpo.alvoArrasto) {
      // Segurado: fica no ponto válido mais perto do cursor (fora do card e dentro do alcance da
      // linha); a posição anterior guarda a velocidade do cursor, que vira o embalo ao soltar.
      const v = corpo.velocidadeArrasto ?? { x: 0, y: 0 };
      p.x = corpo.alvoArrasto.x;
      p.y = corpo.alvoArrasto.y;
      a.x = p.x - v.x;
      a.y = p.y - v.y;
      continue;
    }
    let vx = (p.x - a.x) * AMORTECIMENTO;
    let vy = (p.y - a.y) * AMORTECIMENTO;
    if (i === ultimo && !calmo && corpo.balanco) {
      // Empurrão lateral lento e periódico na ponta. Bem abaixo da frequência natural do pêndulo,
      // o deslocamento fica perto de amplitude: a aceleração é proporcional a g / comprimento.
      const comprimento = ultimo * corpo.comprimentoElo + corpo.deslocamentoDisco;
      const aceleracao = ((corpo.balanco * GRAVIDADE) / comprimento) * Math.sin(tempo * corpo.ritmo! + corpo.fase!);
      vx += aceleracao * dt * dt;
    }
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
  const r = paredeDe(corpo);
  const ancora = ancoraDe(corpo);
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
function colidir(lista: Corpo[]) {
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i]!;
      const b = lista[j]!;
      const oa = ancoraDe(a);
      const ob = ancoraDe(b);
      // Fixações longe demais para os círculos se alcançarem: nem calcula.
      if (Math.abs(oa.x - ob.x) > alcance(a) + alcance(b) || Math.abs(oa.y - ob.y) > alcance(a) + alcance(b)) continue;
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
      const nx = dx / d;
      const ny = dy / d;
      const pontaA = a.pontos[a.pontos.length - 1]!;
      const pontaB = b.pontos[b.pontos.length - 1]!;
      const antA = a.anteriores[a.anteriores.length - 1]!;
      const antB = b.anteriores[b.anteriores.length - 1]!;
      // Batida: troca de impulso na direção do contato (o que vem rápido empurra o outro, que sai
      // balançando), com parte da energia perdida.
      const va = { x: pontaA.x - antA.x, y: pontaA.y - antA.y };
      const vb = { x: pontaB.x - antB.x, y: pontaB.y - antB.y };
      const aproximacao = (vb.x - va.x) * nx + (vb.y - va.y) * ny;
      if (aproximacao < 0) {
        const j = (-(1 + ELASTICIDADE) * aproximacao) / (pa + pb);
        va.x -= j * pa * nx;
        va.y -= j * pa * ny;
        vb.x += j * pb * nx;
        vb.y += j * pb * ny;
      }
      // Separa os círculos (limitado por subpasso, para não dar tranco).
      const empurrao = Math.min(minimo - d, EMPURRAO_MAXIMO) / (pa + pb);
      pontaA.x -= nx * empurrao * pa;
      pontaA.y -= ny * empurrao * pa;
      pontaB.x += nx * empurrao * pb;
      pontaB.y += ny * empurrao * pb;
      if (pa) {
        antA.x = pontaA.x - va.x;
        antA.y = pontaA.y - va.y;
      }
      if (pb) {
        antB.x = pontaB.x - vb.x;
        antB.y = pontaB.y - vb.y;
      }
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
  const r = paredeDe(corpo);
  if (!r) return;
  const ancora = ancoraDe(corpo);
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
  const r = paredeDe(corpo);
  if (!r || corpo.arrasto) return; // segurado, o alvo já respeita a parede
  const ancora = ancoraDe(corpo);
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
