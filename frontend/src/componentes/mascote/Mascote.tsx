import { useEffect, useMemo, useRef, useState } from "react";

import { type ItemResumo, useItens } from "../../api/itens";
import { formatarVariacao } from "../../lib/formato";

// O Caixote: mascote do Skinomics. Anda pela base da tela, para de vez em quando, segue o cursor
// com os olhos e, quando clicado, pula e conta um dado real da base. Dá para escondê-lo; a escolha
// fica no navegador. Com "reduzir movimento" ligado ele fica parado num canto.

const LARGURA = 56;
const MARGEM = 16;
const VELOCIDADE = 42; // px/s
const CHAVE_OCULTO = "skinomics:mascote-oculto";
const VOLUME_MINIMO = 50;

const sortear = (min: number, max: number) => min + Math.random() * (max - min);

function lerOculto() {
  try {
    return localStorage.getItem(CHAVE_OCULTO) === "1";
  } catch {
    return false;
  }
}

function frases(itens: ItemResumo[]): string[] {
  const negociados = itens.filter((item) => item.variacao_7d != null && (item.volume_7d ?? 0) >= VOLUME_MINIMO);
  const porVariacao = [...negociados].sort((a, b) => b.variacao_7d! - a.variacao_7d!);
  const alta = porVariacao[0];
  const queda = porVariacao[porVariacao.length - 1];
  const lista = [
    "Eu sou o Caixote. Não, não tenho nada dentro.",
    "Clica de novo. Eu gosto de pular.",
  ];
  if (alta && alta.variacao_7d! > 0) lista.push(`Psst… ${alta.nome} subiu ${formatarVariacao(alta.variacao_7d!)} esta semana.`);
  if (queda && queda.variacao_7d! < 0) lista.push(`${queda.nome} caiu ${formatarVariacao(queda.variacao_7d!)} em 7 dias. Ai.`);
  if (itens.length) lista.push(`Eu confiro o preço de ${itens.length} itens todo dia. Sozinho.`);
  return lista;
}

export function Mascote() {
  const [oculto, setOculto] = useState(lerOculto);
  const [andando, setAndando] = useState(false);
  const [pulando, setPulando] = useState(false);
  const [fala, setFala] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const corpo = useRef<SVGGElement>(null);
  const pupilas = useRef<(SVGCircleElement | null)[]>([]);
  const estado = useRef({ x: MARGEM, direcao: 1, ateParar: sortear(3, 7), pausaAte: 0, falando: false });
  const { data } = useItens({ por_pagina: 100 });
  const repertorio = useMemo(() => frases(data?.itens ?? []), [data]);
  const ultimaFrase = useRef(-1);

  // Caminhada: um laço de animação que só mexe no estilo, sem renderizar o React a cada quadro.
  useEffect(() => {
    if (oculto) return;
    const s = estado.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raiz.current?.style.setProperty("transform", `translateX(${MARGEM}px)`);
      return;
    }
    let anterior = performance.now();
    let quadro = 0;
    let andandoAgora = false;
    const mudarAndando = (valor: boolean) => {
      if (valor !== andandoAgora) {
        andandoAgora = valor;
        setAndando(valor);
      }
    };
    const passo = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      const limite = window.innerWidth - LARGURA - MARGEM;
      if (s.falando || agora < s.pausaAte) {
        mudarAndando(false);
      } else {
        mudarAndando(true);
        s.x += s.direcao * VELOCIDADE * dt;
        s.ateParar -= dt;
        if (s.x <= MARGEM || s.x >= limite) {
          s.x = Math.min(Math.max(s.x, MARGEM), limite);
          s.direcao *= -1;
        }
        if (s.ateParar <= 0) {
          s.pausaAte = agora + sortear(1500, 4000);
          s.ateParar = sortear(3, 8);
          if (Math.random() < 0.4) s.direcao *= -1;
        }
      }
      raiz.current?.style.setProperty("transform", `translateX(${s.x}px)`);
      corpo.current?.setAttribute("transform", s.direcao < 0 ? "translate(56 0) scale(-1 1)" : "");
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [oculto]);

  // Olhos seguem o cursor.
  useEffect(() => {
    if (oculto) return;
    const olhar = (evento: PointerEvent) => {
      const caixa = raiz.current?.getBoundingClientRect();
      if (!caixa) return;
      const dx = evento.clientX - (caixa.left + LARGURA / 2);
      const dy = evento.clientY - (caixa.top + 30);
      const d = Math.hypot(dx, dy) || 1;
      // O corpo espelhado inverte o eixo x dos olhos.
      const ox = ((dx / d) * 2.4) * estado.current.direcao;
      const oy = (dy / d) * 2.4;
      pupilas.current.forEach((pupila) => pupila?.setAttribute("transform", `translate(${ox} ${oy})`));
    };
    window.addEventListener("pointermove", olhar);
    return () => window.removeEventListener("pointermove", olhar);
  }, [oculto]);

  useEffect(() => {
    if (!fala) return;
    estado.current.falando = true;
    const id = setTimeout(() => {
      setFala(null);
      estado.current.falando = false;
    }, 4500);
    return () => clearTimeout(id);
  }, [fala]);

  if (oculto) return null;

  function cutucar() {
    setPulando(false);
    requestAnimationFrame(() => setPulando(true));
    if (!repertorio.length) return;
    let indice = Math.floor(Math.random() * repertorio.length);
    if (indice === ultimaFrase.current) indice = (indice + 1) % repertorio.length;
    ultimaFrase.current = indice;
    setFala(repertorio[indice]!);
  }

  function esconder() {
    setOculto(true);
    try {
      localStorage.setItem(CHAVE_OCULTO, "1");
    } catch {
      // Sem armazenamento (aba anônima, por exemplo): fica escondido só nesta visita.
    }
  }

  return (
    <div ref={raiz} className="pointer-events-none fixed bottom-2 left-0 z-30 select-none" style={{ width: LARGURA }}>
      {fala && (
        <p
          role="status"
          className="pointer-events-auto absolute bottom-full left-1/2 mb-2 w-max max-w-56 -translate-x-1/2 rounded-xl border border-borda bg-painel px-3 py-2 text-xs text-texto shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          {fala}
        </p>
      )}
      <div className="group pointer-events-auto relative">
        <button
          type="button"
          onClick={esconder}
          aria-label="Esconder o mascote"
          className="absolute -top-1 -right-2 z-10 grid size-5 place-items-center rounded-full border border-borda bg-painel text-[11px] text-suave opacity-0 transition-opacity group-hover:opacity-100 hover:text-texto focus:opacity-100"
        >
          ×
        </button>
        <button
          type="button"
          onClick={cutucar}
          onAnimationEnd={() => setPulando(false)}
          aria-label="Caixote, o mascote do Skinomics"
          title="Caixote"
          className={`block cursor-pointer ${pulando ? "animate-pulo" : ""}`}
        >
          <svg width={LARGURA} height="64" viewBox="0 0 56 64" aria-hidden>
            <ellipse cx="28" cy="61" rx="15" ry="2.5" fill="#000" fillOpacity="0.5" />
            <g ref={corpo}>
              {/* Pernas */}
              {[21, 35].map((x, i) => (
                <line
                  key={x}
                  x1={x}
                  y1="46"
                  x2={x}
                  y2="58"
                  stroke="var(--color-destaque)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className={andando ? "animate-passo" : ""}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "top center",
                    animationDirection: i === 0 ? "alternate" : "alternate-reverse",
                  }}
                />
              ))}
              <g className={andando ? "animate-gingado" : ""}>
                {/* Caixa e tampa */}
                <rect x="6" y="18" width="44" height="30" rx="6" fill="#0f120f" stroke="var(--color-destaque)" strokeWidth="2" />
                <line x1="18" y1="20" x2="18" y2="46" stroke="var(--color-destaque)" strokeOpacity="0.2" strokeWidth="1.5" />
                <line x1="38" y1="20" x2="38" y2="46" stroke="var(--color-destaque)" strokeOpacity="0.2" strokeWidth="1.5" />
                <rect x="3" y="10" width="50" height="10" rx="4" fill="#141914" stroke="var(--color-destaque)" strokeWidth="2" />
                {/* Olhos */}
                <g className="animate-piscar" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                  {[21, 35].map((x, i) => (
                    <g key={x}>
                      <circle cx={x} cy="31" r="6" fill="#e9ece7" />
                      <circle
                        ref={(el) => {
                          pupilas.current[i] = el;
                        }}
                        cx={x}
                        cy="31"
                        r="2.7"
                        fill="#000"
                      />
                    </g>
                  ))}
                </g>
                {/* Boca */}
                <path d="M25 40.5q3 2.6 6 0" fill="none" stroke="var(--color-destaque)" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}
