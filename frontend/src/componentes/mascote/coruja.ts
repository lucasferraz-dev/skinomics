import { CHAO, type Pose, poseParada } from "./corvo";

// Poses próprias da Glaux: ela não é um corvo com outra roupa.

const limitar01 = (v: number) => Math.min(Math.max(v, 0), 1);

/** Imóvel, respirando devagar: só a cabeça se mexe (ver Mascote). */
export function poseCorujaParada(tempo: number): Pose {
  return {
    ...poseParada(),
    corpoY: Math.sin(tempo / 1300) * 0.3,
    cabecaY: 0.4,
  };
}

/**
 * Voo de coruja: poucas batidas largas e lentas para decolar, depois plana de asas abertas e quase
 * paradas, e volta a bater só para frear. `t` é o progresso do voo (0 a 1).
 */
export function poseCorujaVoando(tempo: number, inclinacao: number, t: number): Pose {
  const batida = Math.sin(tempo / 95);
  const bater = 20 + 100 * (batida * 0.5 + 0.5);
  const planar = 74 + Math.sin(tempo / 420) * 4;
  // 0 = batendo, 1 = planando; passa de um para o outro sem tranco.
  const planando = limitar01((t - 0.22) / 0.12) * limitar01((0.86 - t) / 0.08);
  const angulo = bater + (planar - bater) * planando;
  return {
    ...poseParada(),
    corpoY: -batida * 2 * (1 - planando),
    inclinacao: inclinacao * 0.6,
    cabecaX: 1,
    cabecaGiro: -inclinacao * 0.3,
    // Garras para baixo e para frente, prontas.
    pes: [
      { x: 60, y: CHAO - 7, fechado: 0.8 },
      { x: 56, y: CHAO - 8, fechado: 0.8 },
    ],
    asa: "aberta",
    asaAngulo: angulo,
    asaLonge: angulo + 8,
    cauda: -4,
  };
}
