import { type ReactNode, useEffect, useRef, useState } from "react";

import { t, useIdioma } from "../../lib/idioma";
import type { Falas, FalasDaPagina } from "./analise";
import { poseCorujaParada } from "./coruja";
import { dicaAleatoria, falaDaCoruja } from "./conversa";
import { grasnar, poseParada } from "./corvo";
import { aplicarPose, CorvoSvg, usePartes } from "./desenho";
import { aplicarCoruja, CorujaSvg, usePartesCoruja } from "./desenhoCoruja";
import { EVENTO_TUTORIAL, type PassoTutorial } from "./eventos";

type Especie = "corvo" | "coruja";
type Balao = { texto: string; fixo: boolean } | null;

const ESCALA = { corvo: 0.62, coruja: 0.58 } as const;
const DURACAO_GRASNADO = 900; // ms
const ESPERA_ABERTURA = { corvo: 1500, coruja: 3800 } as const; // a coruja fala depois, como na landing

/**
 * Muninn e Glaux de plantão no canto da tela, fora da landing: sentados num poleiro fixo, sem voar pela
 * página. Respiram, piscam e acompanham o cursor com a cabeça; comentam a página (`falas`, ver
 * analise.ts) quando os dados chegam e quando alguém clica neles, e apresentam o "Como usar" dali mesmo.
 */
export function MascotesFixos({ falas }: { falas: FalasDaPagina }) {
  useIdioma();
  const [baloes, setBaloes] = useState<Record<Especie, Balao>>({ corvo: null, coruja: null });
  const [guiando, setGuiando] = useState(false);
  const partesCorvo = usePartes();
  const partesCoruja = usePartesCoruja();
  const raiz = useRef<HTMLDivElement>(null);
  const falouEm = useRef<Record<Especie, number>>({ corvo: -Infinity, coruja: -Infinity });
  const ultima = useRef<Record<Especie, number>>({ corvo: -1, coruja: -1 });

  function dizer(especie: Especie, texto: string, fixo = false) {
    falouEm.current[especie] = performance.now();
    setBaloes((antes) => ({ ...antes, [especie]: { texto, fixo } }));
  }
  const calar = (especie: Especie) => setBaloes((antes) => ({ ...antes, [especie]: null }));

  // Fala sobre a página, sem repetir a última; de vez em quando, uma fala solta do personagem.
  function falarSobreAPagina(especie: Especie, das: Falas) {
    const opcoes = das.linhas;
    if (!opcoes.length || Math.random() < 0.2) {
      dizer(especie, especie === "corvo" ? dicaAleatoria() : falaDaCoruja());
      return;
    }
    let indice = Math.floor(Math.random() * opcoes.length);
    if (indice === ultima.current[especie] && opcoes.length > 1) indice = (indice + 1) % opcoes.length;
    ultima.current[especie] = indice;
    dizer(especie, opcoes[indice]!);
  }

  // Balão comum some sozinho (fala comprida fica mais); o do tutorial fica até mudar de passo.
  useEffect(() => {
    const timers = (["corvo", "coruja"] as const).flatMap((especie) => {
      const balao = baloes[especie];
      if (!balao || balao.fixo) return [];
      return [window.setTimeout(() => calar(especie), Math.max(6000, balao.texto.length * 75))];
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [baloes]);

  // Abertura: dita quando os dados chegam ou mudam. Se mudar de novo antes da hora, só a última sai.
  useAbertura(falas.corvo.abertura, ESPERA_ABERTURA.corvo, guiando, (texto) => dizer("corvo", texto));
  useAbertura(falas.coruja.abertura, ESPERA_ABERTURA.coruja, guiando, (texto) => dizer("coruja", texto));

  // Tutorial: os dois apresentam cada passo daqui, por cima do fundo escurecido.
  useEffect(() => {
    const aoMudarPasso = (evento: Event) => {
      const passo = (evento as CustomEvent<PassoTutorial | null>).detail;
      setGuiando(passo !== null);
      if (!passo) {
        setBaloes({ corvo: null, coruja: null });
        return;
      }
      setBaloes({
        corvo: passo.corvo ? { texto: passo.corvo, fixo: true } : null,
        coruja: passo.coruja ? { texto: passo.coruja, fixo: true } : null,
      });
      if (passo.corvo) falouEm.current.corvo = performance.now();
      if (passo.coruja) falouEm.current.coruja = performance.now() + 250;
    };
    window.addEventListener(EVENTO_TUTORIAL, aoMudarPasso);
    return () => window.removeEventListener(EVENTO_TUTORIAL, aoMudarPasso);
  }, []);

  // Animação parada: respiração, piscadas, cabeça seguindo o cursor e o grasnado ao falar.
  useEffect(() => {
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let mouseX: number | null = null;
    const aoMover = (evento: PointerEvent) => {
      if (evento.pointerType === "mouse") mouseX = evento.clientX;
    };
    window.addEventListener("pointermove", aoMover, { passive: true });
    let piscaCorvo = performance.now() + 2000;
    let piscaCoruja = performance.now() + 3500;
    let viradaCoruja = 0;
    let giroCorvo = 0;
    let quadro = 0;
    const piscada = (agora: number, em: number) => (agora > em && agora < em + 160 ? 1 - Math.abs((agora - em) / 80 - 1) : 0);

    const passo = (agora: number) => {
      if (agora > piscaCorvo + 200) piscaCorvo = agora + 2500 + Math.random() * 3500;
      if (agora > piscaCoruja + 200) piscaCoruja = agora + 3500 + Math.random() * 4500;
      // Cursor à esquerda do canto (quase sempre): os dois olham para a página, cada um do seu jeito.
      const centro = raiz.current?.getBoundingClientRect();
      const lado = mouseX !== null && centro ? Math.max(-1, Math.min(1, (mouseX - (centro.left + centro.width / 2)) / 500)) : -0.3;
      giroCorvo += (lado * 10 - giroCorvo) * 0.06;
      viradaCoruja += (lado * 0.55 - viradaCoruja) * 0.04;

      let poseCorvo = poseParada();
      poseCorvo.corpoY = calmo ? 0 : Math.sin(agora / 700) * 0.4;
      poseCorvo.cabecaGiro = giroCorvo;
      const grasnado = agora - falouEm.current.corvo;
      if (!calmo && grasnado >= 0 && grasnado < DURACAO_GRASNADO) poseCorvo = grasnar(poseCorvo, grasnado, DURACAO_GRASNADO);
      aplicarPose(partesCorvo, poseCorvo, -1, piscada(agora, piscaCorvo));

      const poseCoruja = poseCorujaParada(calmo ? 0 : agora);
      // Ao falar, a coruja só inclina a cabeça de leve: ela não se agita.
      const falando = agora - falouEm.current.coruja;
      const inclinacao = falando >= 0 && falando < 700 ? Math.sin((falando / 700) * Math.PI) * 10 : 0;
      aplicarCoruja(partesCoruja, {
        voando: false,
        asa: 0,
        virada: viradaCoruja,
        inclinacaoCabeca: inclinacao,
        cabecaX: poseCoruja.cabecaX,
        cabecaY: poseCoruja.cabecaY,
        respiro: poseCoruja.corpoY,
        inclinacao: poseCoruja.inclinacao,
        piscada: piscada(agora, piscaCoruja),
      });
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", aoMover);
    };
  }, [partesCorvo, partesCoruja]);

  const larguraCorvo = 120 * ESCALA.corvo;
  const larguraCoruja = 120 * ESCALA.coruja;

  return (
    <div
      ref={raiz}
      data-fixo
      className={`pointer-events-none fixed right-3 bottom-3 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6 ${guiando ? "z-[110]" : "z-40"}`}
    >
      {/* As falas empilhadas acima do poleiro, cada uma com o nome de quem fala. */}
      <div className="flex w-[min(20rem,calc(100vw-1.5rem))] flex-col items-end gap-2" role="status" aria-live="polite">
        {(["coruja", "corvo"] as const).map((especie) => {
          const balao = baloes[especie];
          if (!balao) return null;
          return (
            <div
              key={`${especie}-${balao.texto}`}
              className="pointer-events-auto relative w-max max-w-full rounded-xl border border-borda bg-painel px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.7)] transition-[opacity,translate] duration-300 starting:translate-y-1 starting:opacity-0"
            >
              <p className={`font-rotulo text-[11px] font-semibold tracking-[0.06em] ${especie === "corvo" ? "text-destaque" : "text-suave"}`}>
                {especie === "corvo" ? "Muninn" : "Glaux"}
              </p>
              <p className="pr-4 font-mono text-[11px] leading-snug text-texto">{balao.texto}</p>
              {!balao.fixo && (
                <button
                  type="button"
                  onClick={() => calar(especie)}
                  aria-label={t("Fechar fala", "Close")}
                  className="absolute top-1.5 right-2 text-xs text-apagado transition-colors hover:text-texto"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Os dois lado a lado no poleiro, a coruja à esquerda e o corvo olhando para a página. */}
      <Poleiro>
        <span
          className="cursor-pointer"
          title={t("Glaux: clique para ouvir", "Glaux: click to hear")}
          style={{ width: larguraCoruja, height: 100 * ESCALA.coruja }}
        >
          <CorujaSvg partes={partesCoruja} largura={larguraCoruja} altura={100 * ESCALA.coruja} aoClicar={() => falarSobreAPagina("coruja", falas.coruja)} />
        </span>
        <span
          className="cursor-pointer"
          title={t("Muninn: clique para ouvir", "Muninn: click to hear")}
          style={{ width: larguraCorvo, height: 100 * ESCALA.corvo }}
        >
          <CorvoSvg partes={partesCorvo} largura={larguraCorvo} altura={100 * ESCALA.corvo} aoClicar={() => falarSobreAPagina("corvo", falas.corvo)} />
        </span>
      </Poleiro>
    </div>
  );
}

/** Diz a abertura `espera` ms depois de ela chegar ou mudar (não durante o tutorial). */
function useAbertura(abertura: string | undefined, espera: number, guiando: boolean, dizer: (texto: string) => void) {
  const dizerRef = useRef(dizer);
  dizerRef.current = dizer;
  const guiandoRef = useRef(guiando);
  guiandoRef.current = guiando;
  useEffect(() => {
    if (!abertura) return;
    const timer = window.setTimeout(() => {
      if (!guiandoRef.current) dizerRef.current(abertura);
    }, espera);
    return () => window.clearTimeout(timer);
  }, [abertura, espera]);
}

/**
 * O poleiro: um card no formato dos terminais da landing, com os dois empoleirados na borda de cima (como
 * pousam nos cards de lá). O card também dá fundo a eles, que são só traço e embolariam com a página.
 */
function Poleiro({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-auto relative mt-12 w-52">
      {/* Os pés ficam a ~4% da base do desenho: as aves descem 3 px para pisar na borda. */}
      <div className="absolute right-0 bottom-full left-0 flex translate-y-[3px] justify-center">
        <div className="relative flex items-end gap-1 px-3">{children}</div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-borda bg-painel/95 shadow-[0_14px_36px_-14px_rgba(0,0,0,0.9)] backdrop-blur">
        <div className="flex h-9 items-center justify-between border-b border-borda px-3">
          <span className="font-rotulo text-[12px] font-semibold tracking-[0.06em] text-destaque">{t("De plantão", "On duty")}</span>
          <span className="font-mono text-[10px] text-apagado">Glaux e Muninn</span>
        </div>
        <p className="px-3 py-2.5 text-[11px] leading-snug text-suave">
          {t("Clique num dos dois para ouvir outra análise.", "Click either one to hear another take.")}
        </p>
      </div>
    </div>
  );
}
