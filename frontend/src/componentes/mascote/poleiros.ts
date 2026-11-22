// Poleiros: superfícies onde o mascote pode pousar. São os elementos marcados com `data-poleiro`:
// o topo de um card (`data-poleiro`) ou o topo de cada linha de um título grande
// (`data-poleiro="texto"`). As coordenadas são relativas ao elemento que contém o mascote.

export type Poleiro = {
  chave: string;
  x0: number;
  x1: number;
  y: number;
};

const LARGURA_MINIMA = 60;
const RECUO = 10; // para o mascote não pousar exatamente na quina

export function coletarPoleiros(referencia: DOMRect): Poleiro[] {
  const poleiros: Poleiro[] = [];
  document.querySelectorAll<HTMLElement>("[data-poleiro]").forEach((el, i) => {
    if (el.dataset.poleiro === "texto") {
      // Só a primeira linha do título: nas de baixo o mascote ficaria por cima das letras da linha
      // anterior (os títulos têm entrelinha apertada). Cada trecho dessa linha vira um poleiro.
      const alturaLetra = parseFloat(getComputedStyle(el).fontSize) * 0.14;
      const faixa = document.createRange();
      faixa.selectNodeContents(el);
      const linhas = [...faixa.getClientRects()];
      const topo = Math.min(...linhas.map((r) => r.top));
      linhas.forEach((r, j) => {
        if (r.top - topo < 2) adicionar(poleiros, `${i}:${j}`, r.left, r.right, r.top + alturaLetra, referencia);
      });
    } else {
      const r = el.getBoundingClientRect();
      adicionar(poleiros, `${i}`, r.left, r.right, r.top, referencia);
    }
  });
  return poleiros;
}

function adicionar(lista: Poleiro[], chave: string, esquerda: number, direita: number, topo: number, ref: DOMRect) {
  if (direita - esquerda < LARGURA_MINIMA) return;
  lista.push({ chave, x0: esquerda - ref.left + RECUO, x1: direita - ref.left - RECUO, y: topo - ref.top });
}

/** Poleiro inteiro dentro da área visível (com folga para o cabeçalho fixo). */
export function visivel(poleiro: Poleiro, referencia: DOMRect): boolean {
  const topo = poleiro.y + referencia.top;
  return topo > 90 && topo < window.innerHeight - 20 && poleiro.x0 + referencia.left > 0 && poleiro.x1 + referencia.left < window.innerWidth;
}
