import { useEffect, useMemo, useRef, useState } from "react";

import { type ItemResumo, useItens } from "../../api/itens";
import { formatarVariacao } from "../../lib/formato";
import {
  AMPLITUDE_PASSO,
  APOIO_X,
  BASE_CAUDA,
  CHAO,
  misturar,
  OMBRO,
  perna,
  PESCOCO,
  type Pose,
  poseAgachada,
  poseAndando,
  poseFreando,
  poseParada,
  posePulo,
  poseVoando,
  transformarCorpo,
} from "./corvo";
import { atravessa, type Caixa, coletarCena, type Poleiro, visivel } from "./poleiros";

// O corvo do Skinomics. Pousa no topo dos cards e da primeira linha dos títulos (`data-poleiro`),
// anda por eles, pula para um card vizinho na mesma altura e voa quando o próximo poleiro fica
// acima ou abaixo (ou quando o atual sai da tela). Parado, pisca, vira a cabeça, bica e mexe a cauda.
// Clicado, mostra um dado real da base. Precisa de um pai com `position: relative`.

const ESCALA = 0.78;
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
  if (alta && alta.variacao_7d! > 0) linhas.push(`Maior alta em 7 dias: ${alta.nome}, ${formatarVariacao(alta.variacao_7d!)}.`);
  if (queda && queda.variacao_7d! < 0) linhas.push(`Maior queda em 7 dias: ${queda.nome}, ${formatarVariacao(queda.variacao_7d!)}.`);
  const maisNegociado = [...negociados].sort((a, b) => (b.volume_7d ?? 0) - (a.volume_7d ?? 0))[0];
  if (maisNegociado) linhas.push(`Mais negociado da semana: ${maisNegociado.nome}.`);
  if (itens.length) linhas.push(`${itens.length} itens sob observação.`);
  return linhas;
}

export function Mascote() {
  const [fala, setFala] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const espelho = useRef<SVGGElement>(null);
  const corpo = useRef<SVGGElement>(null);
  const cabeca = useRef<SVGGElement>(null);
  const cauda = useRef<SVGGElement>(null);
  const asaFechada = useRef<SVGGElement>(null);
  const asaPerto = useRef<SVGGElement>(null);
  const asaLonge = useRef<SVGGElement>(null);
  const olho = useRef<SVGGElement>(null);
  const pernas = useRef<(SVGPathElement | null)[]>([]);
  const falando = useRef(false);
  const { data } = useItens({ por_pagina: 100 });
  const linhas = useMemo(() => boletim(data?.itens ?? []), [data]);
  const ultimaLinha = useRef(-1);

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
    let invisivelDesde = 0;
    let pose: Pose = poseParada();
    // Comportamentos de quando está parado.
    let giroCabeca = 0;
    let giroAlvo = 0;
    let proximoGiro = 0;
    let piscarEm = performance.now() + sortear(1500, 4000);
    let bicadaAte = 0;
    let caudaAte = 0;
    let anterior = performance.now();
    let quadro = 0;

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
        // O layout muda (imagens carregando, redimensionamento): acompanha o poleiro onde está.
        const mesmo = poleiros.find((p) => p.chave === atual!.chave);
        if (mesmo) {
          atual = mesmo;
          y = mesmo.y;
          x = limitar(x, mesmo.x0, mesmo.x1);
        } else {
          atual = null;
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
    const decidir = (agora: number, ref: DOMRect) => {
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
      const candidatos = poleiros
        .filter((p) => p.chave !== atual!.chave && visivel(p, ref))
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

    const desenhar = () => {
      el.style.transform = `translate(${x - APOIO_X * ESCALA}px, ${y - CHAO * ESCALA}px)`;
      el.style.opacity = atual || trajeto ? "1" : "0";
      espelho.current?.setAttribute("transform", direcao < 0 ? `translate(${APOIO_X * 2} 0) scale(-1 1)` : "");
      corpo.current?.setAttribute("transform", transformarCorpo(pose));
      cabeca.current?.setAttribute(
        "transform",
        `translate(${pose.cabecaX.toFixed(2)} ${pose.cabecaY.toFixed(2)}) rotate(${pose.cabecaGiro.toFixed(2)} ${PESCOCO.x} ${PESCOCO.y})`,
      );
      cauda.current?.setAttribute("transform", `rotate(${pose.cauda.toFixed(2)} ${BASE_CAUDA.x} ${BASE_CAUDA.y})`);
      asaFechada.current?.setAttribute("transform", `rotate(${pose.asaFechadaGiro.toFixed(2)} ${OMBRO.x} ${OMBRO.y})`);
      asaFechada.current?.setAttribute("opacity", pose.asa === "fechada" ? "1" : "0");
      for (const [ref, angulo] of [
        [asaPerto, pose.asaAngulo],
        [asaLonge, pose.asaLonge],
      ] as const) {
        ref.current?.setAttribute("transform", `translate(${OMBRO.x} ${OMBRO.y}) rotate(${angulo.toFixed(2)})`);
        ref.current?.setAttribute("opacity", pose.asa === "aberta" ? "1" : "0");
      }
      ([0, 1] as const).forEach((lado) => {
        const p = perna(pose, lado);
        pernas.current[lado * 3]?.setAttribute("d", p.tibia);
        pernas.current[lado * 3 + 1]?.setAttribute("d", p.tarso);
        pernas.current[lado * 3 + 2]?.setAttribute("d", p.dedos);
      });
    };

    const passo = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;
      const ref = pai.getBoundingClientRect();
      if (agora - atualizadoEm > 1200) atualizarPoleiros(agora);
      const desde = agora - modoDesde;

      // Primeiro pouso: o primeiro poleiro visível (normalmente o título principal).
      if (!atual && !trajeto && !proximoTrajeto) {
        const inicial = poleiros.find((p) => visivel(p, ref));
        if (inicial) {
          atual = inicial;
          x = sortear(inicial.x0, Math.min(inicial.x1, inicial.x0 + 220));
          y = inicial.y;
          ate = agora + sortear(1200, 2500);
        }
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
      } else if (atual && !calmo && !visivel(atual, ref)) {
        // O poleiro saiu da tela: depois de um instante, voa para um visível, entrando pela borda.
        invisivelDesde ||= agora;
        if (agora - invisivelDesde > 500) {
          y = limitar(y, -ref.top + 40, -ref.top + window.innerHeight + 40);
          const opcoes = poleiros.filter((p) => visivel(p, ref));
          const rotas = opcoes.map((p) => planejar(p, agora, "voo")).filter((t): t is Trajeto => t !== null);
          // Se nenhuma rota estiver livre (vindo de fora da tela), aceita a mais simples.
          const rota =
            rotas[Math.floor(Math.random() * rotas.length)] ??
            (opcoes[0] ? planejar(opcoes[0], agora, "voo", false) : null);
          if (rota) iniciarTrajeto(rota, agora);
          invisivelDesde = 0;
        }
      } else if (modo === "andando" && atual) {
        invisivelDesde = 0;
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
        invisivelDesde = 0;
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
          if (agora > ate && !falando.current) decidir(agora, ref);
        }
      }

      // Suaviza a passagem entre poses (a caminhada e o voo já são contínuos por si).
      const rapidez = modo === "andando" || modo === "voando" ? 30 : 16;
      const asa = alvo.asa;
      pose = misturar(pose, alvo, 1 - Math.exp(-dt * rapidez));
      pose.asa = asa;

      // Piscada: a pálpebra desce e sobe em ~140 ms.
      if (agora > piscarEm + 140) piscarEm = agora + sortear(2200, 5500);
      const piscando = agora > piscarEm ? Math.sin(((agora - piscarEm) / 140) * Math.PI) : 0;
      olho.current?.setAttribute(
        "transform",
        `translate(0 ${OLHO.y}) scale(1 ${(1 - Math.max(0, piscando)).toFixed(2)}) translate(0 ${-OLHO.y})`,
      );

      desenhar();
      quadro = requestAnimationFrame(passo);
    };

    const aoRedimensionar = () => (atualizadoEm = -Infinity);
    window.addEventListener("resize", aoRedimensionar);
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
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

  function grasnar() {
    if (!linhas.length) return;
    let indice = Math.floor(Math.random() * linhas.length);
    if (indice === ultimaLinha.current) indice = (indice + 1) % linhas.length;
    ultimaLinha.current = indice;
    setFala(linhas[indice]!);
  }

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
      <svg viewBox="0 0 120 100" width={LARGURA} height={ALTURA} className="overflow-visible" role="img" aria-label="Corvo do Skinomics">
        {/* Arte em linha: contorno verde-limão sobre preto, com espirais ornamentais e penas em lâmina. */}
        <g
          ref={espelho}
          fill="#000"
          stroke="var(--color-destaque)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Pernas: tíbia, tarso e dedos com garras. Atrás do corpo; a de longe, mais apagada. */}
          {([1, 0] as const).map((lado) => (
            <g key={lado} fill="none" strokeOpacity={lado === 1 ? 0.45 : 1}>
              <path ref={(e) => void (pernas.current[lado * 3] = e)} />
              <path ref={(e) => void (pernas.current[lado * 3 + 1] = e)} />
              <path ref={(e) => void (pernas.current[lado * 3 + 2] = e)} strokeWidth="0.9" />
            </g>
          ))}

          <g ref={corpo}>
            {/* Asa do fundo (aberta no pulo e no voo) */}
            <g ref={asaLonge} opacity="0" strokeOpacity="0.45">
              <AsaAberta />
            </g>

            {/* Cauda: três penas em lâmina, cada uma com a nervura */}
            <g ref={cauda}>
              {[
                "M40 66C30 69 18 74 8 79 7 77.5 7.5 76 9 75 19 70 29 66 39 62Z",
                "M40 64C30 66 18 68 6 71 5.5 69.5 6 68 7.5 67.4 19 64.8 30 62.6 39.6 60.8Z",
                "M40 68C31 72 21 78 12 84 10.8 82.8 11 81.2 12.4 80.2 21 74.6 30 69.8 39 65.6Z",
              ].map((d) => (
                <path key={d} d={d} />
              ))}
              <path d="M37 64.4 9 76.6M37 62.6 8 69.2M37 66.4 12.5 82" fill="none" strokeOpacity="0.45" strokeWidth="0.6" />
            </g>

            {/* Corpo */}
            <path d="M30 64C36 53 48 45 63 43 73 42 80 44 84 49 87.4 55.6 84 66 75 72 65 78 49 77 39 71 35 68.6 32 66.6 30 64Z" />
            {/* Ornamentos do peito: espiral e a linha que desce do pescoço */}
            <path d="M80.5 55C84 61 80.6 69.6 73.6 69 68.6 68.6 68.4 62.4 72.4 61.6 75.4 61 76.4 64.6 74.4 65.4" fill="none" strokeWidth="0.9" />
            <path d="M81 49C77 56 70 66 59 74.5M64 76.5C70 73 75 69 77.5 66" fill="none" strokeWidth="0.7" strokeOpacity="0.6" />

            {/* Asa dobrada: espiral no ombro, coberteiras em escama e primárias longas */}
            <g ref={asaFechada}>
              <path d="M75 47C65 45 51 50 41 58L21 70 27 70.4 23 72.6 31 71.6 28 74.2C41 71 55 67 65 64 74 61 79 54 75 47Z" />
              <path
                d="M75.5 49C70 45.6 63.6 49.6 65.4 54.8 66.6 58.2 71.4 57.8 71.4 54.8 71.4 52.8 69 52.6 68.4 54.2"
                fill="none"
                strokeWidth="0.9"
              />
              <path d="M63 58.6c-2.6 2.6-6 3-8.8 1.6-2.4 2.8-5.8 3-8.6 1.6" fill="none" strokeWidth="0.7" />
              <path d="M58 63.4 28 72.6M53 63 25.5 71.4M48.4 62.2 23.5 70.2" fill="none" strokeWidth="0.6" strokeOpacity="0.7" />
            </g>

            {/* Cabeça (gira em torno do pescoço), um pouco maior que o natural */}
            <g ref={cabeca}>
              <g>
                <path d="M78.5 47C77.5 39 81.5 31.5 89.5 29.2 95.5 27.6 101 28 104.6 30.2L104.2 39.4C100.6 43.4 96 46.2 90 47.8 84.6 49.2 80.4 49 78.5 47Z" />
                {/* Espiral da bochecha */}
                <path d="M84.6 43C83.6 38.4 88.4 36.6 90 39.2 91 41 89 42.4 88 41" fill="none" strokeWidth="0.8" />
                {/* Bico contornado, com a linha da boca e a narina */}
                <path d="M104 29.8C111 30 117.4 32.4 122.4 36.8 116.6 37.6 110 38.6 104.2 39.4Z" />
                <path d="M104.4 35C110 35.6 116 36.2 121.6 36.8" fill="none" strokeWidth="0.7" />
                <path d="M106.6 32.2c1.2 -.4 2.4 -.3 3.4.3" fill="none" strokeWidth="0.7" />
                {/* Olho de bravo: fenda inclinada sob uma sobrancelha que desce para o bico; pisca fechando a fenda */}
                <g ref={olho}>
                  <path d={`M91.4 ${OLHO.y - 0.4}Q95.4 ${OLHO.y - 2.4} 99.6 ${OLHO.y + 0.6}Q95.2 ${OLHO.y + 1.6} 91.4 ${OLHO.y - 0.4}Z`} fill="var(--color-destaque)" strokeWidth="0.5" />
                  <circle cx="96.4" cy={OLHO.y - 0.2} r="0.85" fill="#000" stroke="none" />
                </g>
                <path d="M89.2 30.4C93.2 30.4 97.4 31.6 101.2 34.2" fill="none" strokeWidth="1.7" />
              </g>
            </g>

            {/* Asa da frente (aberta no pulo e no voo) */}
            <g ref={asaPerto} opacity="0">
              <AsaAberta />
            </g>
          </g>
        </g>

        {/* Área de clique (o resto do mascote não bloqueia a página) */}
        <rect x="22" y="22" width="88" height="76" fill="transparent" className="pointer-events-auto cursor-pointer" onClick={grasnar} />
      </svg>
    </div>
  );
}

const OLHO = { y: 33.6 };

// Primárias da asa aberta: lâminas que saem do "punho" e se abrem em leque para trás.
const PRIMARIAS = Array.from({ length: 6 }, (_, i) => {
  const base = { x: -5 - i * 5, y: -15 + i * 2.8 };
  const angulo = ((-96 - i * 12) * Math.PI) / 180;
  const comprimento = 27 - i * 1.6;
  const ponta = { x: base.x + Math.cos(angulo) * comprimento, y: base.y + Math.sin(angulo) * comprimento };
  const normal = { x: -Math.sin(angulo) * 2.3, y: Math.cos(angulo) * 2.3 };
  const meio = { x: (base.x + ponta.x) / 2, y: (base.y + ponta.y) / 2 };
  const n = (v: number) => v.toFixed(2);
  return {
    lamina:
      `M${n(base.x + normal.x)} ${n(base.y + normal.y)}` +
      `Q${n(meio.x + normal.x * 1.25)} ${n(meio.y + normal.y * 1.25)} ${n(ponta.x)} ${n(ponta.y)}` +
      `Q${n(meio.x - normal.x * 1.25)} ${n(meio.y - normal.y * 1.25)} ${n(base.x - normal.x)} ${n(base.y - normal.y)}Z`,
    nervura: `M${n(base.x)} ${n(base.y)}L${n(base.x + (ponta.x - base.x) * 0.8)} ${n(base.y + (ponta.y - base.y) * 0.8)}`,
  };
});

/** Asa aberta, desenhada a partir do ombro (0, 0) apontando para cima: coberteiras, espiral e primárias. */
function AsaAberta() {
  return (
    <>
      {[...PRIMARIAS].reverse().map(({ lamina, nervura }) => (
        <g key={lamina}>
          <path d={lamina} />
          <path d={nervura} fill="none" strokeWidth="0.5" strokeOpacity="0.6" />
        </g>
      ))}
      <path d="M0 0C-3 -8-6 -13-8 -18-16 -20-26 -18-33 -12-24 -6-13 -1 0 0Z" />
      <path d="M-4 -6C-9 -9-14 -6-12 -2.6-10.6 -.4-7.4 -1.2-8.2 -3.4" fill="none" strokeWidth="0.9" />
      <path d="M-14 -13c-3 2-7 2-9.6 .4M-20 -9.6c-2.6 1.6-5.6 1.6-8 .2" fill="none" strokeWidth="0.6" />
    </>
  );
}
