import type { CSSProperties, ReactNode } from "react";

/**
 * Ícones dos botões redondos do header, cada um com uma animação pequena e constante que combina com o
 * que ele faz. Os ciclos têm durações diferentes para os botões não se mexerem todos juntos; com
 * "reduzir movimento" ligado no sistema, ficam parados (ver index.css).
 */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="icone-animado overflow-visible" aria-hidden>
      {children}
    </svg>
  );
}

/** TV com a antena balançando e o play pulsando na tela. */
export function IconeTv() {
  return (
    <Svg>
      <path className="tv-antena" d="M8 3l4 4 4-4" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path className="tv-play" d="M10.5 11v5.5l4.5-2.75z" fill="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

/** Balão de conversa com três pontinhos "digitando". */
export function IconeFaq() {
  return (
    <Svg>
      <path d="M20.5 11.5a8 8 0 0 1-11.9 7L4 19.6l1.2-4.3a8 8 0 1 1 15.3-3.8z" />
      {[8.6, 12.2, 15.8].map((x, i) => (
        <circle key={x} className="faq-ponto" cx={x} cy="11.6" r="1.05" fill="currentColor" stroke="none" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </Svg>
  );
}

// Cada canto com o desenho de "abrir" e de "recolher" e a direção em que se mexe (para fora).
const CANTOS = [
  { abrir: "M4 9V4h5", recolher: "M9 4v5H4", x: -1, y: -1 },
  { abrir: "M20 9V4h-5", recolher: "M15 4v5h5", x: 1, y: -1 },
  { abrir: "M4 15v5h5", recolher: "M9 20v-5H4", x: -1, y: 1 },
  { abrir: "M20 15v5h-5", recolher: "M15 20v-5h5", x: 1, y: 1 },
];

/** Quatro cantos que "respiram": abrem para fora (tela cheia) ou fecham para dentro (sair dela). */
export function IconeTelaCheia({ cheia }: { cheia: boolean }) {
  const sentido = cheia ? -1.6 : 1.6;
  return (
    <Svg>
      {CANTOS.map(({ abrir, recolher, x, y }) => (
        <path
          key={abrir}
          className="cheia-canto"
          d={cheia ? recolher : abrir}
          style={{ "--dx": `${x * sentido}px`, "--dy": `${y * sentido}px` } as CSSProperties}
        />
      ))}
    </Svg>
  );
}

/** Três linhas; a do meio e a de baixo encolhem e voltam, como uma lista se arrumando. */
export function IconeMenu() {
  return (
    <Svg>
      <path d="M5 7h14" />
      <path className="menu-linha" d="M5 12h14" />
      <path className="menu-linha" d="M5 17h14" style={{ animationDelay: "0.25s" }} />
    </Svg>
  );
}

/** Globo girando (o meridiano vai e volta, como se o planeta rodasse). */
export function IconeGlobo() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <ellipse className="globo-meridiano" cx="12" cy="12" rx="4" ry="9" />
    </Svg>
  );
}

/** Pessoa que acena com a cabeça. */
export function IconeConta() {
  return (
    <Svg>
      <circle className="conta-cabeca" cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
    </Svg>
  );
}
