import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";

import { type Passo, TUTORIAIS } from "./passos";

type Caixa = { x: number; y: number; w: number; h: number };

const FOLGA = 8;
const MARGEM = 16;

/** Área (na tela) que cobre todos os elementos visíveis do seletor. */
function caixaDo(seletor: string): Caixa | null {
  const caixas = [...document.querySelectorAll(seletor)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  if (!caixas.length) return null;
  const x = Math.min(...caixas.map((r) => r.left));
  const y = Math.min(...caixas.map((r) => r.top));
  const w = Math.max(...caixas.map((r) => r.right)) - x;
  const h = Math.max(...caixas.map((r) => r.bottom)) - y;
  return { x: x - FOLGA, y: y - FOLGA, w: w + FOLGA * 2, h: h + FOLGA * 2 };
}

/** Rola a página até o alvo ficar abaixo do header, com espaço para o balão de explicação. */
function rolarAte(seletor: string) {
  const el = document.querySelector(seletor);
  if (!el || el.closest("header")) return;
  const r = el.getBoundingClientRect();
  const topoLivre = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const alturaLivre = window.innerHeight - topoLivre;
  const sobra = alturaLivre - r.height - 220;
  const destino = window.scrollY + r.top - topoLivre - Math.max(24, sobra / 2);
  window.scrollTo({ top: Math.max(0, destino), behavior: "smooth" });
}

/** Botão redondo "Como usar": uma bolinha com um ponto de interrogação que de tempos em tempos pula e gira. */
export function BotaoComoUsar() {
  const { pathname } = useLocation();
  const passos = TUTORIAIS[pathname];
  const [aberto, setAberto] = useState(false);
  if (!passos) return null;

  return (
    <>
      <button
        type="button"
        data-tour="como-usar"
        onClick={() => setAberto(true)}
        aria-label="Como usar esta página"
        title="Como usar"
        className="group/ajuda grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-borda bg-painel/60 transition-colors duration-300 hover:border-destaque/60"
      >
        <span className="grid size-6 place-items-center rounded-full bg-destaque text-[15px] leading-none font-extrabold text-fundo motion-safe:animate-[interrogacao_5s_ease-in-out_infinite] group-hover/ajuda:[animation-duration:1.4s]">
          ?
        </span>
      </button>
      {aberto && <Tutorial passos={passos} aoFechar={() => setAberto(false)} />}
    </>
  );
}

/**
 * Passeio guiado: escurece a página, deixa clara só a parte explicada (que continua interativa) e mostra
 * um balão com o que ela faz. O destaque acompanha o alvo a cada quadro, porque há coisas que se mexem
 * (o corvo, os chaveiros) e a página pode rolar.
 */
function Tutorial({ passos, aoFechar }: { passos: Passo[]; aoFechar: () => void }) {
  const [indice, setIndice] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [alturaBalao, setAlturaBalao] = useState(180);
  const balao = useRef<HTMLDivElement>(null);
  const passo = passos[indice]!;
  const ultimo = indice === passos.length - 1;

  const avancar = () => (ultimo ? aoFechar() : setIndice(indice + 1));
  const voltar = () => indice > 0 && setIndice(indice - 1);

  const mostrada = useRef<Caixa | null>(null);
  useEffect(() => {
    rolarAte(passo.alvo);
  }, [passo.alvo]);

  // O destaque desliza até o novo alvo logo após trocar de passo e depois cola nele.
  useEffect(() => {
    let quadro = 0;
    const inicio = performance.now();
    let atual = mostrada.current;
    const seguir = () => {
      const alvo = caixaDo(passo.alvo);
      if (alvo) {
        const deslizando = performance.now() - inicio < 600 && atual;
        const k = deslizando ? 0.25 : 1;
        atual = atual
          ? {
              x: atual.x + (alvo.x - atual.x) * k,
              y: atual.y + (alvo.y - atual.y) * k,
              w: atual.w + (alvo.w - atual.w) * k,
              h: atual.h + (alvo.h - atual.h) * k,
            }
          : alvo;
        mostrada.current = atual;
        setCaixa((antes) =>
          antes &&
          Math.abs(antes.x - atual!.x) < 0.5 &&
          Math.abs(antes.y - atual!.y) < 0.5 &&
          Math.abs(antes.w - atual!.w) < 0.5 &&
          Math.abs(antes.h - atual!.h) < 0.5
            ? antes
            : atual,
        );
      }
      quadro = requestAnimationFrame(seguir);
    };
    quadro = requestAnimationFrame(seguir);
    return () => cancelAnimationFrame(quadro);
  }, [passo.alvo]);

  useLayoutEffect(() => {
    if (balao.current) setAlturaBalao(balao.current.offsetHeight);
  }, [indice]);

  useEffect(() => {
    const teclas = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") aoFechar();
      else if (evento.key === "ArrowRight" || evento.key === "Enter") avancar();
      else if (evento.key === "ArrowLeft") voltar();
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  });

  // Balão abaixo do alvo; se não couber, acima; se nenhum couber (alvo alto), no rodapé da tela.
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const larguraBalao = Math.min(360, vw - MARGEM * 2);
  let balaoX = MARGEM;
  let balaoY = vh - alturaBalao - MARGEM;
  if (caixa) {
    balaoX = Math.min(Math.max(caixa.x, MARGEM), vw - larguraBalao - MARGEM);
    if (caixa.y + caixa.h + 12 + alturaBalao < vh - MARGEM) balaoY = caixa.y + caixa.h + 12;
    else if (caixa.y - 12 - alturaBalao > MARGEM) balaoY = caixa.y - 12 - alturaBalao;
    else balaoX = vw - larguraBalao - MARGEM;
  }

  // Quatro faixas transparentes em volta do buraco bloqueiam cliques no resto da página.
  const c = caixa ?? { x: vw / 2, y: vh / 2, w: 0, h: 0 };
  const bloqueio = "fixed bg-transparent";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Como usar" className="fixed inset-0 z-[100] transition-opacity duration-300 starting:opacity-0">
      <div className={bloqueio} style={{ left: 0, top: 0, width: vw, height: Math.max(0, c.y) }} />
      <div className={bloqueio} style={{ left: 0, top: c.y + c.h, width: vw, bottom: 0 }} />
      <div className={bloqueio} style={{ left: 0, top: c.y, width: Math.max(0, c.x), height: c.h }} />
      <div className={bloqueio} style={{ left: c.x + c.w, top: c.y, right: 0, height: c.h }} />

      {/* O buraco: a sombra gigante escurece tudo em volta, e ele deixa a parte explicada clara. */}
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-2xl shadow-[0_0_0_200vmax_rgba(0,0,0,0.78)] ring-2 ring-destaque/70"
        style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
      />

      <div
        ref={balao}
        key={indice}
        aria-live="polite"
        className="fixed space-y-3 rounded-2xl border border-destaque/30 bg-painel p-5 shadow-[0_16px_48px_rgba(0,0,0,0.8)] transition-[opacity,translate] duration-300 starting:translate-y-1 starting:opacity-0"
        style={{ left: balaoX, top: balaoY, width: larguraBalao }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{passo.titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar o tutorial"
            className="-mt-1 -mr-1 grid size-7 cursor-pointer place-items-center rounded-full text-apagado transition-colors hover:bg-painel-alto hover:text-texto"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <p className="text-sm leading-relaxed text-suave">{passo.texto}</p>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex gap-1.5" aria-label={`Passo ${indice + 1} de ${passos.length}`}>
            {passos.map((p, i) => (
              <button
                key={p.alvo}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ir para: ${p.titulo}`}
                className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
                  i === indice ? "w-5 bg-destaque" : "w-1.5 bg-borda hover:bg-suave"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {indice > 0 && (
              <button
                type="button"
                onClick={voltar}
                className="cursor-pointer rounded-lg border border-borda px-3 py-1.5 text-sm text-suave transition-colors hover:border-suave hover:text-texto"
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={avancar}
              className="cursor-pointer rounded-lg bg-destaque px-3 py-1.5 text-sm font-semibold text-fundo transition hover:brightness-110 active:scale-95"
            >
              {ultimo ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
