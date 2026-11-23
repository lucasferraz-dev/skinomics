import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconeTv } from "../IconesAnimados";

/**
 * Modo TV: passa sozinho pelas seções da página marcadas com `data-tv="Nome"` (em `main`), na ordem em
 * que aparecem. Seção que cabe na tela fica parada um tempo; seção mais alta que a tela para no topo,
 * desce devagar até o fim e para de novo. Depois da última, volta para a primeira.
 */

const IDA_MS = 1400;
const PARADA_CURTA_MS = 9000;
const PARADA_TOPO_MS = 3000;
const PARADA_FIM_MS = 4000;
const VELOCIDADE = 55; // px/s na descida
const OCIOSO_MS = 3000;

type Fase = "indo" | "topo" | "descendo" | "fim";
type Estacao = { el: HTMLElement; nome: string };

export const classeBotaoRedondo =
  "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-borda bg-painel/60 text-suave transition-colors duration-300 hover:border-destaque/60 hover:text-texto";

export const icone = (d: string, tamanho = 18) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

function lerEstacoes(): Estacao[] {
  return [...document.querySelectorAll<HTMLElement>("main [data-tv]")].map((el) => ({ el, nome: el.dataset.tv ?? "" }));
}

function topoLivre() {
  return document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
}

function maximoRolagem() {
  return document.documentElement.scrollHeight - window.innerHeight;
}

/** Rolagem em que o topo da seção fica logo abaixo do header. */
function inicioDe(el: HTMLElement) {
  return Math.min(maximoRolagem(), Math.max(0, window.scrollY + el.getBoundingClientRect().top - topoLivre()));
}

/** Rolagem em que o fim da seção encosta no pé da tela. */
function fimDe(el: HTMLElement) {
  const fundo = window.scrollY + el.getBoundingClientRect().bottom - window.innerHeight;
  return Math.min(maximoRolagem(), Math.max(inicioDe(el), fundo));
}

const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function BotaoModoTv() {
  const [ligado, setLigado] = useState(false);
  // Estável: o laço do modo TV depende dela e recomeçaria do início se mudasse a cada render.
  const sair = useCallback(() => {
    setLigado(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // O modo TV é em tela cheia: entra nela ao ligar (precisa ser no clique) e, se a pessoa sair da tela
  // cheia (Esc ou F11, que o navegador trata antes da página), o modo TV acaba junto.
  const ligar = () => {
    setLigado(true);
    document.documentElement.requestFullscreen?.().catch(() => {
      /* navegador sem tela cheia ou recusou: segue em janela */
    });
  };
  useEffect(() => {
    if (!ligado) return;
    const aoMudar = () => {
      if (!document.fullscreenElement) setLigado(false);
    };
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, [ligado]);

  return (
    <>
      <button
        type="button"
        data-tour="modo-tv"
        onClick={ligar}
        aria-label="Modo TV"
        title="Modo TV"
        className={`hidden sm:grid ${classeBotaoRedondo}`}
      >
        <IconeTv />
      </button>
      {ligado && <ModoTv aoSair={sair} />}
    </>
  );
}

function ModoTv({ aoSair }: { aoSair: () => void }) {
  const [estacoes] = useState(lerEstacoes);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [ocioso, setOcioso] = useState(false);
  const barra = useRef<HTMLSpanElement>(null);
  const pausadoRef = useRef(false);
  pausadoRef.current = pausado;

  const estado = useRef({ indice: 0, fase: "indo" as Fase, decorrido: 0, de: 0, para: 0, posicao: 0, parada: 0, naEstacao: 0, total: 1 });

  const irPara = useCallback(
    (i: number) => {
      if (!estacoes.length) return;
      const m = estado.current;
      m.indice = (i + estacoes.length) % estacoes.length;
      m.fase = "indo";
      m.decorrido = 0;
      m.naEstacao = 0;
      m.de = window.scrollY;
      m.para = inicioDe(estacoes[m.indice]!.el);
      m.total = IDA_MS + PARADA_CURTA_MS;
      setIndice(m.indice);
    },
    [estacoes],
  );

  // Laço de animação: só o tempo sem pausa conta.
  useEffect(() => {
    if (!estacoes.length) {
      aoSair();
      return;
    }
    irPara(0);
    let quadro = 0;
    let antes = performance.now();
    const passo = (agora: number) => {
      const dt = Math.min(100, agora - antes);
      antes = agora;
      const m = estado.current;
      const el = estacoes[m.indice]!.el;
      if (!pausadoRef.current) {
        m.decorrido += dt;
        m.naEstacao += dt;
        if (m.fase === "indo") {
          const t = Math.min(1, m.decorrido / IDA_MS);
          window.scrollTo(0, m.de + (m.para - m.de) * suave(t));
          if (t >= 1) {
            const descida = fimDe(el) - window.scrollY;
            m.decorrido = 0;
            m.posicao = window.scrollY;
            if (descida > 24) {
              m.fase = "topo";
              m.total = IDA_MS + PARADA_TOPO_MS + (descida / VELOCIDADE) * 1000 + PARADA_FIM_MS;
            } else {
              m.fase = "fim";
              m.parada = PARADA_CURTA_MS;
              m.total = IDA_MS + PARADA_CURTA_MS;
            }
          }
        } else if (m.fase === "topo") {
          if (m.decorrido >= PARADA_TOPO_MS) {
            m.fase = "descendo";
            m.decorrido = 0;
            m.posicao = window.scrollY;
          }
        } else if (m.fase === "descendo") {
          // Posição própria em ponto flutuante: a rolagem do navegador arredonda e travaria a 1 px/quadro.
          m.posicao += (VELOCIDADE * dt) / 1000;
          const fim = fimDe(el);
          window.scrollTo(0, Math.min(m.posicao, fim));
          if (m.posicao >= fim) {
            m.fase = "fim";
            m.parada = PARADA_FIM_MS;
            m.decorrido = 0;
          }
        } else if (m.decorrido >= m.parada) {
          irPara(m.indice + 1);
        }
      }
      if (barra.current) barra.current.style.width = `${Math.min(100, (m.naEstacao / m.total) * 100)}%`;
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [estacoes, irPara, aoSair]);

  // Mouse parado por 3 s: some o cursor e a barra de controle; mexeu, voltam.
  useEffect(() => {
    let espera = 0;
    const acordar = () => {
      setOcioso(false);
      window.clearTimeout(espera);
      espera = window.setTimeout(() => setOcioso(true), OCIOSO_MS);
    };
    acordar();
    window.addEventListener("pointermove", acordar);
    window.addEventListener("pointerdown", acordar);
    return () => {
      window.clearTimeout(espera);
      window.removeEventListener("pointermove", acordar);
      window.removeEventListener("pointerdown", acordar);
    };
  }, []);

  useEffect(() => {
    const raiz = document.documentElement;
    if (ocioso) raiz.dataset.tvOcioso = "";
    else delete raiz.dataset.tvOcioso;
    return () => {
      delete raiz.dataset.tvOcioso;
    };
  }, [ocioso]);

  // Teclado (espaço pausa, setas trocam, Esc sai) e rolagem manual pausa.
  useEffect(() => {
    const teclas = (evento: KeyboardEvent) => {
      if (evento.key === " ") {
        evento.preventDefault();
        setPausado((p) => !p);
      } else if (evento.key === "ArrowRight") irPara(estado.current.indice + 1);
      else if (evento.key === "ArrowLeft") irPara(estado.current.indice - 1);
      else if (evento.key === "Escape") aoSair();
    };
    const rolouNaMao = () => setPausado(true);
    window.addEventListener("keydown", teclas);
    window.addEventListener("wheel", rolouNaMao, { passive: true });
    window.addEventListener("touchmove", rolouNaMao, { passive: true });
    return () => {
      window.removeEventListener("keydown", teclas);
      window.removeEventListener("wheel", rolouNaMao);
      window.removeEventListener("touchmove", rolouNaMao);
    };
  }, [irPara, aoSair]);

  const estacao = estacoes[indice];
  if (!estacao) return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label="Controles do modo TV"
      className={`fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 transition-[opacity,translate] duration-500 starting:translate-y-4 starting:opacity-0 ${
        ocioso ? "pointer-events-none translate-y-2 opacity-0" : ""
      }`}
    >
      <div className="relative flex items-center gap-1 overflow-hidden rounded-full border border-borda bg-painel/90 py-1.5 pr-1.5 pl-5 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur">
        <span className="mr-3 flex items-center gap-2.5 text-sm whitespace-nowrap">
          <span className={`size-2 rounded-full ${pausado ? "bg-apagado" : "bg-destaque motion-safe:animate-pulse"}`} aria-hidden />
          {estacao.nome}
          <span className="font-mono text-xs text-apagado">
            {indice + 1}/{estacoes.length}
          </span>
        </span>
        <Controle rotulo="Anterior" aoClicar={() => irPara(indice - 1)}>
          {icone("M15 6l-6 6 6 6", 16)}
        </Controle>
        <Controle rotulo={pausado ? "Continuar" : "Pausar"} aoClicar={() => setPausado(!pausado)} destaque>
          {pausado ? icone("M8 5v14l11-7z", 16) : icone("M8 5v14M16 5v14", 16)}
        </Controle>
        <Controle rotulo="Próximo" aoClicar={() => irPara(indice + 1)}>
          {icone("M9 6l6 6-6 6", 16)}
        </Controle>
        <span className="mx-1 h-5 w-px bg-borda" aria-hidden />
        <Controle rotulo="Sair do modo TV" aoClicar={aoSair}>
          {icone("M6 6l12 12M18 6 6 18", 15)}
        </Controle>
        {/* Quanto falta para a próxima seção */}
        <span ref={barra} aria-hidden className="absolute bottom-0 left-0 h-0.5 bg-destaque/70" />
      </div>
    </div>,
    document.body,
  );
}

function Controle({ rotulo, aoClicar, destaque = false, children }: { rotulo: string; aoClicar: () => void; destaque?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className={`grid size-9 cursor-pointer place-items-center rounded-full transition active:scale-90 ${
        destaque ? "bg-destaque text-fundo hover:brightness-110" : "text-suave hover:bg-painel-alto hover:text-texto"
      }`}
    >
      {children}
    </button>
  );
}
