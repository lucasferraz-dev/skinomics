// Poleiros: onde o mascote pode pousar. São os elementos marcados com `data-poleiro`:
// - card (`data-poleiro`): o topo inteiro, onde ele pode andar; o card também é obstáculo para o voo;
// - título (`data-poleiro="texto"`): as letras altas (maiúsculas e b, d, f, h, k, l) da primeira linha.
//   Em cada uma ele só se empoleira, no topo do desenho da letra, sem andar pelo vão entre elas.
// As coordenadas são relativas ao elemento que contém o mascote.

export type Poleiro = {
  chave: string;
  x0: number;
  x1: number;
  y: number;
  letra: boolean;
};

export type Caixa = { x0: number; y0: number; x1: number; y1: number };

const LARGURA_MINIMA_CARD = 60;
const RECUO_CARD = 12; // para não pousar exatamente na quina do card
const LETRAS_ALTAS = /[A-ZÇbdfhkl]/;

let medidor: CanvasRenderingContext2D | null = null;

/** Distância do topo da caixa do texto até o topo do desenho do caractere, com a fonte do título. */
function recuoDoGlifo(caractere: string, estilo: CSSStyleDeclaration): number {
  medidor ??= document.createElement("canvas").getContext("2d");
  if (!medidor) return parseFloat(estilo.fontSize) * 0.14;
  medidor.font = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
  // A largura da fonte dos títulos é 112% ("semi-expanded"); não muda a altura, só a medida horizontal.
  const medida = medidor.measureText(caractere);
  return medida.fontBoundingBoxAscent - medida.actualBoundingBoxAscent;
}

function letrasDaPrimeiraLinha(el: HTMLElement): { caractere: string; caixa: DOMRect }[] {
  const letras: { caractere: string; caixa: DOMRect }[] = [];
  const andarilho = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const faixa = document.createRange();
  for (let no = andarilho.nextNode(); no; no = andarilho.nextNode()) {
    const texto = no.textContent ?? "";
    for (let i = 0; i < texto.length; i++) {
      faixa.setStart(no, i);
      faixa.setEnd(no, i + 1);
      const caixa = faixa.getClientRects()[0];
      if (caixa) letras.push({ caractere: texto[i]!, caixa });
    }
  }
  if (!letras.length) return [];
  const topo = Math.min(...letras.map((l) => l.caixa.top));
  return letras.filter((l) => l.caixa.top - topo < 2);
}

export function coletarCena(referencia: DOMRect): { poleiros: Poleiro[]; obstaculos: Caixa[] } {
  const poleiros: Poleiro[] = [];
  const obstaculos: Caixa[] = [];
  document.querySelectorAll<HTMLElement>("[data-poleiro]").forEach((el, i) => {
    if (el.dataset.poleiro === "texto") {
      const estilo = getComputedStyle(el);
      letrasDaPrimeiraLinha(el).forEach(({ caractere, caixa }, j) => {
        if (!LETRAS_ALTAS.test(caractere)) return;
        const centro = (caixa.left + caixa.right) / 2 - referencia.left;
        poleiros.push({
          chave: `${i}:${j}`,
          x0: centro,
          x1: centro,
          y: caixa.top + recuoDoGlifo(caractere, estilo) - referencia.top,
          letra: true,
        });
      });
    } else {
      const r = el.getBoundingClientRect();
      if (r.width >= LARGURA_MINIMA_CARD) {
        poleiros.push({
          chave: `${i}`,
          x0: r.left - referencia.left + RECUO_CARD,
          x1: r.right - referencia.left - RECUO_CARD,
          y: r.top - referencia.top,
          letra: false,
        });
      }
      obstaculos.push({
        x0: r.left - referencia.left,
        y0: r.top - referencia.top,
        x1: r.right - referencia.left,
        y1: r.bottom - referencia.top,
      });
    }
  });
  return { poleiros, obstaculos };
}

/** Poleiro dentro da área visível (com folga para o cabeçalho fixo). */
export function visivel(poleiro: Poleiro, referencia: DOMRect): boolean {
  const topo = poleiro.y + referencia.top;
  return (
    topo > 120 &&
    topo < window.innerHeight - 20 &&
    poleiro.x0 + referencia.left > 0 &&
    poleiro.x1 + referencia.left < window.innerWidth
  );
}

/** Algum ponto da lista cai dentro de um card? (Uma folga pequena deixa pousar na borda de cima.) */
export function atravessa(pontos: { x: number; y: number }[], obstaculos: Caixa[]): boolean {
  return pontos.some((p) =>
    obstaculos.some((c) => p.x > c.x0 + 2 && p.x < c.x1 - 2 && p.y > c.y0 + 3 && p.y < c.y1 - 2),
  );
}
