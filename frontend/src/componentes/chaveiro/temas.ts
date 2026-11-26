// Temas dos chaveiros: cada item ganha o chaveiro do jogo (pelo appid da Steam) e chaveiros que
// dizem o que ele é (caixa, chave, presente...; no CS2, rifle, pistola, faca...) e, se for o caso,
// de que evento ou qualidade é (Halloween, Unusual...; no CS2, StatTrak e o desgaste). Os ícones são
// desenhados em traço, centrados em (0, 0), cabendo num círculo de raio ~10.

import { jogoDoItem } from "../../lib/jogos";

const CS2 = 730;

export type TemaChaveiro = {
  nome: string;
  cor: string;
  icone: string; // caminho SVG em traço
  texto?: string; // no lugar do ícone (a sigla do jogo)
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
    // Abóbora de Halloween: olhos triangulares e sorriso cortado em zigue-zague.
    icone:
      "M0 -5c-6.4 0-9.4 3.8-9.4 7s3.2 6.8 9.4 6.8 9.4 -3.6 9.4 -6.8-3 -7-9.4 -7z" +
      "M0 -5v-3.2l2.4 -1.6" +
      "M-5.4 1.2 -3.6 -1.8 -1.8 1.2zM1.8 1.2 3.6 -1.8 5.4 1.2z" +
      "M-5.8 3.6 -4 5.6-2.4 4.4-.8 6.2.8 4.4 2.4 6.2 4 4.4 5.8 3.6",
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

// Barras do desgaste do CS2: quanto mais nova a skin, mais barras (5 na Factory New, 1 na Battle-Scarred).
const barras = (quantas: number) =>
  Array.from({ length: quantas }, (_, i) => `M${-6 + i * 3} 5.5v${-(3 + i * 2.2)}`).join("") + "M-7.5 5.5h15";

// Chaveiros só do CS2: o que a arma é, o desgaste e as versões especiais.
const CS = {
  rifle: {
    nome: "Rifle",
    cor: "#ff6b5b",
    icone: "M2 -2h8M-7 -3.5h9v3.5h-9zM-7 -3l-3 1.2v3.4l3 -1.1M-1 0l1.2 4.4h2l-1 -4.4M-4.6 0l-1 3.6h1.8l1 -3.6",
  },
  sniper: {
    nome: "Sniper",
    cor: "#8fd6ff",
    icone: "M-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0M0 -10v5M0 5v5M-10 0h5M5 0h5M-.9 0a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0",
  },
  pistola: {
    nome: "Pistola",
    cor: "#ebc65a",
    icone: "M-8 -4.5h13v3.5h-6.5l-1.8 6.5h-3.4l1.6 -6.5h-2.9zM5 -4.5h3v2.2h-3M-1.3 -1l.6 2.4h1.8",
  },
  smg: {
    nome: "SMG",
    cor: "#b48cff",
    icone: "M-8 -3.5h14v3h-14zM6 -2.5h3M-2 -.5v5.5h2v-5.5M-6 -.5l-1 3.2h1.8l1 -3.2M-8 -3h-2v2.5h2",
  },
  pesada: {
    nome: "Pesada",
    cor: "#f2a65a",
    icone: "M-1 -3.5h11M-1 -1h11M2 .6h5v1.8h-5zM-8 -4h7v4.5h-7zM-8 -3.5l-2.5 1.5v3l2.5 -1",
  },
  faca: {
    nome: "Faca",
    cor: "#e9ece7",
    icone: "M-1.2 1.2l8.7 -8.7c.6 3.8-2.2 7.3-6.2 9.2zM-3.6 .4l4.2 4.2M-1.6 2.6l-5.6 5.6c-.8 .8-2.2 -.6-1.4 -1.4l5.6 -5.6",
  },
  luvas: {
    nome: "Luvas",
    cor: "#7fd6c2",
    icone: "M-5 9v-9c0-2 0-6 2.5-6s2.5 2 2.5 4v-2c0-2 4-2 4 0v3l2 -1.5c1.5-1 3 .5 2 2l-4 4.5v5z",
  },
  adesivo: {
    nome: "Adesivo",
    cor: "#ff8fc8",
    icone: "M-7 -8h11l4 4v11c0 1-1 2-2 2h-13c-1 0-2 -1-2 -2v-13c0-1 1-2 2-2zM4 -8v4h4",
  },
  capsula: {
    nome: "Cápsula",
    cor: "#e0a868",
    icone: "M-8 0a4.5 4.5 0 0 1 4.5 -4.5h7a4.5 4.5 0 0 1 0 9h-7a4.5 4.5 0 0 1 -4.5 -4.5zM-.5 -4.5v9",
  },
  stattrak: {
    nome: "StatTrak",
    cor: "#cf6a32",
    icone: "M-9 -5h18v10h-18zM-6 -2v4M-3 -2h2v4h-2zM2 -2h2v2h-2v2h2",
  },
  souvenir: {
    nome: "Souvenir",
    cor: "#ffd700",
    icone: "M-5 -9h10v4a5 5 0 0 1 -10 0zM-5 -7h-3c0 3 1.5 4.5 3.5 4.5M5 -7h3c0 3-1.5 4.5-3.5 4.5M0 0v4M-4 8h8M-2.5 4h5v4h-5z",
  },
  fn: { nome: "Factory New", cor: "#7fd6c2", icone: barras(5) },
  mw: { nome: "Minimal Wear", cor: "#a3e36b", icone: barras(4) },
  ft: { nome: "Field-Tested", cor: "#ebc65a", icone: barras(3) },
  ww: { nome: "Well-Worn", cor: "#f2a65a", icone: barras(2) },
  bs: { nome: "Battle-Scarred", cor: "#f2876b", icone: barras(1) },
} satisfies Record<string, TemaChaveiro>;

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

// No CS2 o nome é "Arma | Skin (Desgaste)"; facas e luvas começam com ★.
// A arma é o que vem antes do " | " (depois de StatTrak™ ou Souvenir, se houver): casar só ali evita
// confundir com o nome da skin. Facas e luvas começam com ★.
const arma = (nomes: string) => new RegExp(`^(stattrak™ |souvenir )?(${nomes}) \\|`);
const TIPOS_CS2: [RegExp, TemaChaveiro][] = [
  [/^(stattrak™ )?★ .*(gloves|hand wraps)/, CS.luvas],
  [/^(stattrak™ )?★ /, CS.faca],
  [/capsule$/, CS.capsula],
  [/^sticker \|/, CS.adesivo],
  [/ case$|souvenir package$/, T.caixa],
  [arma("awp|ssg 08|scar-20|g3sg1"), CS.sniper],
  [arma("ak-47|m4a4|m4a1-s|aug|sg 553|famas|galil ar"), CS.rifle],
  [arma("glock-18|usp-s|p2000|desert eagle|p250|five-seven|tec-9|cz75-auto|dual berettas|r8 revolver"), CS.pistola],
  [arma("mp9|mac-10|mp7|mp5-sd|ump-45|p90|pp-bizon"), CS.smg],
  [arma("nova|xm1014|mag-7|sawed-off|m249|negev"), CS.pesada],
];

const TEMAS_CS2: [RegExp, TemaChaveiro][] = [
  [/stattrak/, CS.stattrak],
  [/^souvenir/, CS.souvenir],
  [/\(factory new\)/, CS.fn],
  [/\(minimal wear\)/, CS.mw],
  [/\(field-tested\)/, CS.ft],
  [/\(well-worn\)/, CS.ww],
  [/\(battle-scarred\)/, CS.bs],
];

const TEMAS: [RegExp, TemaChaveiro][] = [
  [/scream fortress|spooky|haunted|spectral|bone-chilling|terrifying|hallowe/, T.halloween],
  [/winter|smissmas|naughty|nice winter/, T.inverno],
  [/summer/, T.verao],
  [/war paint/, T.pintura],
  [/^unusual/, T.unusual],
  [/^strange/, T.strange],
];

/**
 * O que o item é (caixa, ferramenta, peça de robô...), pelo nome e pelo tipo. A Steam deixa o `tipo` vazio
 * na maioria dos itens, então os filtros do Explorar usam esta categoria, a mesma do chaveiro.
 */
export function categoriaDoItem(item: { nome: string; tipo?: string | null; appid?: number }): TemaChaveiro | undefined {
  const texto = `${item.nome} ${item.tipo ?? ""}`.toLowerCase().trim();
  return (item.appid === CS2 ? TIPOS_CS2 : TIPOS).find(([regra]) => regra.test(texto))?.[1];
}

/** Chaveiros do item: primeiro o do jogo; depois até três com o que ele é, o evento e a qualidade. */
export function temasDoItem(
  item: { appid: number; nome: string; tipo?: string | null } | undefined,
): TemaChaveiro[] {
  if (!item) return [];
  const texto = `${item.nome} ${item.tipo ?? ""}`.toLowerCase().trim();
  const tipo = categoriaDoItem(item);
  const extras = (item.appid === CS2 ? TEMAS_CS2 : TEMAS).filter(([regra]) => regra.test(texto)).map(([, tema]) => tema);
  const doItem = [tipo, ...extras].filter((t): t is TemaChaveiro => Boolean(t)).slice(0, 3);
  // O chaveiro do jogo (pela lista de jogos do site) vem sempre primeiro.
  const jogo = jogoDoItem(item.appid);
  return jogo ? [{ nome: jogo.nome, cor: jogo.cor, icone: "", texto: jogo.sigla }, ...doItem] : doItem;
}
