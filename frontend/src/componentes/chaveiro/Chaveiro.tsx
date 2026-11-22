import { useEffect, useRef } from "react";

import { acordar, type Corpo, registrar } from "./fisica";

/**
 * Identidade de cada jogo no chaveiro, pelo appid da Steam. Para um jogo novo (ex.: CS2, appid 730),
 * basta acrescentar uma entrada.
 */
const JOGOS: Record<number, { sigla: string; nome: string; cor: string }> = {
  440: { sigla: "TF2", nome: "Team Fortress 2", cor: "#ff8c42" },
};

const SEGMENTOS = 6;
const COMPRIMENTO_SEGMENTO = 8;
const RAIO = 20;

/**
 * Chaveiro pendurado num card: uma linha com um círculo do jogo na ponta. Dá para segurar o círculo
 * e arrastar; ao soltar, ele balança e volta. Chaveiros que se encostam se empurram.
 * Posicione o ponto de fixação com `className` (ex.: "absolute top-3 right-12"); o elemento não ocupa espaço.
 */
export function Chaveiro({ appid = 440, className = "" }: { appid?: number; className?: string }) {
  const jogo = JOGOS[appid];
  const raiz = useRef<HTMLSpanElement>(null);
  const linha = useRef<SVGPolylineElement>(null);
  const pingente = useRef<SVGGElement>(null);
  const corpo = useRef<Corpo | null>(null);
  const pega = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!jogo) return;
    const pontos = Array.from({ length: SEGMENTOS + 1 }, (_, i) => ({ x: 0, y: i * COMPRIMENTO_SEGMENTO }));
    const novo: Corpo = {
      pontos,
      anteriores: pontos.map((p) => ({ ...p })),
      comprimentoElo: COMPRIMENTO_SEGMENTO,
      raio: RAIO,
      deslocamentoDisco: RAIO,
      arrasto: null,
      ancora: () => {
        const r = raiz.current?.getBoundingClientRect();
        return { x: r?.left ?? 0, y: r?.top ?? 0 };
      },
      desenhar: () => {
        linha.current?.setAttribute("points", pontos.map((p) => `${p.x},${p.y}`).join(" "));
        const ponta = pontos[SEGMENTOS]!;
        const antes = pontos[SEGMENTOS - 1]!;
        const angulo = (Math.atan2(ponta.y - antes.y, ponta.x - antes.x) * 180) / Math.PI - 90;
        pingente.current?.setAttribute("transform", `translate(${ponta.x} ${ponta.y}) rotate(${angulo})`);
      },
    };
    corpo.current = novo;
    novo.desenhar();
    return registrar(novo);
  }, [jogo]);

  if (!jogo) return null;

  function cursorLocal(evento: React.PointerEvent) {
    const ancora = corpo.current!.ancora();
    return { x: evento.clientX - ancora.x, y: evento.clientY - ancora.y };
  }

  function segurar(evento: React.PointerEvent<SVGGElement>) {
    const c = corpo.current;
    if (!c) return;
    // Sem isso, segurar e arrastar começa uma seleção de texto na página.
    evento.preventDefault();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const cursor = cursorLocal(evento);
    const ponta = c.pontos[SEGMENTOS]!;
    pega.current = { x: ponta.x - cursor.x, y: ponta.y - cursor.y };
    c.arrasto = { ...ponta };
    acordar();
  }

  function arrastar(evento: React.PointerEvent<SVGGElement>) {
    const c = corpo.current;
    // Só mexe enquanto está segurando; o cursor passando por cima não empurra.
    if (!c?.arrasto || !pega.current) return;
    const cursor = cursorLocal(evento);
    let x = cursor.x + pega.current.x;
    let y = cursor.y + pega.current.y;
    // A linha não estica: o alvo fica dentro do alcance a partir do ponto de fixação.
    const d = Math.hypot(x, y);
    const limite = SEGMENTOS * COMPRIMENTO_SEGMENTO;
    if (d > limite) {
      x = (x / d) * limite;
      y = (y / d) * limite;
    }
    c.arrasto = { x, y };
  }

  function soltar() {
    if (corpo.current) corpo.current.arrasto = null;
    pega.current = null;
  }

  return (
    <span ref={raiz} className={`z-20 size-0 select-none ${className}`} title={jogo.nome}>
      <svg
        width="1"
        height="1"
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        role="img"
        aria-label={`Chaveiro de ${jogo.nome}`}
      >
        <circle r="2.5" fill={jogo.cor} />
        <polyline ref={linha} fill="none" stroke="var(--color-suave)" strokeWidth="1.2" strokeLinejoin="round" />
        <g
          ref={pingente}
          className="pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={segurar}
          onPointerMove={arrastar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <circle cy={RAIO} r={RAIO} fill="var(--color-painel)" stroke={jogo.cor} strokeWidth="1.5" />
          <text
            className="pointer-events-none select-none"
            aria-hidden
            y={RAIO + 4.5}
            textAnchor="middle"
            fill={jogo.cor}
            fontFamily="var(--font-sans)"
            fontSize="13"
            fontWeight="800"
            style={{ fontStretch: "112%" }}
          >
            {jogo.sigla}
          </text>
        </g>
      </svg>
    </span>
  );
}
