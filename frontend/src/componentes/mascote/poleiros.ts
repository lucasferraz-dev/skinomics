// Poleiros: onde o mascote pode pousar. São os elementos marcados com `data-poleiro`:
// - card (`data-poleiro`): o topo inteiro, onde ele pode andar; o card também é obstáculo para o voo;
// - título (`data-poleiro="texto"`): as letras altas (maiúsculas e b, d, f, h, k, l) da primeira linha
//   que têm topo plano. Em cada uma ele só se empoleira, no centro desse topo, sem andar entre elas.
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

// Largura mínima (em px) do trecho plano no topo da letra para os pés caberem.
const TOPO_MINIMO = 8;

type TopoLetra = { recuoY: number; centroX: number; largura: number } | null;
const cacheTopos = new Map<string, TopoLetra>();
let tela: CanvasRenderingContext2D | null = null;

/**
 * Desenha a letra num canvas com a fonte do título e acha o topo do desenho: a primeira linha com
 * tinta e, logo abaixo, o maior trecho contínuo (o "quadradinho" em cima do A, a barra do T...).
 * Devolve a distância do topo da caixa do texto até lá e o centro desse trecho, a partir da esquerda.
 */
function topoDaLetra(caractere: string, estilo: CSSStyleDeclaration): TopoLetra {
  const chave = `${caractere}|${estilo.fontWeight}|${estilo.fontSize}|${estilo.fontFamily}|${estilo.fontStretch}`;
  if (cacheTopos.has(chave)) return cacheTopos.get(chave)!;
  tela ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!tela) return null;
  const fonte = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
  tela.font = fonte;
  // Os títulos usam largura de 112% na fonte variável: "semi-expanded" no canvas.
  if ("fontStretch" in tela && parseFloat(estilo.fontStretch) > 105) tela.fontStretch = "semi-expanded";
  const medida = tela.measureText(caractere);
  const largura = Math.ceil(medida.width) + 4;
  const altura = Math.ceil(medida.fontBoundingBoxAscent + medida.fontBoundingBoxDescent) + 4;
  const canvas = tela.canvas;
  canvas.width = largura;
  canvas.height = altura;
  tela.font = fonte; // redimensionar o canvas reinicia o contexto
  if ("fontStretch" in tela && parseFloat(estilo.fontStretch) > 105) tela.fontStretch = "semi-expanded";
  tela.fillStyle = "#000";
  tela.fillText(caractere, 2, medida.fontBoundingBoxAscent + 2);
  const { data } = tela.getImageData(0, 0, largura, altura);
  const tinta = (x: number, y: number) => data[(y * largura + x) * 4 + 3]! > 128;

  let topo = -1;
  for (let y = 0; y < altura && topo < 0; y++) {
    for (let x = 0; x < largura; x++) {
      if (tinta(x, y)) {
        topo = y;
        break;
      }
    }
  }
  // Maior trecho contínuo de tinta numa linha do desenho.
  const trechoEm = (y: number) => {
    let melhor = { inicio: 0, fim: -1 };
    for (let x = 0, inicio = -1; x <= largura; x++) {
      if (x < largura && tinta(x, y)) {
        if (inicio < 0) inicio = x;
      } else if (inicio >= 0) {
        if (x - 1 - inicio > melhor.fim - melhor.inicio) melhor = { inicio, fim: x - 1 };
        inicio = -1;
      }
    }
    return { ...melhor, tamanho: melhor.fim - melhor.inicio + 1 };
  };
  let resultado: TopoLetra = null;
  if (topo >= 0 && topo + 4 < altura) {
    // Topo plano: logo na primeira linha a tinta já é quase tão larga quanto um pouco abaixo.
    // Num topo curvo (S, O, C) a primeira linha é estreita e vai alargando.
    const cima = trechoEm(topo + 1);
    const abaixo = trechoEm(topo + 4);
    if (cima.tamanho >= TOPO_MINIMO && cima.tamanho >= abaixo.tamanho * 0.7) {
      resultado = { recuoY: topo - 2, centroX: (cima.inicio + cima.fim) / 2 - 2, largura: cima.tamanho };
    }
  }
  // Só guarda depois que as fontes carregaram; antes, a medida seria da fonte reserva.
  if (document.fonts.status === "loaded") cacheTopos.set(chave, resultado);
  return resultado;
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
        // Só letras com topo plano o bastante (A, T, E, H, D, l...); as redondas (S, O, C) ficam de fora.
        const topo = topoDaLetra(caractere, estilo);
        if (!topo) return;
        const centro = caixa.left + topo.centroX - referencia.left;
        poleiros.push({
          chave: `${i}:${j}`,
          x0: centro,
          x1: centro,
          y: caixa.top + topo.recuoY - referencia.top,
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
