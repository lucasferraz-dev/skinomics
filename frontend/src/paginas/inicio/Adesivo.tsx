import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

// Adesivo que dá para descolar puxando pela ponta do canto inferior direito. A dobra fica na
// mediatriz entre o canto e o ponto puxado: o que está do lado do canto sai do adesivo e reaparece
// espelhado por cima, como a aba dobrada mostrando o verso. Embaixo aparece um dado a mais.
// Ao soltar, ele cola de volta.

type Ponto = { x: number; y: number };

const PONTA_PARADO = 9; // px: tamanho da pontinha descolada em repouso
const PONTA_MIRANDO = 15; // ... com o mouse em cima
const PARTE_COLADA = 0.15; // fração da largura (à esquerda) que nunca descola

/** Divide o retângulo pela dobra: o que continua colado e a aba (já espelhada sobre a dobra). */
function dobrar(largura: number, altura: number, puxado: Ponto) {
  const canto = { x: largura, y: altura };
  const d = { x: puxado.x - canto.x, y: puxado.y - canto.y };
  const tamanho = Math.hypot(d.x, d.y);
  const retangulo: Ponto[] = [
    { x: 0, y: 0 },
    { x: largura, y: 0 },
    { x: largura, y: altura },
    { x: 0, y: altura },
  ];
  if (tamanho < 0.5) return { colado: retangulo, aba: [] as Ponto[], angulo: 0 };
  const n = { x: d.x / tamanho, y: d.y / tamanho };
  const meio = { x: (canto.x + puxado.x) / 2, y: (canto.y + puxado.y) / 2 };
  const lado = (p: Ponto) => (p.x - meio.x) * n.x + (p.y - meio.y) * n.y; // > 0: lado do ponto puxado

  // Recorte de um polígono por um semiplano (Sutherland–Hodgman, uma aresta só).
  const recortar = (manter: (v: number) => boolean) => {
    const saida: Ponto[] = [];
    retangulo.forEach((a, i) => {
      const b = retangulo[(i + 1) % retangulo.length]!;
      const la = lado(a);
      const lb = lado(b);
      if (manter(la)) saida.push(a);
      if (manter(la) !== manter(lb)) {
        const t = la / (la - lb);
        saida.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    });
    return saida;
  };
  const espelhar = (p: Ponto) => {
    const k = 2 * lado(p);
    return { x: p.x - k * n.x, y: p.y - k * n.y };
  };
  return {
    colado: recortar((v) => v >= 0),
    aba: recortar((v) => v < 0).map(espelhar),
    angulo: (Math.atan2(d.y, d.x) * 180) / Math.PI + 90,
  };
}

const poligono = (pontos: Ponto[], dx = 0, dy = 0) =>
  `polygon(${pontos.map((p) => `${(p.x + dx).toFixed(1)}px ${(p.y + dy).toFixed(1)}px`).join(", ")})`;

export function Adesivo({
  estilo,
  frente,
  verso,
  para,
  titulo,
}: {
  estilo: CSSProperties;
  frente: ReactNode;
  verso: { rotulo: string; valor: ReactNode };
  para?: string;
  titulo?: string;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const frenteRef = useRef<HTMLElement>(null);
  const abaRef = useRef<HTMLDivElement>(null);
  const [puxando, setPuxando] = useState(false);
  const recuo = useRef(PONTA_PARADO); // distância diagonal da ponta, quando não está puxando
  const puxado = useRef<Ponto | null>(null);
  const animacao = useRef(0);
  // Enquanto segura ou enquanto volta a colar, o mouse entrando/saindo da ponta não mexe nela.
  const ocupado = useRef(false);

  // Desenha a dobra a partir do ponto puxado (ou da pontinha em repouso).
  const desenhar = () => {
    const el = raiz.current;
    if (!el) return;
    const largura = el.offsetWidth;
    const altura = el.offsetHeight;
    const bruto = puxado.current ?? { x: largura - recuo.current, y: altura - recuo.current };
    // A ponta nunca passa do canto (no "passar do ponto" da volta, a dobra se inverteria).
    const ponto = { x: Math.min(bruto.x, largura - 0.5), y: Math.min(bruto.y, altura - 0.5) };
    const { colado, aba, angulo } = dobrar(largura, altura, ponto);
    frenteRef.current?.style.setProperty("clip-path", poligono(colado));
    if (abaRef.current) {
      abaRef.current.style.clipPath = aba.length ? poligono(aba, largura, altura) : "polygon(0 0)";
      abaRef.current.style.background = `linear-gradient(${angulo.toFixed(0)}deg, var(--verso), color-mix(in srgb, var(--verso) 62%, black))`;
    }
  };

  // Redesenha a cada renderização (sem cancelar a animação de colar de volta, que segue sozinha).
  useEffect(() => desenhar());

  useEffect(() => {
    const aoRedimensionar = () => desenhar();
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      window.removeEventListener("resize", aoRedimensionar);
      cancelAnimationFrame(animacao.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao montar e desmontar
  }, []);

  /** Anima a ponta até um recuo (soltar: cola de volta; mirar: levanta um pouco). */
  const animarRecuo = (alvo: number, de?: Ponto) => {
    cancelAnimationFrame(animacao.current);
    const el = raiz.current;
    if (!el) return;
    const largura = el.offsetWidth;
    const altura = el.offsetHeight;
    const inicio = de ?? { x: largura - recuo.current, y: altura - recuo.current };
    const fim = { x: largura - alvo, y: altura - alvo };
    const comeco = performance.now();
    const duracao = de ? 550 : 160;
    const passo = (agora: number) => {
      const t = Math.min((agora - comeco) / duracao, 1);
      // Volta com um leve passar do ponto, como o adesivo grudando de novo.
      const e = de ? 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2) : 1 - Math.pow(1 - t, 3);
      puxado.current = { x: inicio.x + (fim.x - inicio.x) * e, y: inicio.y + (fim.y - inicio.y) * e };
      desenhar();
      if (t < 1) {
        animacao.current = requestAnimationFrame(passo);
      } else {
        puxado.current = null;
        recuo.current = alvo;
        if (de) ocupado.current = false;
        desenhar();
      }
    };
    animacao.current = requestAnimationFrame(passo);
  };

  const pontoLocal = (evento: React.PointerEvent) => {
    const r = raiz.current!.getBoundingClientRect();
    // A dobra fica no meio do caminho entre o canto e o cursor, então o cursor pode ir além da borda
    // esquerda: o limite é a dobra, que sempre deixa uma faixa colada de PARTE_COLADA da largura.
    return {
      x: Math.min(Math.max(evento.clientX - r.left, r.width * (2 * PARTE_COLADA - 1)), r.width),
      y: Math.min(Math.max(evento.clientY - r.top, -r.height), r.height),
    };
  };

  function pegar(evento: React.PointerEvent<HTMLButtonElement>) {
    evento.preventDefault();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    cancelAnimationFrame(animacao.current);
    ocupado.current = true;
    setPuxando(true);
    puxado.current = pontoLocal(evento);
    desenhar();
  }

  function arrastar(evento: React.PointerEvent<HTMLButtonElement>) {
    if (!puxando) return;
    puxado.current = pontoLocal(evento);
    desenhar();
  }

  function soltar() {
    if (!puxando) return;
    setPuxando(false);
    // Solto: cola de volta, animando a ponta até a posição de repouso.
    animarRecuo(PONTA_PARADO, puxado.current ?? undefined);
  }

  const classeFrente =
    "group relative flex h-full items-center gap-3 overflow-hidden rounded-2xl border border-[var(--contorno)] bg-[var(--fundo)] px-4 py-3 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9)]";

  return (
    <div ref={raiz} data-poleiro className="relative select-none" style={estilo}>
      {/* Embaixo do adesivo: um dado a mais, com a marca tracejada de onde ele está colado */}
      <div className="absolute inset-[3px] flex flex-col items-end justify-center gap-0.5 rounded-2xl border-2 border-dashed border-destaque/35 px-4 text-right">
        <span className="font-rotulo text-[11px] font-bold tracking-[0.06em] text-suave">{verso.rotulo}</span>
        <span className="max-w-[70%] truncate font-mono text-sm text-destaque">{verso.valor}</span>
      </div>

      {para ? (
        <Link ref={frenteRef as React.Ref<HTMLAnchorElement>} to={para} className={classeFrente} title={titulo}>
          {frente}
        </Link>
      ) : (
        <div ref={frenteRef as React.Ref<HTMLDivElement>} className={classeFrente} title={titulo}>
          {frente}
        </div>
      )}

      {/* Aba dobrada: o verso do adesivo, com sombra sobre a parte ainda colada */}
      <div className="pointer-events-none absolute inset-0 overflow-visible drop-shadow-[-3px_-2px_3px_rgba(0,0,0,0.45)]" aria-hidden>
        <div ref={abaRef} className="absolute" style={{ left: "-100%", top: "-100%", width: "300%", height: "300%" }} />
      </div>

      {/* A ponta: pegue e puxe para a esquerda ou para cima */}
      <button
        type="button"
        aria-label="Puxe para descolar o adesivo"
        title="Puxe para descolar"
        onPointerDown={pegar}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onPointerEnter={() => !ocupado.current && animarRecuo(PONTA_MIRANDO)}
        onPointerLeave={() => !ocupado.current && animarRecuo(PONTA_PARADO)}
        className={`absolute right-0 bottom-0 z-10 size-8 touch-none ${puxando ? "cursor-grabbing" : "cursor-grab"}`}
      />
    </div>
  );
}
