import { t } from "../../lib/idioma";
import { type CSSProperties, type RefObject, useEffect, useRef } from "react";

import { EVENTO_PUXAR_CHAVEIRO } from "../mascote/eventos";
import { acordar, anguloDisco, type Corpo, registrar } from "./fisica";
import { nomeDoTema, type TemaChaveiro, temasDoItem } from "./temas";


// Tamanhos: o normal, pendurado embaixo de cards, e o mini, que cabe dentro de uma linha de tabela.
const TAMANHOS = {
  normal: { raio: 20, comprimento: 8, espacamento: 46, segmentos: [6, 8, 5, 7], balanco: 1.5 },
  mini: { raio: 9, comprimento: 5, espacamento: 22, segmentos: [2, 3, 2, 3], balanco: 1 },
} as const;
export type TamanhoChaveiro = keyof typeof TAMANHOS;

/**
 * Chaveiro pendurado embaixo de um card: uma linha com um círculo na ponta, com o ícone do tema.
 * Dá para segurar o círculo e arrastar; ao soltar, ele balança e volta. O card (`parede`) não deixa
 * a linha nem o círculo entrarem, e chaveiros que se encostam se empurram. Posicione o ponto de
 * fixação com `className`/`style`; o elemento não ocupa espaço.
 */
export function Chaveiro({
  tema,
  tamanho = "normal",
  segmentos = 6,
  parede,
  className = "",
  style,
}: {
  tema: TemaChaveiro;
  tamanho?: TamanhoChaveiro;
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
  const { raio: RAIO, comprimento: COMPRIMENTO_SEGMENTO, balanco } = TAMANHOS[tamanho];
  const escala = RAIO / TAMANHOS.normal.raio;

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
      // Balanço leve e constante, para os chaveiros nunca ficarem totalmente parados.
      balanco,
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
  }, [parede, segmentos, RAIO, COMPRIMENTO_SEGMENTO, balanco]);

  // O Muninn puxa este chaveiro no tutorial: um puxão curto para o lado e solta; ele volta com o embalo
  // e bate no vizinho, como se alguém tivesse puxado com o mouse.
  useEffect(() => {
    let quadro = 0;
    const puxar = (evento: Event) => {
      const alvo = (evento as CustomEvent<Element | null>).detail;
      const c = corpo.current;
      if (!c || !alvo || !raiz.current?.contains(alvo) || c.arrasto) return;
      const ponta = { ...c.pontos[c.pontos.length - 1]! };
      const inicio = performance.now();
      c.arrasto = { ...ponta };
      acordar();
      const passo = (agora: number) => {
        const k = Math.min(1, (agora - inicio) / 380);
        c.arrasto = { x: ponta.x + 34 * k * k, y: ponta.y - 12 * k };
        if (k < 1) quadro = requestAnimationFrame(passo);
        else c.arrasto = null;
      };
      quadro = requestAnimationFrame(passo);
    };
    window.addEventListener(EVENTO_PUXAR_CHAVEIRO, puxar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener(EVENTO_PUXAR_CHAVEIRO, puxar);
    };
  }, []);

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
    <span ref={raiz} className={`z-20 size-0 select-none ${className}`} style={style} title={nomeDoTema(tema.nome)}>
      <svg
        width="1"
        height="1"
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        role="img"
        data-chaveiro
        aria-label={`${t("Chaveiro", "Keychain")}: ${nomeDoTema(tema.nome)}`}
      >
        <circle r={2.5 * Math.max(escala, 0.6)} fill={tema.cor} />
        <polyline ref={linha} fill="none" stroke="var(--color-suave)" strokeWidth={tamanho === "mini" ? 1 : 1.2} strokeLinejoin="round" />
        <g
          ref={pingente}
          className="pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={segurar}
          onPointerMove={arrastar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <circle cy={RAIO} r={RAIO} fill="var(--color-painel)" stroke={tema.cor} strokeWidth={tamanho === "mini" ? 1.2 : 1.5} />
          {tema.texto ? (
            <text
              className="pointer-events-none select-none"
              aria-hidden
              y={RAIO + (tema.texto.length > 3 ? 3.5 : 4.5) * escala}
              textAnchor="middle"
              fill={tema.cor}
              fontFamily="var(--font-sans)"
              fontSize={(tema.texto.length > 3 ? 10 : 13) * escala}
              fontWeight="800"
              style={{ fontStretch: "112%" }}
            >
              {tema.texto}
            </text>
          ) : (
            <path
              d={tema.icone}
              transform={`translate(0 ${RAIO}) scale(${escala})`}
              fill="none"
              stroke={tema.cor}
              strokeWidth={1.6 / Math.max(escala, 0.6)}
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
 * Os chaveiros de um item, lado a lado embaixo do card: o do jogo, o que o item é e, se for o caso,
 * o evento e a qualidade. Trocar de item troca os chaveiros (e eles entram balançando). `direita` é a distância
 * da borda direita do card até o primeiro chaveiro, em CSS (ex.: "7rem" ou "30%").
 */
export function ChaveirosDoItem({
  item,
  parede,
  direita,
  tamanho = "normal",
  className = "",
}: {
  item: { id: number; appid: number; nome: string; tipo?: string | null } | undefined;
  parede?: RefObject<HTMLElement | null>;
  direita: string;
  tamanho?: TamanhoChaveiro;
  className?: string;
}) {
  const medidas = TAMANHOS[tamanho];
  return (
    <>
      {temasDoItem(item).map((tema, i) => (
        <Chaveiro
          key={`${item?.id}-${tema.nome}`}
          tema={tema}
          tamanho={tamanho}
          // Comprimentos diferentes, para os círculos não ficarem todos alinhados.
          segmentos={medidas.segmentos[i]}
          parede={parede}
          // O normal pende embaixo do card; o mini pende do topo para dentro da linha.
          className={`absolute ${tamanho === "mini" ? "top-0" : "top-full"} ${className}`}
          style={{ right: `calc(${direita} + ${i * medidas.espacamento}px)` }}
        />
      ))}
    </>
  );
}
