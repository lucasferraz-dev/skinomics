// Temas dos chaveiros: cada item ganha o chaveiro do jogo (pelo appid da Steam) e chaveiros que
// dizem o que ele é (caixa, chave, presente...) e, se for o caso, de que evento ou qualidade é
// (Halloween, inverno, Unusual...). Os ícones são
// desenhados em traço, centrados em (0, 0), cabendo num círculo de raio ~10.

export type TemaChaveiro = {
  nome: string;
  cor: string;
  icone: string; // caminho SVG em traço
  texto?: string; // no lugar do ícone (o padrão "TF2")
};

const T = {
  caixa: {
    nome: "Caixa",
    cor: "#e0a868",
    icone: "M-8 -5.5h16v13h-16zM-8 -1.5h16M-3 -1.5v9M3 -1.5v9M-1.6 -3.6h3.2v3.2h-3.2z",
  },
  chave: {
    nome: "Chave",
    cor: "#ebc65a",
    icone: "M-9.5 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M-1.5 0h11M5 0v3.2M8 0v3.2M-6.8 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0",
  },
  presente: {
    nome: "Presente",
    cor: "#ff6b6b",
    icone: "M-7.5 -2h15v10h-15zM-9 -5.5h18v3.5h-18zM0 -5.5v13.5M0 -5.5c-1.6 -3.6-6 -4.2-6 -1.6 0 1.8 3.6 1.6 6 1.6 2.4 0 6 .2 6 -1.6 0 -2.6-4.4 -2-6 1.6",
  },
  pacote: {
    nome: "Pacote",
    cor: "#e0a868",
    icone: "M-7 -3.5h14l-1.2 12.5h-11.6zM-3.2 -3.5v-2.2a3.2 3.2 0 0 1 6.4 0v2.2",
  },
  robo: {
    nome: "Peça de robô",
    cor: "#7fd6c2",
    icone:
      "M-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0M-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0" +
      "M0 -6.5v-3M0 6.5v3M-6.5 0h-3M6.5 0h3M-4.6 -4.6l-2.1 -2.1M4.6 4.6l2.1 2.1M-4.6 4.6l-2.1 2.1M4.6 -4.6l2.1 -2.1",
  },
  ferramenta: {
    nome: "Ferramenta",
    cor: "#c6f36b",
    icone: "M4.5 -9.2a5 5 0 0 0-4.4 6.8l-8.6 8.6 2.3 2.3 8.6 -8.6a5 5 0 0 0 6.8 -4.4l-3.2 1.2-2.4 -2.4z",
  },
  chapeu: {
    nome: "Chapéu",
    cor: "#e9ece7",
    icone: "M-9.5 5.5h19M-6 5.5v-12.5h12v12.5M-6 1.5h12",
  },
  arma: {
    nome: "Arma",
    cor: "#ff6b5b",
    icone: "M-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0M0 -10v5M0 5v5M-10 0h5M5 0h5M-.9 0a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0",
  },
  halloween: {
    nome: "Halloween",
    cor: "#ff7b1c",
    icone:
      "M0 -4.5c-6.2 0-9 3.6-9 6.6s3 6.4 9 6.4 9 -3.4 9 -6.4-2.8 -6.6-9 -6.6z" +
      "M0 -4.5c-2.4 0-3.4 4-3.4 6.6s1 6.4 3.4 6.4M0 -4.5c2.4 0 3.4 4 3.4 6.6s-1 6.4-3.4 6.4M0 -4.5v-3.5l2.4 -1.6",
  },
  inverno: {
    nome: "Inverno",
    cor: "#8fd6ff",
    icone:
      "M0 -9.5v19M-8.2 -4.75l16.4 9.5M-8.2 4.75l16.4 -9.5" +
      "M-2.2 -7.6 0 -5.4 2.2 -7.6M-2.2 7.6 0 5.4 2.2 7.6M-7.6 -1.2l3 .4-1.2 2.8M7.6 1.2l-3 -.4 1.2 -2.8M-5.4 5.6l1.2 -2.8 3 .4M5.4 -5.6l-1.2 2.8-3 -.4",
  },
  verao: {
    nome: "Verão",
    cor: "#ffcf48",
    icone:
      "M-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M0 -9.5v3M0 6.5v3M-9.5 0h3M6.5 0h3M-6.7 -6.7l2.1 2.1M4.6 4.6l2.1 2.1M-6.7 6.7l2.1 -2.1M4.6 -4.6l2.1 -2.1",
  },
  pintura: {
    nome: "War Paint",
    cor: "#b48cff",
    icone: "M3.6 -9.6l5.6 5.6-7.4 7.4-5.6 -5.6zM-3.8 -2.2l-2.6 2.6c-2.4 2.4-4.4 1.2-4.4 5 3.8 0 5 -2 7.4 -4.4l2.6 -2.6",
  },
  unusual: {
    nome: "Unusual",
    cor: "#c084fc",
    icone: "M0 -9.5 2.2 -2.2 9.5 0 2.2 2.2 0 9.5-2.2 2.2-9.5 0-2.2 -2.2zM6.5 -8.5l.8 2 2 .8-2 .8-.8 2-.8 -2-2 -.8 2 -.8z",
  },
  strange: {
    nome: "Strange",
    cor: "#ff8c42",
    icone: "M-8 -6.5v13M-4 -6.5v13M0 -6.5v13M4 -6.5v13M-9.5 4.5l15 -9M7.5 -6.5v13",
  },
} satisfies Record<string, TemaChaveiro>;

/** Chaveiro de cada jogo, pelo appid da Steam. Para um jogo novo, basta acrescentar uma entrada. */
const JOGOS: Record<number, TemaChaveiro> = {
  440: { nome: "Team Fortress 2", cor: "#ff8c42", icone: "", texto: "TF2" },
  730: { nome: "Counter-Strike 2", cor: "#f0b232", icone: "", texto: "CS2" },
  252490: { nome: "Rust", cor: "#ce422b", icone: "", texto: "RUST" },
};

const TIPOS: [RegExp, TemaChaveiro][] = [
  [/\bkey\b/, T.chave],
  [/robot/, T.robo],
  [/case|crate|munition|stash|trove|bonanza|hoard/, T.caixa],
  [/gift|saxton/, T.presente],
  [/package/, T.pacote],
  [/lugermorph|giger counter|pistol|rifle|launcher|shotgun|scattergun/, T.arma],
  [/\bhat\b|helm|\bcap\b|beanie|crown/, T.chapeu],
  [/tool|\btag\b/, T.ferramenta],
];

const TEMAS: [RegExp, TemaChaveiro][] = [
  [/scream fortress|spooky|haunted|spectral|bone-chilling|terrifying|hallowe/, T.halloween],
  [/winter|smissmas|naughty|nice winter/, T.inverno],
  [/summer/, T.verao],
  [/war paint/, T.pintura],
  [/^unusual/, T.unusual],
  [/^strange/, T.strange],
];

/** Chaveiros do item: primeiro o do jogo; depois até três com o que ele é, o evento e a qualidade. */
export function temasDoItem(
  item: { appid: number; nome: string; tipo?: string | null } | undefined,
): TemaChaveiro[] {
  if (!item) return [];
  const texto = `${item.nome} ${item.tipo ?? ""}`.toLowerCase();
  const tipo = TIPOS.find(([regra]) => regra.test(texto))?.[1];
  const extras = TEMAS.filter(([regra]) => regra.test(texto)).map(([, tema]) => tema);
  const doItem = [tipo, ...extras].filter((t): t is TemaChaveiro => Boolean(t)).slice(0, 3);
  const jogo = JOGOS[item.appid];
  return jogo ? [jogo, ...doItem] : doItem;
}
