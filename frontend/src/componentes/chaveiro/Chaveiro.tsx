import { type CSSProperties, type RefObject, useEffect, useRef } from "react";

import { acordar, anguloDisco, type Corpo, registrar } from "./fisica";
import { type TemaChaveiro, temasDoItem } from "./temas";

const COMPRIMENTO_SEGMENTO = 8;
const RAIO = 20;
const ESPACAMENTO = 46; // px entre os pontos de fixação de chaveiros vizinhos

/**
 * Chaveiro pendurado embaixo de um card: uma linha com um círculo na ponta, com o ícone do tema.
 * Dá para segurar o círculo e arrastar; ao soltar, ele balança e volta. O card (`parede`) não deixa
 * a linha nem o círculo entrarem, e chaveiros que se encostam se empurram. Posicione o ponto de
 * fixação com `className`/`style`; o elemento não ocupa espaço.
 */
export function Chaveiro({
  tema,
  segmentos = 6,
  parede,
  className = "",
  style,
}: {
  tema: TemaChaveiro;
  segmentos?: number;
  parede?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
}) {
  const raiz = useRef<HTMLSpanElement>(null);
  const linha = useRef<SVGPolylineElement>(null);
  const pingente = useRef<SVGGElement>(null);
  const corpo = useRef<Corpo | null>(null);
  const pega = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const pontos = Array.from({ length: segmentos + 1 }, (_, i) => ({ x: 0, y: i * COMPRIMENTO_SEGMENTO }));
    // Entra balançando, para a troca de item ficar visível.
    const empurrao = (Math.random() < 0.5 ? -1 : 1) * 2.5;
    const novo: Corpo = {
      pontos,
      anteriores: pontos.map((p, i) => ({ x: p.x - (empurrao * i) / segmentos, y: p.y })),
      comprimentoElo: COMPRIMENTO_SEGMENTO,
      raio: RAIO,
      deslocamentoDisco: RAIO,
      arrasto: null,
      parede: () => parede?.current?.getBoundingClientRect(),
      ancora: () => {
        const r = raiz.current?.getBoundingClientRect();
        return { x: r?.left ?? 0, y: r?.top ?? 0 };
      },
      desenhar: () => {
        linha.current?.setAttribute("points", pontos.map((p) => `${p.x},${p.y}`).join(" "));
        const ponta = pontos[segmentos]!;
        pingente.current?.setAttribute("transform", `translate(${ponta.x} ${ponta.y}) rotate(${anguloDisco(novo)})`);
      },
    };
    corpo.current = novo;
    novo.desenhar();
    return registrar(novo);
  }, [parede, segmentos]);

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
    const ponta = c.pontos[c.pontos.length - 1]!;
    pega.current = { x: ponta.x - cursor.x, y: ponta.y - cursor.y };
    c.arrasto = { ...ponta };
    acordar();
  }

  function arrastar(evento: React.PointerEvent<SVGGElement>) {
    const c = corpo.current;
    // Só mexe enquanto está segurando; o cursor passando por cima não empurra.
    if (!c?.arrasto || !pega.current) return;
    // A física limita o alvo ao alcance da linha e à área fora do card.
    const cursor = cursorLocal(evento);
    c.arrasto = { x: cursor.x + pega.current.x, y: cursor.y + pega.current.y };
  }

  function soltar() {
    if (corpo.current) corpo.current.arrasto = null;
    pega.current = null;
  }

  return (
    <span ref={raiz} className={`z-20 size-0 select-none ${className}`} style={style} title={tema.nome}>
      <svg
        width="1"
        height="1"
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        role="img"
        aria-label={`Chaveiro: ${tema.nome}`}
      >
        <circle r="2.5" fill={tema.cor} />
        <polyline ref={linha} fill="none" stroke="var(--color-suave)" strokeWidth="1.2" strokeLinejoin="round" />
        <g
          ref={pingente}
          className="pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={segurar}
          onPointerMove={arrastar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <circle cy={RAIO} r={RAIO} fill="var(--color-painel)" stroke={tema.cor} strokeWidth="1.5" />
          {tema.texto ? (
            <text
              className="pointer-events-none select-none"
              aria-hidden
              y={RAIO + 4.5}
              textAnchor="middle"
              fill={tema.cor}
              fontFamily="var(--font-sans)"
              fontSize="13"
              fontWeight="800"
              style={{ fontStretch: "112%" }}
            >
              {tema.texto}
            </text>
          ) : (
            <path
              d={tema.icone}
              transform={`translate(0 ${RAIO})`}
              fill="none"
              stroke={tema.cor}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
          )}
        </g>
      </svg>
    </span>
  );
}

/**
 * Os chaveiros de um item, lado a lado embaixo do card: o que o item é e, se for o caso, o evento e
 * a qualidade. Trocar de item troca os chaveiros (e eles entram balançando). `direita` é a distância
 * da borda direita do card até o primeiro chaveiro, em CSS (ex.: "7rem" ou "30%").
 */
export function ChaveirosDoItem({
  item,
  parede,
  direita,
  className = "",
}: {
  item: { id: number; nome: string; tipo?: string | null } | undefined;
  parede?: RefObject<HTMLElement | null>;
  direita: string;
  className?: string;
}) {
  return (
    <>
      {temasDoItem(item).map((tema, i) => (
        <Chaveiro
          key={`${item?.id}-${tema.nome}`}
          tema={tema}
          // Comprimentos diferentes, para os círculos não ficarem todos alinhados.
          segmentos={[6, 8, 5][i]}
          parede={parede}
          className={`absolute top-full ${className}`}
          style={{ right: `calc(${direita} + ${i * ESPACAMENTO}px)` }}
        />
      ))}
    </>
  );
}
