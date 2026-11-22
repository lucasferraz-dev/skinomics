// Jogos da Steam que o Skinomics conhece, pelo appid. O site é do Mercado da Steam como um todo:
// o jogo é uma informação de cada item. Para um jogo novo, basta acrescentar uma entrada.

export type Jogo = { sigla: string; nome: string; cor: string };

export const JOGOS: Record<number, Jogo> = {
  440: { sigla: "TF2", nome: "Team Fortress 2", cor: "#ff8c42" },
  730: { sigla: "CS2", nome: "Counter-Strike 2", cor: "#f0b232" },
  252490: { sigla: "RUST", nome: "Rust", cor: "#ce422b" },
};

export function jogoDoItem(appid: number | undefined): Jogo | undefined {
  return appid === undefined ? undefined : JOGOS[appid];
}
