import { t, useIdioma } from "../../lib/idioma";
import { useEffect, useMemo, useRef, useState } from "react";

import { type ItemResumo, useItens } from "../../api/itens";
import { formatarVariacao } from "../../lib/formato";
import {
  AMPLITUDE_PASSO,
  APOIO_X,
  CHAO,
  misturar,
  type Pose,
  poseAgachada,
  poseAndando,
  poseFreando,
  poseParada,
  posePulo,
  poseVoando,
  grasnar as poseGrasnando,
  pesJuntos,
} from "./corvo";
import { aplicarPose, CorvoSvg, usePartes } from "./desenho";
import { atravessa, type Caixa, coletarCena, type Poleiro, visivel } from "./poleiros";

// O corvo do Skinomics. Pousa no topo dos cards e da primeira linha dos títulos (`data-poleiro`),
// anda por eles, pula para um card vizinho na mesma altura e voa quando o próximo poleiro fica
// acima ou abaixo (ou quando o atual sai da tela). Parado, pisca, vira a cabeça, bica e mexe a cauda.
// Clicado, mostra um dado real da base. Precisa de um pai com `position: relative`.

const ESCALA = 0.55;
const DURACAO_GRASNADO = 900; // ms
const LARGURA = 120 * ESCALA;
const ALTURA = 100 * ESCALA;
const VELOCIDADE = 30; // px/s andando
const VOLUME_MINIMO = 50;
// Pula se o próximo poleiro está ao lado (quase na mesma altura); senão, voa.
const PULO_MAX_DY = 24;
const PULO_MAX_DX = 420;
// Uma versão anterior permitia esconder o mascote e guardava isso no navegador; a marca é apagada.
const CHAVE_ANTIGA = "skinomics:mascote-oculto";

type Modo = "parado" | "andando" | "agachando" | "pulando" | "voando" | "pousando";
type Ponto = { x: number; y: number };
// Curva cúbica: no voo sobe quase na vertical até uma altitude acima dos dois poleiros, cruza e
// desce sobre o destino; no pulo, um arco baixo entre dois cards vizinhos.
type Trajeto = {
  tipo: "pulo" | "voo";
  pontos: [Ponto, Ponto, Ponto, Ponto];
  inicio: number;
  duracao: number;
  destino: Poleiro;
};

function curva([a, b, c, d]: Trajeto["pontos"], u: number): Ponto {
  const v = 1 - u;
  return {
    x: v * v * v * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u * u * u * d.x,
    y: v * v * v * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u * u * u * d.y,
  };
}

function derivada([a, b, c, d]: Trajeto["pontos"], u: number): Ponto {
  const v = 1 - u;
  return {
    x: 3 * v * v * (b.x - a.x) + 6 * v * u * (c.x - b.x) + 3 * u * u * (d.x - c.x),
    y: 3 * v * v * (b.y - a.y) + 6 * v * u * (c.y - b.y) + 3 * u * u * (d.y - c.y),
  };
}

/** Amostra a curva nos pés e no meio do corpo, para testar contra os cards. */
function livre(pontos: Trajeto["pontos"], obstaculos: Caixa[]): boolean {
  const amostras: Ponto[] = [];
  for (let i = 1; i < 24; i++) {
    const p = curva(pontos, i / 24);
    amostras.push(p, { x: p.x, y: p.y - 22 });
  }
  return !atravessa(amostras, obstaculos);
}

const sortear = (min: number, max: number) => min + Math.random() * (max - min);
const suave = (t: number) => t * t * (3 - 2 * t);
const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function boletim(itens: ItemResumo[]): string[] {
  const negociados = itens.filter((item) => item.variacao_7d != null && (item.volume_7d ?? 0) >= VOLUME_MINIMO);
  const ordem = [...negociados].sort((a, b) => b.variacao_7d! - a.variacao_7d!);
  const alta = ordem[0];
  const queda = ordem[ordem.length - 1];
  const linhas: string[] = [];
  if (alta && alta.variacao_7d! > 0) linhas.push(t(`Maior alta em 7 dias: ${alta.nome}, ${formatarVariacao(alta.variacao_7d!)}.`, `Biggest 7-day rise: ${alta.nome}, ${formatarVariacao(alta.variacao_7d!)}.`));
  if (queda && queda.variacao_7d! < 0) linhas.push(t(`Maior queda em 7 dias: ${queda.nome}, ${formatarVariacao(queda.variacao_7d!)}.`, `Biggest 7-day drop: ${queda.nome}, ${formatarVariacao(queda.variacao_7d!)}.`));
  const maisNegociado = [...negociados].sort((a, b) => (b.volume_7d ?? 0) - (a.volume_7d ?? 0))[0];
  if (maisNegociado) linhas.push(t(`Mais negociado da semana: ${maisNegociado.nome}.`, `Most traded this week: ${maisNegociado.nome}.`));
  if (itens.length) linhas.push(t(`${itens.length} itens sob observação.`, `${itens.length} items being watched.`));
  return linhas;
}

export function Mascote() {
  const [fala, setFala] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const partes = usePartes();
  const falando = useRef(false);
  const grasnandoDesde = useRef(-Infinity);
  const { data } = useItens({ por_pagina: 100 });
  const idioma = useIdioma();
  // Trocou o idioma: as letras mudaram de lugar, então os poleiros são relidos já no próximo quadro.
  const releitura = useRef(false);
  useEffect(() => {
    releitura.current = true;
  }, [idioma]);
  const linhas = useMemo(() => boletim(data?.itens ?? []), [data, idioma]);
  const ultimaLinha = useRef(-1);
  // O laço de animação chama a fala por esta ref, para usar sempre as linhas mais recentes.
  const falarRef = useRef<() => void>(() => {});

  useEffect(() => {
    try {
      localStorage.removeItem(CHAVE_ANTIGA);
    } catch {
      // Sem armazenamento disponível: nada a limpar.
    }
  }, []);

  useEffect(() => {
    const el = raiz.current;
    const pai = el?.parentElement;
    if (!el || !pai) return;
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let poleiros: Poleiro[] = [];
    let obstaculos: Caixa[] = [];
    let atualizadoEm = -Infinity;
    let atual: Poleiro | null = null;
    let x = 0;
    let y = 0;
    let direcao = 1;
    let modo: Modo = "parado";
    let modoDesde = performance.now();
    let ate = 0;
    let alvoX = 0;
    let fase = 0;
    let trajeto: Trajeto | null = null;
    let proximoTrajeto: Trajeto | null = null;
    let pose: Pose = poseParada();
    // Comportamentos de quando está parado.
    let giroCabeca = 0;
    let giroAlvo = 0;
    let proximoGiro = 0;
    let piscarEm = performance.now() + sortear(1500, 4000);
    let bicadaAte = 0;
    let caudaAte = 0;
    // Fala sozinho de tempos em tempos (a primeira logo, para se apresentar).
    let proximaFalaEm = performance.now() + sortear(12000, 20000);
    let anterior = performance.now();
    let quadro = 0;
    let chegou = false;

    const mudar = (novo: Modo, agora: number) => {
      modo = novo;
      modoDesde = agora;
    };
    const virarPara = (dx: number) => {
      if (Math.abs(dx) > 0.5) direcao = dx < 0 ? -1 : 1;
    };
    const atualizarPoleiros = (agora: number) => {
      ({ poleiros, obstaculos } = coletarCena(pai.getBoundingClientRect()));
      atualizadoEm = agora;
      if (atual) {
        // O layout muda (imagens carregando, redimensionamento): no card, acompanha o poleiro. Se o
        // poleiro sumiu, ou a letra onde ele estava mudou (ex.: troca de idioma), ele se assusta e voa.
        const mesmo = poleiros.find((p) => p.chave === atual!.chave);
        const letraMudou =
          mesmo && atual.letra && (Math.abs(mesmo.y - atual.y) > 3 || x < mesmo.x0 - 3 || x > mesmo.x1 + 3);
        if (mesmo && !letraMudou) {
          atual = mesmo;
          y = mesmo.y;
          x = limitar(x, mesmo.x0, mesmo.x1);
        } else {
          espantar(agora);
        }
      }
    };
    /** Rota até o poleiro sem atravessar nenhum card; null se não houver. */
    const planejar = (destino: Poleiro, agora: number, tipo: "pulo" | "voo", exigirLivre = true): Trajeto | null => {
      const x1 = limitar(x + (Math.random() - 0.5) * 60, destino.x0, destino.x1);
      const inicio = { x, y };
      const fim = { x: x1, y: destino.y };
      const dx = x1 - x;
      const opcoes: Trajeto["pontos"][] =
        tipo === "pulo"
          ? [
              [
                inicio,
                { x: x + dx * 0.25, y: Math.min(y, fim.y) - 34 - Math.abs(dx) * 0.1 },
                { x: x + dx * 0.75, y: Math.min(y, fim.y) - 34 - Math.abs(dx) * 0.1 },
                fim,
              ],
            ]
          : // Tenta altitudes de cruzeiro cada vez mais altas até achar uma rota livre.
            [60, 140, 240].map((folga) => {
              const cruzeiro = Math.min(y, fim.y) - folga;
              return [inicio, { x, y: cruzeiro }, { x: x1, y: cruzeiro }, fim];
            });
      const pontos = opcoes.find((o) => !exigirLivre || livre(o, obstaculos));
      if (!pontos) return null;
      const comprimento = Math.abs(pontos[1].y - y) + Math.abs(dx) + Math.abs(pontos[2].y - fim.y);
      return {
        tipo,
        pontos,
        inicio: agora,
        duracao: tipo === "pulo" ? 420 + Math.abs(dx) * 0.6 : Math.min(700 + comprimento * 0.9, 2200),
        destino,
      };
    };
    const iniciarTrajeto = (t: Trajeto, agora: number) => {
      t.inicio = agora;
      trajeto = t;
      atual = null;
      virarPara(t.pontos[3].x - t.pontos[0].x);
      mudar(t.tipo === "pulo" ? "pulando" : "voando", agora);
    };
    /** Tiraram o poleiro dele: levanta voo na hora para outro lugar à vista, de preferência perto. */
    const espantar = (agora: number) => {
      atual = null;
      proximoTrajeto = null;
      const ref = pai.getBoundingClientRect();
      const destinos = poleiros
        .filter((p) => visivel(p, ref) && !(Math.abs(p.y - y) < 4 && x >= p.x0 && x <= p.x1))
        .map((p) => ({ p, d: Math.hypot((p.x0 + p.x1) / 2 - x, p.y - y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4)
        .map(({ p }) => p);
      // Rota livre até um dos mais próximos; sem nenhuma, vai mesmo assim ao mais próximo.
      const livreAte = destinos.map((p) => planejar(p, agora, "voo")).find((r) => r !== null);
      const reserva = destinos[0] ?? poleiros[0];
      const rota = livreAte ?? (reserva ? planejar(reserva, agora, "voo", false) : null);
      if (rota) iniciarTrajeto(rota, agora);
    };

    // Alguém começou a descolar o adesivo onde ele está pousado: sai voando.
    const aoMexerNoPoleiro = (evento: Event) => {
      const alvo = (evento as CustomEvent<HTMLElement | null>).detail;
      if (!alvo || !atual) return;
      const r = alvo.getBoundingClientRect();
      const ref = pai.getBoundingClientRect();
      const emCima = x >= r.left - ref.left - 4 && x <= r.right - ref.left + 4 && Math.abs(y - (r.top - ref.top)) < 8;
      if (emCima) espantar(performance.now());
    };
    window.addEventListener("skinomics:poleiro-mexido", aoMexerNoPoleiro);

    const decidir = (agora: number) => {
      if (!atual) return;
      // Nos cards ele anda; nas letras só se empoleira.
      if (!atual.letra && atual.x1 - atual.x0 > 90 && Math.random() < 0.35) {
        // Caminhadas curtas: alguns passos para um lado, não a extensão inteira do poleiro.
        const distancia = sortear(40, 140) * (Math.random() < 0.5 ? -1 : 1);
        alvoX = limitar(x + distancia, atual.x0, atual.x1);
        virarPara(alvoX - x);
        mudar("andando", agora);
        return;
      }
      // Passeia pela página inteira, de poleiro em poleiro próximo, sem seguir a área visível.
      const candidatos = poleiros
        .filter((p) => p.chave !== atual!.chave)
        .map((p) => ({ p, d: Math.hypot((p.x0 + p.x1) / 2 - x, p.y - y) }))
        .filter(({ d }) => d < 750)
        .sort((a, b) => a.d - b.d)
        .slice(0, 5);
      // Só destinos com rota livre: pula para o lado, voa para cima ou para baixo.
      const rotas = candidatos
        .map(({ p }) => {
          const centro = (p.x0 + p.x1) / 2;
          const aoLado = Math.abs(p.y - y) <= PULO_MAX_DY && Math.abs(centro - x) <= PULO_MAX_DX;
          return planejar(p, agora, aoLado ? "pulo" : "voo");
        })
        .filter((t): t is Trajeto => t !== null);
      const rota = rotas[Math.floor(Math.random() * rotas.length)];
      if (!rota) {
        ate = agora + sortear(1500, 3000);
        return;
      }
      proximoTrajeto = rota;
      virarPara(rota.pontos[3].x - x);
      mudar("agachando", agora);
    };

    const desenhar = (piscada: number) => {
      el.style.transform = `translate(${x - APOIO_X * ESCALA}px, ${y - CHAO * ESCALA}px)`;
      el.style.opacity = atual || trajeto ? "1" : "0";
      aplicarPose(partes, pose, direcao, piscada);
    };

    const comecouEm = performance.now();
    const passo = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      const ref = pai.getBoundingClientRect();
      if (agora - atualizadoEm > 1200 || releitura.current) {
        releitura.current = false;
        atualizarPoleiros(agora);
      }
      const desde = agora - modoDesde;

      // Chegada: entra voando pela borda esquerda da tela e pousa numa letra visível. Se nenhuma letra
      // aparecer em 1,5 s (fontes ainda carregando, página aberta já rolada), vale qualquer poleiro à vista.
      if (!chegou && !atual && !trajeto && !proximoTrajeto) {
        const vistos = poleiros.filter((p) => visivel(p, ref));
        const destino = vistos.find((p) => p.letra) ?? (agora - comecouEm > 1500 ? (vistos[0] ?? poleiros[0]) : undefined);
        if (destino) {
          const fim = { x: sortear(destino.x0, destino.x1), y: destino.y };
          const inicio = { x: -ref.left - 90, y: Math.max(fim.y - 240, -ref.top + 60) };
          const chegada: Trajeto = {
            tipo: "voo",
            pontos: [
              inicio,
              { x: inicio.x + (fim.x - inicio.x) * 0.45, y: inicio.y - 50 },
              { x: fim.x - 90, y: fim.y - 120 },
              fim,
            ],
            inicio: agora,
            duracao: limitar(1300 + (fim.x - inicio.x) * 0.8, 1700, 2600),
            destino,
          };
          x = inicio.x;
          y = inicio.y;
          chegou = true;
          iniciarTrajeto(chegada, agora);
        }
      } else if (chegou && !atual && !trajeto && !proximoTrajeto) {
        espantar(agora);
      }

      let alvo: Pose = poseParada();

      if (modo === "agachando" && proximoTrajeto) {
        alvo = poseAgachada(1);
        if (desde > (proximoTrajeto.tipo === "pulo" ? 170 : 130)) {
          iniciarTrajeto(proximoTrajeto, agora);
          proximoTrajeto = null;
        }
      } else if ((modo === "pulando" || modo === "voando") && trajeto) {
        const t = limitar((agora - trajeto.inicio) / trajeto.duracao, 0, 1);
        const u = trajeto.tipo === "voo" ? suave(t) : t;
        ({ x, y } = curva(trajeto.pontos, u));
        if (trajeto.tipo === "pulo") {
          alvo = posePulo(t);
        } else {
          // Inclina o corpo na direção do voo; no fim, abre as asas e estica as patas para pousar.
          const v = derivada(trajeto.pontos, u);
          if (Math.abs(v.x) > 40) virarPara(v.x);
          const inclinacao = limitar(((Math.atan2(v.y, Math.abs(v.x) + 1) * 180) / Math.PI) * 0.4, -24, 24);
          alvo = t > 0.82 ? poseFreando(agora) : poseVoando(agora, inclinacao);
        }
        if (t >= 1) {
          atual = trajeto.destino;
          ({ x, y } = trajeto.pontos[3]);
          trajeto = null;
          mudar("pousando", agora);
        }
      } else if (modo === "pousando") {
        alvo = poseAgachada(Math.max(0, 1 - desde / 220) * 0.9);
        if (desde > 260) {
          mudar("parado", agora);
          ate = agora + sortear(800, 2600);
        }
      } else if (modo === "andando" && atual) {
        const dx = alvoX - x;
        const passoX = Math.sign(dx) * Math.min(Math.abs(dx), VELOCIDADE * dt);
        x += passoX;
        fase += Math.abs(passoX) / AMPLITUDE_PASSO;
        alvo = poseAndando(fase);
        if (Math.abs(dx) < 0.5) {
          mudar("parado", agora);
          ate = agora + sortear(900, 2600);
        }
      } else if (atual) {
        // Parado: respira, vira a cabeça de vez em quando, às vezes bica o chão ou mexe a cauda.
        alvo = poseParada();
        alvo.corpoY = Math.sin(agora / 700) * 0.4;
        if (!calmo) {
          if (agora > proximoGiro) {
            giroAlvo = sortear(-14, 10);
            proximoGiro = agora + sortear(900, 2800);
            if (Math.random() < 0.18) bicadaAte = agora + 320;
            if (Math.random() < 0.2) caudaAte = agora + 260;
          }
          giroCabeca += (giroAlvo - giroCabeca) * Math.min(1, dt * 8);
          alvo.cabecaGiro = agora < bicadaAte ? 42 : giroCabeca;
          if (agora < bicadaAte) alvo.cabecaX = 2.5;
          alvo.cauda = agora < caudaAte ? -12 : 0;
          if (agora > proximaFalaEm && !falando.current && visivel(atual, ref)) {
            // Pousado, parado e à vista: grasna e conta um dado; fica no lugar enquanto fala.
            falarRef.current();
            proximaFalaEm = agora + sortear(30000, 60000);
            ate = Math.max(ate, agora + 2500);
          } else if (agora > ate && !falando.current) {
            decidir(agora);
          }
        }
      }

      // Numa letra, os pés ficam juntos no topo dela.
      if (atual?.letra && (modo === "parado" || modo === "pousando")) alvo = pesJuntos(alvo);
      // Clicado: grasna (cabeça para cima e para frente, bico abrindo e fechando).
      const grasnando = agora - grasnandoDesde.current < DURACAO_GRASNADO;
      if (grasnando) alvo = poseGrasnando(alvo, agora - grasnandoDesde.current, DURACAO_GRASNADO);

      // Suaviza a passagem entre poses (a caminhada, o voo e o grasnado já são contínuos por si).
      const rapidez = modo === "andando" || modo === "voando" || grasnando ? 30 : 16;
      const asa = alvo.asa;
      pose = misturar(pose, alvo, 1 - Math.exp(-dt * rapidez));
      pose.asa = asa;

      // Piscada: a pálpebra desce e sobe em ~140 ms.
      if (agora > piscarEm + 140) piscarEm = agora + sortear(2200, 5500);
      const piscando = agora > piscarEm ? Math.sin(((agora - piscarEm) / 140) * Math.PI) : 0;
      desenhar(Math.max(0, piscando));
      quadro = requestAnimationFrame(passo);
    };

    const aoRedimensionar = () => (atualizadoEm = -Infinity);
    window.addEventListener("resize", aoRedimensionar);
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("skinomics:poleiro-mexido", aoMexerNoPoleiro);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, []);

  useEffect(() => {
    if (!fala) return;
    falando.current = true;
    const t = setTimeout(() => {
      setFala(null);
      falando.current = false;
    }, 5000);
    return () => clearTimeout(t);
  }, [fala]);

  /** Grasna e mostra no balão um dado da base (sem repetir o último). */
  function falar() {
    grasnandoDesde.current = performance.now();
    if (!linhas.length) return;
    let indice = Math.floor(Math.random() * linhas.length);
    if (indice === ultimaLinha.current) indice = (indice + 1) % linhas.length;
    ultimaLinha.current = indice;
    setFala(linhas[indice]!);
  }
  falarRef.current = falar;

  const aoClicar = falar;

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
      <CorvoSvg partes={partes} largura={LARGURA} altura={ALTURA} aoClicar={aoClicar} />
    </div>
  );
}
