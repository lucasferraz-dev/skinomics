import { useEffect, useMemo, useRef, useState } from "react";

import { type ItemResumo, useItens } from "../../api/itens";
import { formatarVariacao } from "../../lib/formato";
import { coletarPoleiros, type Poleiro, visivel } from "./poleiros";

// O corvo do Skinomics. Pousa no topo dos cards e das letras dos títulos (elementos com
// `data-poleiro`), anda aos pulinhos por eles e salta em arco para o próximo. Se o poleiro sai da
// tela com a rolagem, voa até um visível. Clicado, mostra um dado real da base. Dá para escondê-lo;
// com "reduzir movimento" fica pousado, parado. Precisa de um pai com `position: relative`.

const LARGURA = 58;
const ALTURA = 53;
const PASSO = 38; // px/s andando
const CHAVE_OCULTO = "skinomics:mascote-oculto";
const VOLUME_MINIMO = 50;

type Modo = "parado" | "andando" | "pulando" | "voando";
type Salto = { x0: number; y0: number; x1: number; y1: number; inicio: number; duracao: number; arco: number };

const sortear = (min: number, max: number) => min + Math.random() * (max - min);

function lerOculto() {
  try {
    return localStorage.getItem(CHAVE_OCULTO) === "1";
  } catch {
    return false;
  }
}

function boletim(itens: ItemResumo[]): string[] {
  const negociados = itens.filter((item) => item.variacao_7d != null && (item.volume_7d ?? 0) >= VOLUME_MINIMO);
  const ordem = [...negociados].sort((a, b) => b.variacao_7d! - a.variacao_7d!);
  const alta = ordem[0];
  const queda = ordem[ordem.length - 1];
  const linhas: string[] = [];
  if (alta && alta.variacao_7d! > 0) linhas.push(`Maior alta em 7 dias: ${alta.nome}, ${formatarVariacao(alta.variacao_7d!)}.`);
  if (queda && queda.variacao_7d! < 0) linhas.push(`Maior queda em 7 dias: ${queda.nome}, ${formatarVariacao(queda.variacao_7d!)}.`);
  const maisNegociado = [...negociados].sort((a, b) => (b.volume_7d ?? 0) - (a.volume_7d ?? 0))[0];
  if (maisNegociado) linhas.push(`Mais negociado da semana: ${maisNegociado.nome}.`);
  if (itens.length) linhas.push(`${itens.length} itens sob observação.`);
  return linhas;
}

export function Mascote() {
  const [oculto, setOculto] = useState(lerOculto);
  const [modo, setModo] = useState<Modo>("parado");
  const [direcao, setDirecao] = useState(1);
  const [fala, setFala] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const falando = useRef(false);
  const { data } = useItens({ por_pagina: 100 });
  const linhas = useMemo(() => boletim(data?.itens ?? []), [data]);
  const ultimaLinha = useRef(-1);

  useEffect(() => {
    if (oculto) return;
    const el = raiz.current;
    const pai = el?.parentElement;
    if (!el || !pai) return;
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let poleiros: Poleiro[] = [];
    let atualizadoEm = 0;
    let atual: Poleiro | null = null;
    let x = 0;
    let y = 0;
    let alvoX = 0;
    let ate = 0;
    let invisivelDesde = 0;
    let salto: Salto | null = null;
    let destino: Poleiro | null = null;
    let modoAgora: Modo = "parado";
    let direcaoAgora = 1;
    let anterior = performance.now();
    let quadro = 0;

    const mudarModo = (novo: Modo) => {
      if (novo !== modoAgora) {
        modoAgora = novo;
        setModo(novo);
      }
    };
    const olharPara = (dx: number) => {
      const nova = dx < 0 ? -1 : 1;
      if (dx !== 0 && nova !== direcaoAgora) {
        direcaoAgora = nova;
        setDirecao(nova);
      }
    };
    const desenhar = (bob = 0) => {
      el.style.transform = `translate(${x - LARGURA / 2}px, ${y - ALTURA + bob}px)`;
      el.style.opacity = atual || salto ? "1" : "0";
    };
    const atualizarPoleiros = (agora: number) => {
      poleiros = coletarPoleiros(pai.getBoundingClientRect());
      atualizadoEm = agora;
      if (atual) {
        // O layout muda (imagens carregando, redimensionamento): acompanha o poleiro onde está.
        const mesmo = poleiros.find((p) => p.chave === atual!.chave);
        if (mesmo) {
          atual = mesmo;
          y = mesmo.y;
          x = Math.min(Math.max(x, mesmo.x0), mesmo.x1);
        } else {
          atual = null;
        }
      }
    };
    const saltarPara = (p: Poleiro, agora: number, voando: boolean, ref?: DOMRect) => {
      if (voando && ref) {
        // Vindo de longe (o poleiro saiu da tela): entra pela borda da tela, sem atravessar a página.
        const topoTela = -ref.top + 60;
        const baseTela = -ref.top + window.innerHeight + 40;
        y = Math.min(Math.max(y, topoTela), baseTela);
      }
      const x1 = sortear(p.x0, p.x1);
      const distancia = Math.hypot(x1 - x, p.y - y);
      salto = {
        x0: x,
        y0: y,
        x1,
        y1: p.y,
        inicio: agora,
        duracao: voando ? Math.min(600 + distancia * 1.1, 1400) : 380 + distancia * 0.9,
        arco: voando ? 70 + distancia * 0.15 : 28 + Math.max(0, y - p.y) * 0.35,
      };
      destino = p;
      atual = null;
      olharPara(x1 - x);
      mudarModo(voando ? "voando" : "pulando");
    };
    const decidir = (agora: number, ref: DOMRect) => {
      if (!atual) return;
      const largura = atual.x1 - atual.x0;
      if (largura > 80 && Math.random() < 0.5) {
        alvoX = sortear(atual.x0, atual.x1);
        olharPara(alvoX - x);
        mudarModo("andando");
        return;
      }
      const vizinhos = poleiros
        .filter((p) => p.chave !== atual!.chave && visivel(p, ref))
        .map((p) => ({ p, d: Math.hypot((p.x0 + p.x1) / 2 - x, p.y - y) }))
        .filter(({ d }) => d < 650)
        .sort((a, b) => a.d - b.d)
        .slice(0, 4);
      const escolhido = vizinhos[Math.floor(Math.random() * vizinhos.length)];
      if (escolhido) {
        saltarPara(escolhido.p, agora, false);
      } else {
        ate = agora + sortear(1500, 3000);
      }
    };

    const passo = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      const ref = pai.getBoundingClientRect();
      if (agora - atualizadoEm > 1200) atualizarPoleiros(agora);

      // Primeiro pouso: no título principal, se estiver na tela; senão em qualquer poleiro visível.
      if (!atual && !salto) {
        const inicial = poleiros.find((p) => visivel(p, ref));
        if (inicial) {
          atual = inicial;
          x = sortear(inicial.x0, Math.min(inicial.x1, inicial.x0 + 200));
          y = inicial.y;
          ate = agora + sortear(1200, 2500);
        }
      }

      let bob = 0;
      if (salto) {
        const t = Math.min((agora - salto.inicio) / salto.duracao, 1);
        x = salto.x0 + (salto.x1 - salto.x0) * t;
        y = salto.y0 + (salto.y1 - salto.y0) * t - salto.arco * 4 * t * (1 - t);
        if (t >= 1) {
          atual = destino;
          salto = null;
          mudarModo("parado");
          ate = agora + sortear(700, 2500);
        }
      } else if (atual && !calmo) {
        if (!visivel(atual, ref)) {
          // O poleiro saiu da tela: depois de um instante, voa para um visível.
          invisivelDesde ||= agora;
          if (agora - invisivelDesde > 600) {
            const opcoes = poleiros.filter((p) => visivel(p, ref));
            const alvo = opcoes[Math.floor(Math.random() * opcoes.length)];
            if (alvo) saltarPara(alvo, agora, true, ref);
            invisivelDesde = 0;
          }
        } else {
          invisivelDesde = 0;
          if (modoAgora === "andando") {
            const dx = alvoX - x;
            x += Math.sign(dx) * Math.min(Math.abs(dx), PASSO * dt);
            bob = -Math.abs(Math.sin(agora / 70)) * 2.5; // pulinhos curtos, como um corvo andando
            if (Math.abs(dx) < 1) {
              mudarModo("parado");
              ate = agora + sortear(800, 2500);
            }
          } else if (agora > ate && !falando.current) {
            decidir(agora, ref);
          }
        }
      }

      desenhar(bob);
      quadro = requestAnimationFrame(passo);
    };

    const aoRedimensionar = () => (atualizadoEm = 0);
    window.addEventListener("resize", aoRedimensionar);
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [oculto]);

  useEffect(() => {
    if (!fala) return;
    falando.current = true;
    const id = setTimeout(() => {
      setFala(null);
      falando.current = false;
    }, 5000);
    return () => clearTimeout(id);
  }, [fala]);

  if (oculto) return null;

  function grasnar() {
    if (!linhas.length) return;
    let indice = Math.floor(Math.random() * linhas.length);
    if (indice === ultimaLinha.current) indice = (indice + 1) % linhas.length;
    ultimaLinha.current = indice;
    setFala(linhas[indice]!);
  }

  function esconder() {
    setOculto(true);
    try {
      localStorage.setItem(CHAVE_OCULTO, "1");
    } catch {
      // Sem armazenamento (aba anônima, por exemplo): fica escondido só nesta visita.
    }
  }

  const asasAbertas = modo === "voando" || modo === "pulando";

  return (
    <div
      ref={raiz}
      className="pointer-events-none absolute top-0 left-0 z-30 opacity-0 transition-opacity duration-300 select-none"
      style={{ width: LARGURA, height: ALTURA }}
    >
      {fala && (
        <p
          role="status"
          className="absolute bottom-full left-1/2 mb-1 w-max max-w-64 -translate-x-1/2 rounded-lg border border-borda bg-painel px-3 py-2 font-mono text-[11px] leading-snug text-texto shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
        >
          {fala}
        </p>
      )}
      <div className="group pointer-events-auto relative size-full">
        <button
          type="button"
          onClick={esconder}
          aria-label="Esconder o corvo"
          className="absolute -top-3 -right-3 z-10 grid size-5 place-items-center rounded-full border border-borda bg-painel text-[11px] text-suave opacity-0 transition-opacity group-hover:opacity-100 hover:text-texto focus:opacity-100"
        >
          ×
        </button>
        <button type="button" onClick={grasnar} aria-label="Corvo do Skinomics" className="block size-full cursor-pointer">
          <svg viewBox="0 0 48 44" className="size-full overflow-visible" aria-hidden>
            <g transform={direcao < 0 ? "translate(48 0) scale(-1 1)" : undefined}>
              {/* Pernas */}
              <g stroke="#4b524c" strokeWidth="1.5" strokeLinecap="round" fill="none">
                <path d="M23 34 22 43m-3 0h5.5" />
                <path d="M28 34 29 43m-3 0h5.5" />
              </g>
              {/* Cauda em cunha */}
              <path
                d="M15 27 1 32.5 2.5 36 17 31.5Z"
                fill="#0b0c0b"
                stroke="var(--color-destaque)"
                strokeOpacity="0.4"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              {/* Corpo e cabeça, angulosos, com as penas eriçadas da garganta */}
              <path
                d="M13 30 17 21 26 16.5 33 16 35.5 10 40 6.5 44.5 7.5 46 11 43 14.5 41.4 16.6 43 17 41.2 19.6 40 25 34 31 26 35 18 34.5Z"
                fill="#0b0c0b"
                stroke="var(--color-destaque)"
                strokeOpacity="0.55"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              {/* Bico grosso */}
              <path d="M44.2 7.6C47.2 7.9 50 9.4 51.8 11.6L45.2 13.6Z" fill="#2d322e" stroke="#0b0c0b" strokeWidth="0.4" />
              <path d="M45.2 11.3 50.6 11.5" stroke="#0b0c0b" strokeWidth="0.4" />
              {/* Olho */}
              <circle cx="41.4" cy="9.9" r="1" fill="var(--color-destaque)" />
              {/* Asa: fechada pousado, erguida no salto, batendo no voo */}
              <g
                className={modo === "voando" ? "animate-bater-asas" : ""}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "80% 15%",
                  transform: asasAbertas && modo !== "voando" ? "rotate(-35deg)" : undefined,
                  transition: "transform 120ms",
                }}
              >
                <path
                  d="M17 26 25 19.5 37 19.5 33 26.5 22 30Z"
                  fill="#141714"
                  stroke="var(--color-destaque)"
                  strokeOpacity="0.45"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
                <path d="M22 28.5 29 22.5M26.5 28 33 22" stroke="var(--color-destaque)" strokeOpacity="0.25" strokeWidth="0.5" />
              </g>
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}
