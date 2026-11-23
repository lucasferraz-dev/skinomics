import { t } from "../../lib/idioma";
/**
 * Passos do "Como usar" de cada página. Cada passo destaca o que o seletor `alvo` encontrar (se forem
 * vários elementos, a área que cobre todos). Para ensinar um botão novo, basta marcar o elemento com
 * `data-tour="..."` e acrescentar o passo aqui, na ordem em que ele aparece na tela.
 */
export type Passo = { alvo: string; titulo: string; texto: string };

const INICIO: Passo[] = [
  {
    alvo: "[data-tour='vitrine']",
    get titulo() {
      return t("Item em destaque", "Featured item");
    },
    get texto() {
      return t("Um item do Mercado da Steam sorteado a cada visita, com o preço de hoje e a variação da semana. A medalha no canto diz por que ele apareceu. Use \"Outro item\" para sortear outro.", "A Steam Market item drawn on each visit, with today's price and the week's change. The medal in the corner says why it showed up. Use \"Another item\" to draw another.");
    },
  },
  {
    // O svg do chaveiro é só a fixação; as argolas e os pingentes ficam nos grupos arrastáveis.
    alvo: "[data-tour='vitrine-area'] svg[data-chaveiro], [data-tour='vitrine-area'] svg[data-chaveiro] g.cursor-grab",
    get titulo() {
      return t("Chaveiros", "Keychains");
    },
    get texto() {
      return t("Dizem o que o item é: o jogo, o tipo e, quando houver, o evento e a qualidade. Dá para pegar e arrastar; eles batem uns nos outros.", "They tell what the item is: the game, the type and, when there is one, the event and quality. You can grab and drag them; they bump into each other.");
    },
  },
  {
    alvo: "[data-tour='adesivos']",
    get titulo() {
      return t("Números da plataforma", "Platform numbers");
    },
    get texto() {
      return t("Itens monitorados, data da última cotação, oportunidades e horizontes de previsão. Puxe a ponta de um adesivo para descolar e ver um detalhe a mais.", "Items tracked, date of the last quote, opportunities and forecast horizons. Pull a sticker's corner to peel it and see one more detail.");
    },
  },
  {
    alvo: "[data-tour='previa']",
    get titulo() {
      return t("Histórico e previsão", "History and forecast");
    },
    get texto() {
      return t("É assim que cada item aparece no Terminal: o preço diário dos últimos meses e a previsão dos próximos 7 dias, com a faixa onde o preço deve ficar.", "This is how each item looks in the Terminal: the daily price over recent months and the 7-day forecast, with the range where the price should land.");
    },
  },
  {
    alvo: "[data-tour='radar']",
    get titulo() {
      return t("Mais negociados", "Most traded");
    },
    get texto() {
      return t("Os itens com mais vendas na semana, com preço, variação e tendência. Clique numa linha para abrir o item.", "The items with the most sales this week, with price, change and trend. Click a row to open the item.");
    },
  },
  {
    alvo: "[data-tour='destaques']",
    get titulo() {
      return t("Destaques da semana", "Weekly highlights");
    },
    get texto() {
      return t("Maior alta, maior queda, mais vendido e melhor margem prevista. Cada terminal abre a página do item.", "Biggest rise, biggest drop, most traded and best forecast margin. Each terminal opens the item's page.");
    },
  },
  {
    alvo: "[data-tour='transparencia']",
    get titulo() {
      return t("De onde vêm os números", "Where the numbers come from");
    },
    get texto() {
      return t("A fonte dos dados, a qualidade atual do modelo (medida em dados que ele não viu no treino) e o que a plataforma não faz.", "The data source, the model's current quality (measured on data it didn't see in training) and what the platform doesn't do.");
    },
  },
  {
    alvo: "svg[data-corvo]",
    get titulo() {
      return t("O corvo", "The crow");
    },
    get texto() {
      return t("O mascote do Skinomics. Anda pelos cards, voa entre as seções e de vez em quando conta algo sobre o mercado. Clique nele para ouvir.", "Skinomics' mascot. It walks on the cards, flies between sections and now and then says something about the market. Click it to hear.");
    },
  },
  {
    alvo: "svg[data-coruja]",
    get titulo() {
      return t("A coruja", "The owl");
    },
    get texto() {
      return t(
        "A analista. Fala pouco, quase sempre sobre previsão, e vira a cabeça para acompanhar o cursor. O corvo vive implicando com ela.",
        "The analyst. Talks little, mostly about forecasts, and turns her head to follow your cursor. The crow keeps pestering her.",
      );
    },
  },
  {
    alvo: "[data-tour='faq']",
    get titulo() {
      return t("Perguntas frequentes", "FAQ");
    },
    get texto() {
      return t("Leva direto às dúvidas mais comuns: se precisa de conta Steam, de quanto em quanto tempo os preços mudam, se as previsões são garantidas e quais jogos estão no site.", "Goes straight to the most common questions: whether you need a Steam account, how often prices change, whether forecasts are guaranteed and which games are on the site.");
    },
  },
  {
    alvo: "[data-tour='modo-tv']",
    get titulo() {
      return t("Modo TV", "TV mode");
    },
    get texto() {
      return t("Abre em tela cheia e passa sozinho pelas seções da página, descendo devagar nas mais longas. Bom para deixar numa TV. Dá para pausar, voltar, avançar e sair pela barra de baixo; o mouse some depois de 3 segundos parado.", "Opens in fullscreen and goes through the page's sections on its own, scrolling slowly through the longer ones. Good for leaving on a TV. Pause, go back, skip and exit from the bar at the bottom; the mouse hides after 3 seconds still.");
    },
  },
  {
    alvo: "[data-tour='tela-cheia']",
    get titulo() {
      return t("Tela cheia", "Fullscreen");
    },
    get texto() {
      return t("Esconde a barra do navegador e usa a tela inteira. Combina com o modo TV. Esc sai.", "Hides the browser bar and uses the whole screen. Pairs well with TV mode. Esc exits.");
    },
  },
  {
    alvo: "[data-tour='menu-analise']",
    get titulo() {
      return t("Área de análise", "Analysis");
    },
    get texto() {
      return t("Atalho para explorar todos os itens, ver o ranking de oportunidades e a sua lista.", "Shortcut to explore all items, see the opportunities ranking and your list.");
    },
  },
  {
    alvo: "[data-tour='idioma']",
    get titulo() {
      return t("Idioma", "Language");
    },
    get texto() {
      return t("Troca o site entre português e inglês.", "Switches the site between Portuguese and English.");
    },
  },
  {
    alvo: "[data-tour='conta']",
    get titulo() {
      return t("Conta", "Account");
    },
    get texto() {
      return t("Entre com a Steam para salvar os itens que você acompanha na Minha lista.", "Sign in with Steam to save the items you follow in My list.");
    },
  },
  {
    alvo: "[data-tour='como-usar']",
    get titulo() {
      return t("Como usar", "How to use");
    },
    get texto() {
      return t("Este guia fica sempre aqui. Abra quando quiser rever o que cada parte faz.", "This guide is always here. Open it whenever you want to review what each part does.");
    },
  },
];

/** Tutorial de cada rota. Páginas sem entrada aqui não mostram o botão. */
export const TUTORIAIS: Record<string, Passo[]> = {
  "/": INICIO,
};

/**
 * O que o corvo e a coruja dizem em cada passo do tutorial: uma curiosidade, uma provocação ou uma
 * dica, nunca só o nome da parte. Casado pelo trecho do seletor do passo. Pares [português, inglês].
 */
const FALAS: [string, { corvo: [string, string]; coruja: [string, string] }][] = [
  ["'vitrine'", {
    corvo: ["Corvos lembram onde esconderam milhares de coisas. Eu lembro de preços.", "Ravens remember where they hid thousands of things. I remember prices."],
    coruja: ["Repare na medalha: ela diz por que este item está aqui.", "Mind the medal: it tells you why this item is here."],
  }],
  ["data-chaveiro", {
    corvo: ["Corvos brincam só por brincar. Pode puxar, eu não conto pra ninguém.", "Ravens play just for fun. Go ahead and pull, I won't tell."],
    coruja: ["Cada pingente é um dado: jogo, tipo e evento.", "Each charm is data: game, type and event."],
  }],
  ["'adesivos'", {
    corvo: ["Puxa a ponta. Atrás sempre tem mais.", "Pull the corner. There's always more behind."],
    coruja: ["Números de hoje. Amanhã, outros.", "Today's numbers. Tomorrow, new ones."],
  }],
  ["'previa'", {
    corvo: ["A linha tracejada é o futuro. Eu prefiro o passado: esse eu já vi.", "The dashed line is the future. I prefer the past: I've seen it."],
    coruja: ["Leia a faixa, não só a linha. A faixa é a honestidade do modelo.", "Read the range, not just the line. The range is the model being honest."],
  }],
  ["'radar'", {
    corvo: ["Onde tem volume, tem movimento. É aqui que eu fico de olho.", "Where there's volume, there's movement. This is where I keep watch."],
    coruja: ["Volume alto: dá para vender sem derrubar o preço.", "High volume: you can sell without sinking the price."],
  }],
  ["'destaques'", {
    corvo: ["Quem mais subiu e quem mais caiu. Eu aposto nos dois.", "Biggest riser and biggest faller. I bet on both."],
    coruja: ["Alta forte com pouco volume costuma voltar. Cuidado.", "A big rise on thin volume tends to fade. Careful."],
  }],
  ["'transparencia'", {
    corvo: ["Odin mandava dois corvos ao mundo para saber tudo. Aqui basta ler.", "Odin sent two ravens into the world to know everything. Here, just read."],
    coruja: ["Modelo que esconde o erro não merece confiança.", "A model that hides its error doesn't deserve trust."],
  }],
  ["data-corvo", {
    corvo: ["Huginn era o pensamento de Odin. Eu sou as cotações.", "Huginn was Odin's thought. I am the quotes."],
    coruja: ["Fala demais. Mas não esquece nada.", "Talks too much. But forgets nothing."],
  }],
  ["data-coruja", {
    corvo: ["Ela acha que é a analista daqui.", "She thinks she's the analyst around here."],
    coruja: ["Corujas giram a cabeça até 270 graus. Nenhum preço me escapa.", "Owls turn their heads up to 270 degrees. No price escapes me."],
  }],
  ["'faq'", {
    corvo: ["As dúvidas de sempre. Eu responderia melhor.", "The usual questions. I'd answer them better."],
    coruja: ["Leia antes de perguntar.", "Read before you ask."],
  }],
  ["'modo-tv'", {
    corvo: ["Deixa numa TV. Eu sobrevoo as seções com você.", "Leave it on a TV. I'll fly over the sections with you."],
    coruja: ["Bom para vigiar o mercado de longe.", "Good for watching the market from afar."],
  }],
  ["'tela-cheia'", {
    corvo: ["Mais tela, mais céu.", "More screen, more sky."],
    coruja: ["Menos distração. Mais análise.", "Less distraction. More analysis."],
  }],
  ["'menu-analise'", {
    corvo: ["Atalhos. Corvos sempre acham o caminho mais curto.", "Shortcuts. Ravens always find the shortest way."],
    coruja: ["O ranking de oportunidades mora aqui.", "The opportunities ranking lives here."],
  }],
  ["'idioma'", {
    corvo: ["Eu grasno em qualquer língua.", "I caw in any language."],
    coruja: ["Huu em português, hoo em inglês.", "Huu in Portuguese, hoo in English."],
  }],
  ["'conta'", {
    corvo: ["Entre com a Steam e eu passo a lembrar dos seus itens também.", "Sign in with Steam and I'll remember your items too."],
    coruja: ["A Minha lista mostra quanto cada item variou desde que você salvou.", "My list shows how much each item moved since you saved it."],
  }],
  ["'como-usar'", {
    corvo: ["Esqueceu algo? Eu volto com você.", "Forgot something? I'll come back with you."],
    coruja: ["Revisar também é estratégia.", "Reviewing is a strategy too."],
  }],
];

export function falasDoPasso(alvo: string): { corvo?: string; coruja?: string } {
  const par = FALAS.find(([trecho]) => alvo.includes(trecho))?.[1];
  return par ? { corvo: t(...par.corvo), coruja: t(...par.coruja) } : {};
}
