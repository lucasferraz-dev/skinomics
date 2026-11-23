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
import {
  dicaAleatoria,
  derrota,
  falaDaCoruja,
  falaDaSecao,
  marcarSaudacaoDita,
  provocacao,
  queixa,
  resistencia,
  resposta,
  saudacaoDaVisita,
} from "./conversa";
import { aplicarPose, CorvoSvg, usePartes } from "./desenho";
import { poseCorujaParada, poseCorujaVoando } from "./coruja";
import { aplicarCoruja, CorujaSvg, usePartesCoruja } from "./desenhoCoruja";
import { avisar, EVENTO_POLEIRO_MEXIDO, EVENTO_PUXAR_CHAVEIRO, EVENTO_TUTORIAL, EVENTO_TV, type PassoTutorial } from "./eventos";
import { atravessa, type Caixa, coletarCena, type Poleiro, visivel } from "./poleiros";
import { DISTANCIA, MESMA_ALTURA, type Presenca, presencas } from "./rivais";

// O corvo do Skinomics. Pousa no topo dos cards e da primeira linha dos títulos (`data-poleiro`),
// anda por eles, pula para um card vizinho na mesma altura e voa quando o próximo poleiro fica
// acima ou abaixo (ou quando o atual sai da tela). Parado, pisca, vira a cabeça, bica e mexe a cauda.
// Clicado, mostra um dado real da base. Precisa de um pai com `position: relative`.

// Tamanho na tela: o corvo um pouco maior; a coruja já tem a cabeça grande.
const ESCALAS = { corvo: 0.58, coruja: 0.55 } as const;
const DURACAO_GRASNADO = 900; // ms
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

/** O corvo (padrão) ou a coruja: mesmo esqueleto e mesmos movimentos, desenho e falas próprios. */
export function Mascote({ especie = "corvo" }: { especie?: "corvo" | "coruja" }) {
  const escala = ESCALAS[especie];
  const largura = 120 * escala;
  const altura = 100 * escala;
  const [fala, setFala] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const bolha = useRef<HTMLParagraphElement>(null);
  const partes = usePartes();
  const partesCoruja = usePartesCoruja();
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
  const reclamarRef = useRef<() => void>(() => {});
  const dizerRef = useRef<(texto: string, fixa?: boolean) => void>(() => {});
  const calarRef = useRef<() => void>(() => {});
  // Fala do tutorial: fica no balão até mudar de passo ou fechar, em vez de sumir sozinha.
  const falaFixa = useRef(false);
  // Saudação desta visita ("Voltou! Faz 3 dias."), dita logo que ele pousa pela primeira vez.
  const saudacaoRef = useRef(especie === "corvo" ? saudacaoDaVisita() : null);
  // No tutorial os dois ficam acima do fundo escurecido, como guias.
  const [guiando, setGuiando] = useState(false);
  useEffect(() => {
    const aoMudarPasso = (evento: Event) => setGuiando((evento as CustomEvent<PassoTutorial | null>).detail !== null);
    window.addEventListener(EVENTO_TUTORIAL, aoMudarPasso);
    return () => window.removeEventListener(EVENTO_TUTORIAL, aoMudarPasso);
  }, []);

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
    // Virada suave do corpo (de -1 a 1) e da cabeça para trás (0 a 1), só no corvo.
    let espelho = 1;
    let cabecaTras = 0;
    let cabecaTrasAlvo = 0;
    let atrasDesde = 0;
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
    let proximaFalaEm = performance.now() + (saudacaoRef.current ? 2600 : sortear(12000, 20000));
    let anterior = performance.now();
    let quadro = 0;
    let chegou = false;
    // Cursor: posição na tela, velocidade e quando mexeu pela última vez (só mouse, não toque).
    let mouse: { cx: number; cy: number; vel: number; movidoEm: number } | null = null;
    let curiosoFeito = false;
    let bicarAoChegar = false;
    let sossegoAte = 0;
    // Coruja: de vez em quando balança a cabeça de lado, medindo distância.
    let balancoAte = 0;
    let proximoBalanco = performance.now() + sortear(5000, 9000);
    // Coruja: para onde a cabeça olha (0 de frente, ±1 virada para trás) e quando ela gira para trás.
    let virada = 0;
    let olharTrasAte = 0;
    let ladoTras = 1;
    let proximoOlharTras = performance.now() + sortear(9000, 16000);
    // Conduzido pelo modo TV ou pelo tutorial: não passeia sozinho nem se assusta com o cursor.
    let emTv = false;
    let emTutorial = false;
    let passoAtual = 0;
    let secaoAtual = 0;
    const conduzido = () => emTv || emTutorial;
    // Implicância (nos dois sentidos): de tempos em tempos um pousa do lado do outro e provoca.
    let implicando = false;
    let provocarEm = 0;
    let proximaImplicancia = performance.now() + (especie === "corvo" ? sortear(20000, 35000) : sortear(45000, 70000));
    const presenca: Presenca = { x: 0, y: 0, poleiro: null, alvo: null, enxotar: () => {}, recuar: () => {}, balao: null };
    presencas.set(especie, presenca);
    // Lugares visitados por último (um título inteiro conta como um lugar), para não voltar já para eles.
    let recentes: string[] = [];
    const lugarDe = (p: Poleiro) => p.chave.split(":")[0]!;
    const rival = () => presencas.get(especie === "corvo" ? "coruja" : "corvo");

    /** Ponto livre no poleiro, longe do outro (onde ele está ou vai pousar); null se não couber. */
    const lugarVago = (destino: Poleiro, desejado: number): number | null => {
      const outro = rival();
      const ocupados = [
        outro?.poleiro && Math.abs(outro.y - destino.y) < MESMA_ALTURA ? outro.x : null,
        outro?.alvo && Math.abs(outro.alvo.y - destino.y) < MESMA_ALTURA ? outro.alvo.x : null,
      ].filter((v): v is number => v !== null);
      let livreEm = desejado;
      for (const ocupado of ocupados) {
        if (Math.abs(livreEm - ocupado) >= DISTANCIA) continue;
        const opcoes = [ocupado + DISTANCIA, ocupado - DISTANCIA].filter(
          (v) => v >= destino.x0 && v <= destino.x1 && ocupados.every((o) => Math.abs(v - o) >= DISTANCIA),
        );
        if (!opcoes.length) return null;
        livreEm = opcoes.sort((a, b) => Math.abs(a - desejado) - Math.abs(b - desejado))[0]!;
      }
      return livreEm;
    };
    /** Destino de caminhada que não encosta no outro, se ele estiver no mesmo poleiro. */
    const semEncostar = (alvo: number) => {
      const outro = rival();
      if (!atual || !outro?.poleiro || Math.abs(outro.y - y) >= MESMA_ALTURA) return alvo;
      return outro.x > x ? Math.min(alvo, outro.x - DISTANCIA) : Math.max(alvo, outro.x + DISTANCIA);
    };

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
      // Na borda de um card do tutorial (poleiro criado na hora), fica onde está.
      if (atual && !atual.chave.startsWith("borda:")) {
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
    const planejar = (destino: Poleiro, agora: number, tipo: "pulo" | "voo", exigirLivre = true, xFixo?: number): Trajeto | null => {
      const x1 = xFixo ?? lugarVago(destino, limitar(x + (Math.random() - 0.5) * 60, destino.x0, destino.x1));
      if (x1 === null) return null;
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
        // A coruja voa mais devagar, planando.
        duracao:
          tipo === "pulo"
            ? 420 + Math.abs(dx) * 0.6
            : especie === "coruja"
              ? Math.min(1000 + comprimento * 1.25, 3200)
              : Math.min(700 + comprimento * 0.9, 2200),
        destino,
      };
    };
    const iniciarTrajeto = (t: Trajeto, agora: number) => {
      t.inicio = agora;
      trajeto = t;
      presenca.alvo = { chave: t.destino.chave, x: t.pontos[3].x, y: t.pontos[3].y };
      atual = null;
      virarPara(t.pontos[3].x - t.pontos[0].x);
      mudar(t.tipo === "pulo" ? "pulando" : "voando", agora);
    };
    /** Tiraram o poleiro dele: levanta voo na hora para outro lugar à vista, de preferência perto. */
    const espantar = (agora: number, queixar = true) => {
      if (atual && queixar) reclamarRef.current();
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

    // Provocado: na maioria das vezes responde e sai na hora; às vezes finca o pé e quem provocou é que sai.
    presenca.enxotar = () =>
      window.setTimeout(() => {
        if (!atual) return;
        const outro = rival();
        if (outro && Math.random() < 0.3) {
          dizerRef.current(resistencia(especie));
          outro.recuar();
        } else {
          dizerRef.current(resposta(especie));
          espantar(performance.now(), false);
        }
      }, 450);
    presenca.recuar = () =>
      window.setTimeout(() => {
        if (!atual) return;
        dizerRef.current(derrota(especie));
        espantar(performance.now(), false);
      }, 900);

    // Alguém começou a descolar o adesivo onde ele está pousado: sai voando.
    const aoMexerNoPoleiro = (evento: Event) => {
      const alvo = (evento as CustomEvent<HTMLElement | null>).detail;
      if (!alvo || !atual) return;
      const r = alvo.getBoundingClientRect();
      const ref = pai.getBoundingClientRect();
      const emCima = x >= r.left - ref.left - 4 && x <= r.right - ref.left + 4 && Math.abs(y - (r.top - ref.top)) < 8;
      if (emCima) espantar(performance.now());
    };
    window.addEventListener(EVENTO_POLEIRO_MEXIDO, aoMexerNoPoleiro);

    /** Voa até um poleiro dentro do elemento (de preferência uma letra do título dele). */
    const irParaElemento = (el: Element, agora: number, preferirCards = false) => {
      if (el.closest("header")) return;
      const ref = pai.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const caixa = { x0: r.left - ref.left, x1: r.right - ref.left, y0: r.top - ref.top, y1: r.bottom - ref.top };
      const dentro = poleiros
        .filter((p) => p.x1 > caixa.x0 && p.x0 < caixa.x1 && p.y >= caixa.y0 - 4 && p.y <= caixa.y1)
        .sort((a, b) => Number(b.letra) - Number(a.letra) || a.y - b.y);
      const perto = [...poleiros].sort(
        (a, b) => Math.hypot(a.x0 - caixa.x0, a.y - caixa.y0) - Math.hypot(b.x0 - caixa.x0, b.y - caixa.y0),
      );
      // Só cards que aparecem com a seção no topo da tela (o modo TV rola até lá).
      const cards = dentro.filter((p) => !p.letra && p.y < caixa.y0 + window.innerHeight * 0.7);
      const sorteado = preferirCards && cards.length ? cards[Math.floor(Math.random() * cards.length)] : undefined;
      // O preferido primeiro; se estiver ocupado (o outro mascote já está ali), os outros da seção e os
      // mais próximos dela, até achar um lugar livre.
      const candidatos = [...new Set([sorteado, ...(preferirCards ? cards : []), ...dentro, ...perto.slice(0, 8)])].filter(
        (p): p is Poleiro => p !== undefined,
      );
      if (atual && candidatos[0]?.chave === atual.chave) return;
      let rota: Trajeto | null = null;
      for (const p of candidatos) {
        if (p.chave === atual?.chave) continue;
        rota = planejar(p, agora, "voo") ?? (lugarVago(p, (p.x0 + p.x1) / 2) !== null ? planejar(p, agora, "voo", false) : null);
        if (rota) break;
      }
      if (!rota) return;
      atual = null;
      proximoTrajeto = null;
      iniciarTrajeto(rota, agora);
    };

    // Modo TV: os dois acompanham a seção que está na tela e comentam algo útil sobre ela; a fala fica
    // até a próxima seção.
    const aoMudarSecao = (evento: Event) => {
      const secao = (evento as CustomEvent<HTMLElement | null>).detail;
      emTv = secao !== null;
      secaoAtual += 1;
      if (!secao) {
        calarRef.current();
        proximaFalaEm = performance.now() + sortear(8000, 15000);
        return;
      }
      atualizarPoleiros(performance.now());
      irParaElemento(secao, performance.now(), especie === "coruja");
      const fala = falaDaSecao(secao.dataset.tvChave ?? "", especie);
      const esta = secaoAtual;
      if (fala) window.setTimeout(() => esta === secaoAtual && dizerRef.current(fala, true), especie === "corvo" ? 1200 : 1700);
    };
    // Tutorial: voa até a parte explicada e diz o nome dela.
    // Tutorial: os dois pousam na borda de cima da parte explicada (o corvo à direita, a coruja à
    // esquerda, se couber) e cada um comenta; a coruja fala logo depois, para os balões não se atropelarem.
    const pousarNaBorda = (alvo: Element, agora: number) => {
      const ref = pai.getBoundingClientRect();
      const r = alvo.getBoundingClientRect();
      const x0 = r.left - ref.left;
      const x1 = r.right - ref.left;
      if (especie === "coruja" && x1 - x0 < 240) {
        // Sem espaço para os dois na borda: ela vem para um poleiro à vista perto da parte explicada.
        vemPraPerto({ x: (x0 + x1) / 2, y: r.top - ref.top }, agora);
        return;
      }
      // Longe dos cantos da tela, para o bicho e o balão aparecerem inteiros.
      const telaX0 = -ref.left + 90;
      const telaX1 = -ref.left + window.innerWidth - 90;
      const fimX = limitar(especie === "corvo" ? x1 - Math.min(52, (x1 - x0) / 2) : x0 + 52, Math.max(x0 + 6, telaX0), Math.min(x1 - 6, telaX1));
      const borda: Poleiro = { chave: `borda:${especie}`, x0: x0 + 6, x1: x1 - 6, y: r.top - ref.top, letra: false };
      const rota = planejar(borda, agora, "voo", true, fimX) ?? planejar(borda, agora, "voo", false, fimX);
      if (!rota) return;
      atual = null;
      proximoTrajeto = null;
      iniciarTrajeto(rota, agora);
    };
    /** Voa para o poleiro à vista mais perto de um ponto (se já não estiver num poleiro à vista ali). */
    const vemPraPerto = (ponto: Ponto, agora: number) => {
      const ref = pai.getBoundingClientRect();
      const distancia = (p: Poleiro) => Math.hypot((p.x0 + p.x1) / 2 - ponto.x, p.y - ponto.y);
      const vistos = poleiros.filter((p) => visivel(p, ref) && !p.chave.startsWith("borda:")).sort((a, b) => distancia(a) - distancia(b));
      const destino = vistos.find((p) => p.chave !== atual?.chave);
      if (!destino || (atual && visivel(atual, ref) && distancia(atual) < 260)) return;
      const rota = planejar(destino, agora, "voo") ?? planejar(destino, agora, "voo", false);
      if (!rota) return;
      atual = null;
      proximoTrajeto = null;
      iniciarTrajeto(rota, agora);
    };
    const aoMudarPassoTutorial = (evento: Event) => {
      const passo = (evento as CustomEvent<PassoTutorial | null>).detail;
      emTutorial = passo !== null;
      passoAtual += 1;
      if (!passo) {
        calarRef.current();
        // Acabou o tutorial: um tempo de silêncio antes de voltar a falar sozinho.
        proximaFalaEm = performance.now() + sortear(8000, 15000);
        return;
      }
      const alvo = passo.alvo;
      if (alvo && !alvo.closest("header") && !alvo.closest("[data-corvo], [data-coruja]")) {
        pousarNaBorda(alvo, performance.now());
      } else if (!alvo?.closest("[data-corvo], [data-coruja]")) {
        // Botões do header: comenta de um poleiro à vista, perto do topo da tela.
        const ref = pai.getBoundingClientRect();
        vemPraPerto({ x: -ref.left + window.innerWidth * (especie === "corvo" ? 0.7 : 0.3), y: -ref.top + 200 }, performance.now());
      }
      const fala = especie === "corvo" ? passo.corvo : passo.coruja;
      // A coruja fala logo depois do corvo (só para os balões não nascerem juntos); as falas ficam até
      // mudar de passo.
      const este = passoAtual;
      if (fala) window.setTimeout(() => este === passoAtual && dizerRef.current(fala, true), especie === "corvo" ? 0 : 250);
      // Nos chaveiros, o Muninn faz o que manda: bica e puxa o chaveiro mais perto, que bate no vizinho.
      if (especie === "corvo" && alvo?.matches("svg[data-chaveiro]")) {
        window.setTimeout(() => {
          if (este !== passoAtual) return;
          const ref = pai.getBoundingClientRect();
          const bico = { x: ref.left + x + direcao * 20, y: ref.top + y };
          const chaveiros = [...document.querySelectorAll("svg[data-chaveiro]")];
          const perto = chaveiros
            .map((svg) => ({ svg, r: svg.querySelector("g.cursor-grab")?.getBoundingClientRect() ?? svg.getBoundingClientRect() }))
            .sort((a, b) => Math.hypot(a.r.x - bico.x, a.r.y - bico.y) - Math.hypot(b.r.x - bico.x, b.r.y - bico.y))[0];
          if (!perto) return;
          bicadaAte = performance.now() + 420;
          avisar(EVENTO_PUXAR_CHAVEIRO, perto.svg);
        }, 2300);
      }
    };
    const aoMoverMouse = (evento: PointerEvent) => {
      if (evento.pointerType !== "mouse") return;
      const agora = performance.now();
      const v = mouse ? (Math.hypot(evento.clientX - mouse.cx, evento.clientY - mouse.cy) / Math.max(8, agora - mouse.movidoEm)) * 1000 : 0;
      mouse = { cx: evento.clientX, cy: evento.clientY, vel: mouse ? mouse.vel * 0.5 + v * 0.5 : 0, movidoEm: agora };
      curiosoFeito = false;
    };
    // Os dois guiam o tutorial e acompanham o modo TV.
    window.addEventListener(EVENTO_TUTORIAL, aoMudarPassoTutorial);
    window.addEventListener(EVENTO_TV, aoMudarSecao);
    window.addEventListener("pointermove", aoMoverMouse, { passive: true });

    /** Cursor por perto da cabeça: para onde olhar, se está parado e se está sobre o poleiro dele. */
    const cursorPerto = (ref: DOMRect) => {
      if (!mouse || !atual) return null;
      const cx = mouse.cx - ref.left;
      const cy = mouse.cy - ref.top;
      const dx = cx - x;
      const dy = cy - (y - altura * 0.6);
      if (Math.hypot(dx, dy) > 300) return null;
      return {
        dx,
        angulo: (Math.atan2(dy, Math.abs(dx) + 1) * 180) / Math.PI,
        parado: performance.now() - mouse.movidoEm > 1500,
        noPoleiro: cx >= atual.x0 && cx <= atual.x1 && Math.abs(cy - atual.y) < 90,
      };
    };

    const decidir = (agora: number) => {
      if (!atual || conduzido()) return;
      const outro = rival();
      if (outro?.poleiro && !outro.alvo && agora > proximaImplicancia && Math.hypot(outro.x - x, outro.y - y) < 1200) {
        proximaImplicancia = agora + (especie === "coruja" ? sortear(90000, 150000) : sortear(40000, 80000));
        // Pousa do lado do outro, a uma distância de respeito (se couber no poleiro).
        const p = outro.poleiro;
        const fimX = [outro.x - DISTANCIA, outro.x + DISTANCIA].find((v) => v >= p.x0 && v <= p.x1);
        const rota = fimX === undefined ? null : (planejar(p, agora, "voo", true, fimX) ?? planejar(p, agora, "voo", false, fimX));
        if (rota && fimX !== undefined) {
          implicando = true;
          proximoTrajeto = rota;
          virarPara(fimX - x);
          mudar("agachando", agora);
          return;
        }
      }
      // A coruja quase nunca sai do lugar por conta própria (em média, uma vez a cada minuto e meio);
      // quem costuma tirá-la de lá é o Muninn.
      if (especie === "coruja" && Math.random() < 0.88) {
        ate = agora + sortear(9000, 16000);
        return;
      }
      // Nos cards ele anda; nas letras só se empoleira. A coruja não anda: quando muda de lugar, voa.
      if (especie === "corvo" && !atual.letra && atual.x1 - atual.x0 > 90 && Math.random() < 0.35) {
        // Caminhadas curtas: alguns passos para um lado, não a extensão inteira do poleiro.
        const distancia = sortear(40, 140) * (Math.random() < 0.5 ? -1 : 1);
        alvoX = semEncostar(limitar(x + distancia, atual.x0, atual.x1));
        virarPara(alvoX - x);
        mudar("andando", agora);
        return;
      }
      // Passeia pela página inteira, de poleiro em poleiro próximo, sem seguir a área visível.
      // Um poleiro por lugar (um título vale um lugar, não uma letra cada), fora o atual e os últimos
      // visitados, até ~1400 px. Sorteio com peso: perto é mais provável, mas às vezes a distância nem
      // conta, para ele passear pela página em vez de rodar sempre no mesmo canto.
      const porLugar = new Map<string, Poleiro[]>();
      for (const p of poleiros) {
        const lugar = lugarDe(p);
        if (lugar === lugarDe(atual) || recentes.includes(lugar)) continue;
        if (Math.hypot((p.x0 + p.x1) / 2 - x, p.y - y) > 1400) continue;
        porLugar.set(lugar, [...(porLugar.get(lugar) ?? []), p]);
      }
      if (!porLugar.size) recentes = [];
      const sorteados = [...porLugar.values()]
        .map((opcoes) => {
          const p = opcoes[Math.floor(Math.random() * opcoes.length)]!;
          const peso = Math.random() < 0.25 ? 1 : 1 / (1 + Math.hypot((p.x0 + p.x1) / 2 - x, p.y - y) / 350);
          return { p, ordem: Math.random() ** (1 / peso) };
        })
        .sort((a, b) => b.ordem - a.ordem)
        .slice(0, 6);
      // O primeiro sorteado com rota livre: pula para o lado, voa para cima ou para baixo.
      const rota = sorteados
        .map(({ p }) => {
          const centro = (p.x0 + p.x1) / 2;
          const aoLado = Math.abs(p.y - y) <= PULO_MAX_DY && Math.abs(centro - x) <= PULO_MAX_DX;
          return planejar(p, agora, aoLado && especie === "corvo" ? "pulo" : "voo");
        })
        .find((t): t is Trajeto => t !== null);
      if (!rota) {
        ate = agora + sortear(1500, 3000);
        return;
      }
      proximoTrajeto = rota;
      virarPara(rota.pontos[3].x - x);
      mudar("agachando", agora);
    };

    const desenhar = (piscada: number) => {
      el.style.transform = `translate(${x - APOIO_X * escala}px, ${y - CHAO * escala}px)`;
      el.style.opacity = atual || trajeto ? "1" : "0";
      if (especie === "coruja") {
        aplicarCoruja(partesCoruja, {
          voando: pose.asa === "aberta",
          // A pose de voo vem no ângulo de perfil do corvo; de frente, vira subir e descer das asas.
          asa: -55 + (pose.asaAngulo - 20) * 0.8,
          virada,
          inclinacaoCabeca: limitar(pose.cabecaGiro, -14, 14) * 0.8,
          cabecaX: pose.cabecaX,
          cabecaY: pose.cabecaY,
          respiro: pose.corpoY,
          inclinacao: pose.inclinacao,
          piscada,
        });
      } else {
        aplicarPose(partes, pose, espelho, piscada, undefined, cabecaTras);
      }
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

      // Cursor chegando rápido perto do corvo: se assusta e voa (e reclama). A coruja nem pisca.
      if (especie === "corvo" && mouse && atual && !conduzido() && agora > sossegoAte && agora - mouse.movidoEm < 80 && mouse.vel > 1600) {
        const perto = Math.hypot(mouse.cx - ref.left - x, mouse.cy - ref.top - (y - altura * 0.6)) < 110;
        if (perto) {
          espantar(agora);
          sossegoAte = agora + 6000;
        }
      }

      // Chegada: entra voando pela borda esquerda da tela e pousa numa letra visível. Se nenhuma letra
      // aparecer em 1,5 s (fontes ainda carregando, página aberta já rolada), vale qualquer poleiro à vista.
      // A coruja chega alguns segundos depois do corvo, pela direita, e prefere pousar num card.
      if (!chegou && !atual && !trajeto && !proximoTrajeto && agora - comecouEm > (especie === "corvo" ? 0 : 4500)) {
        const vistos = poleiros.filter((p) => visivel(p, ref));
        const preferido = vistos.find((p) =>
          especie === "corvo" ? p.letra : !p.letra && p.chave !== presencas.get("corvo")?.poleiro?.chave,
        );
        const destino = preferido ?? (agora - comecouEm > 1500 ? (vistos[0] ?? poleiros[0]) : undefined);
        if (destino) {
          const fim = { x: lugarVago(destino, sortear(destino.x0, destino.x1)) ?? sortear(destino.x0, destino.x1), y: destino.y };
          const inicio = { x: especie === "corvo" ? -ref.left - 90 : window.innerWidth - ref.left + 90, y: Math.max(fim.y - 240, -ref.top + 60) };
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
          // O corvo bate as asas o voo todo; a coruja bate poucas vezes e plana.
          if (especie === "coruja") alvo = t > 0.9 ? poseFreando(agora) : poseCorujaVoando(agora, inclinacao, t);
          else alvo = t > 0.82 ? poseFreando(agora) : poseVoando(agora, inclinacao);
        }
        if (t >= 1) {
          atual = trajeto.destino;
          ({ x, y } = trajeto.pontos[3]);
          trajeto = null;
          presenca.alvo = null;
          recentes = [lugarDe(atual), ...recentes.filter((l) => l !== lugarDe(atual!))].slice(0, 4);
          mudar("pousando", agora);
          if (implicando) {
            implicando = false;
            provocarEm = agora + 300;
          }
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
          if (bicarAoChegar) {
            bicarAoChegar = false;
            bicadaAte = agora + 350;
          }
        }
      } else if (atual) {
        // Parado: respira, vira a cabeça de vez em quando, às vezes bica o chão ou mexe a cauda.
        alvo = especie === "coruja" ? poseCorujaParada(agora) : poseParada();
        if (especie === "corvo") alvo.corpoY = Math.sin(agora / 700) * 0.4;
        if (!calmo) {
          // Acabou de pousar do lado da coruja: vira para ela, provoca e ela vai embora.
          if (provocarEm && agora > provocarEm) {
            provocarEm = 0;
            const outro = rival();
            if (outro) {
              virarPara(outro.x - x);
              dizerRef.current(provocacao(especie));
              outro.enxotar();
            }
            ate = Math.max(ate, agora + 2500);
          }
          // Ficou encostado no outro no mesmo card: abre espaço andando; se não couber, voa.
          const vizinho = rival();
          if (
            modo === "parado" &&
            !provocarEm &&
            vizinho?.poleiro &&
            Math.abs(vizinho.y - y) < MESMA_ALTURA &&
            !vizinho.alvo &&
            Math.abs(vizinho.x - x) < DISTANCIA - 4
          ) {
            const destinoX = limitar(vizinho.x + (x >= vizinho.x ? 1 : -1) * DISTANCIA, atual.x0, atual.x1);
            if (especie === "corvo" && Math.abs(destinoX - vizinho.x) >= DISTANCIA - 4) {
              alvoX = destinoX;
              virarPara(alvoX - x);
              mudar("andando", agora);
            } else {
              espantar(agora, false);
            }
          }
          // Cursor por perto: olha para ele. Parado ali um tempo: vai até ele e dá uma bicadinha.
          const olhar = cursorPerto(ref);
          if (olhar) {
            // Corvo: com o cursor atrás, vira só a cabeça por cima do ombro; se o cursor ficar lá, vira o corpo.
            if (especie === "corvo" && Math.abs(olhar.dx) > 12 && Math.sign(olhar.dx) !== direcao) {
              if (!atrasDesde) atrasDesde = agora;
              cabecaTrasAlvo = 1;
              if (agora - atrasDesde > 2200) {
                virarPara(olhar.dx);
                cabecaTrasAlvo = 0;
                atrasDesde = 0;
              }
            } else {
              if (Math.abs(olhar.dx) > 12) virarPara(olhar.dx);
              cabecaTrasAlvo = 0;
              atrasDesde = 0;
            }
            giroAlvo = limitar(olhar.angulo * 0.6, -24, 34);
            proximoGiro = agora + 500;
            if (olhar.parado && !curiosoFeito && !conduzido() && especie === "corvo") {
              curiosoFeito = true;
              if (Math.abs(olhar.dx) > 34 && olhar.noPoleiro && !atual.letra) {
                alvoX = semEncostar(limitar(x + olhar.dx - Math.sign(olhar.dx) * 24, atual.x0, atual.x1));
                bicarAoChegar = true;
                mudar("andando", agora);
              } else {
                bicadaAte = agora + 320;
              }
            }
          }
          if (!olhar) {
            cabecaTrasAlvo = 0;
            atrasDesde = 0;
          }
          if (agora > proximoGiro) {
            giroAlvo = sortear(-14, 10);
            proximoGiro = agora + sortear(900, 2800);
            if (especie === "corvo" && Math.random() < 0.18) bicadaAte = agora + 320;
            if (Math.random() < 0.2) caudaAte = agora + 260;
          }
          // A coruja vira a cabeça devagar, de propósito; o corvo, de estalo.
          giroCabeca += (giroAlvo - giroCabeca) * Math.min(1, dt * (especie === "coruja" ? 2.5 : 8));
          alvo.cabecaGiro = agora < bicadaAte ? 42 : giroCabeca;
          if (agora < bicadaAte) alvo.cabecaX = 2.5;
          alvo.cauda = agora < caudaAte ? -12 : 0;
          if (especie === "coruja") {
            if (agora > proximoBalanco) {
              balancoAte = agora + 900;
              proximoBalanco = agora + sortear(7000, 14000);
            }
            if (agora < balancoAte) alvo.cabecaX = Math.sin((balancoAte - agora) / 75) * 2.6;
            alvo.cauda = 0;
          }
          if (agora > proximaFalaEm && !falando.current && !emTutorial && visivel(atual, ref)) {
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
      if (especie === "coruja") {
        // Só a cabeça se mexe: acompanha o cursor, olha para o rival por perto e às vezes gira para trás.
        const parada = atual !== null && !trajeto;
        if (parada && !calmo && agora > proximoOlharTras) {
          olharTrasAte = agora + 1900;
          ladoTras = Math.random() < 0.5 ? -1 : 1;
          proximoOlharTras = agora + sortear(14000, 26000);
        }
        const olhar = parada ? cursorPerto(ref) : null;
        const outro = rival();
        let alvoVirada = 0;
        if (agora < olharTrasAte) alvoVirada = ladoTras;
        else if (olhar) alvoVirada = limitar(olhar.dx / 220, -0.7, 0.7);
        else if (outro && parada && Math.abs(outro.y - y) < 160 && Math.abs(outro.x - x) < 320) {
          alvoVirada = limitar((outro.x - x) / 200, -0.7, 0.7);
        }
        virada += (alvoVirada - virada) * Math.min(1, dt * 2.6);
      }
      if (modo !== "parado") {
        cabecaTrasAlvo = 0;
        atrasDesde = 0;
      }
      cabecaTras += (cabecaTrasAlvo - cabecaTras) * Math.min(1, dt * 7);
      espelho += (direcao - espelho) * Math.min(1, dt * 10);
      // O balão de fala nunca sai da tela: desliza para dentro e, sem espaço em cima, passa para baixo.
      const b = bolha.current;
      if (b) {
        b.style.transform = "";
        const r = b.getBoundingClientRect();
        let dx = r.left < 8 ? 8 - r.left : r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : 0;
        let dy = r.top < 8 ? r.height + altura + 6 : 0;
        // Os dois perto um do outro: o balão da coruja desvia do balão do corvo (para baixo dela e,
        // se ainda bater, para o lado), para as duas falas ficarem legíveis.
        const doOutro = especie === "coruja" ? rival()?.balao : null;
        if (doOutro) {
          const bate = (ox: number, oy: number) =>
            r.left + ox < doOutro.right + 6 && r.right + ox > doOutro.left - 6 && r.top + oy < doOutro.bottom + 6 && r.bottom + oy > doOutro.top - 6;
          if (bate(dx, dy)) dy = r.height + altura + 6;
          if (bate(dx, dy)) {
            const paraEsquerda = r.left + r.width / 2 < doOutro.left + doOutro.width / 2;
            dx = paraEsquerda ? doOutro.left - 8 - r.right : doOutro.right + 8 - r.left;
          }
        }
        if (dx || dy) b.style.transform = `translate(${dx}px, ${dy}px)`;
        presenca.balao = new DOMRect(r.left + dx, r.top + dy, r.width, r.height);
      } else {
        presenca.balao = null;
      }
      presenca.x = x;
      presenca.y = y;
      presenca.poleiro = atual;
      desenhar(Math.max(0, piscando));
      quadro = requestAnimationFrame(passo);
    };

    const aoRedimensionar = () => (atualizadoEm = -Infinity);
    window.addEventListener("resize", aoRedimensionar);
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      presencas.delete(especie);
      window.removeEventListener(EVENTO_POLEIRO_MEXIDO, aoMexerNoPoleiro);
      window.removeEventListener(EVENTO_TV, aoMudarSecao);
      window.removeEventListener(EVENTO_TUTORIAL, aoMudarPassoTutorial);
      window.removeEventListener("pointermove", aoMoverMouse);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, []);

  useEffect(() => {
    if (!fala) return;
    falando.current = true;
    if (falaFixa.current) return;
    const t = setTimeout(() => {
      setFala(null);
      falando.current = false;
    }, 5000);
    return () => clearTimeout(t);
  }, [fala]);

  /**
   * Grasna e fala: na primeira vez, a saudação da visita; depois, metade das vezes um dado do dia (sem
   * repetir o último) e metade uma dica de mercado.
   */
  function falar() {
    grasnandoDesde.current = performance.now();
    if (especie === "coruja") {
      setFala(falaDaCoruja());
      return;
    }
    if (saudacaoRef.current) {
      setFala(saudacaoRef.current());
      saudacaoRef.current = null;
      marcarSaudacaoDita();
      return;
    }
    if (!linhas.length || Math.random() < 0.5) {
      setFala(dicaAleatoria());
      return;
    }
    let indice = Math.floor(Math.random() * linhas.length);
    if (indice === ultimaLinha.current) indice = (indice + 1) % linhas.length;
    ultimaLinha.current = indice;
    setFala(linhas[indice]!);
  }

  function dizer(texto: string, fixa = false) {
    grasnandoDesde.current = performance.now();
    falaFixa.current = fixa;
    setFala(texto);
  }
  dizerRef.current = dizer;
  calarRef.current = () => {
    falaFixa.current = false;
    falando.current = false;
    setFala(null);
  };
  falarRef.current = falar;

  // Espantado (tiraram o poleiro dele): grasna e reclama com um balão curto, sem tocar som.
  function reclamar() {
    grasnandoDesde.current = performance.now();
    setFala(queixa(especie));
  }
  reclamarRef.current = reclamar;

  const aoClicar = falar;

  return (
    <div
      ref={raiz}
      className={`pointer-events-none absolute top-0 left-0 ${guiando ? "z-[110]" : "z-30"} opacity-0 transition-opacity duration-300 select-none`}
      style={{ width: largura, height: altura }}
    >
      {fala && (
        <p
          ref={bolha}
          role="status"
          className="absolute bottom-full left-1/2 mb-1 w-max max-w-64 -translate-x-1/2 rounded-lg border border-borda bg-painel px-3 py-2 font-mono text-[11px] leading-snug text-texto shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
        >
          {fala}
        </p>
      )}
      {especie === "corvo" ? (
        <CorvoSvg partes={partes} largura={largura} altura={altura} aoClicar={aoClicar} />
      ) : (
        <CorujaSvg partes={partesCoruja} largura={largura} altura={altura} aoClicar={aoClicar} />
      )}
    </div>
  );
}
