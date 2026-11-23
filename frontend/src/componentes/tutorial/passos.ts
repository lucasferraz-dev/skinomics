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
      return t("Muninn, o corvo", "Muninn, the raven");
    },
    get texto() {
      return t("Muninn, um dos corvos de Odin: o nome quer dizer memória. Anda pelos cards, voa entre as seções, lembra das suas visitas e de vez em quando conta algo sobre o mercado. Clique nele para ouvir.", "Muninn, one of Odin's ravens: the name means memory. He walks the cards, flies between sections, remembers your visits and now and then says something about the market. Click him to hear.");
    },
  },
  {
    alvo: "svg[data-coruja]",
    get titulo() {
      return t("Glaux, a coruja", "Glaux, the owl");
    },
    get texto() {
      return t(
        "Glaux, a coruja de Atena, deusa da sabedoria. A analista: fala pouco, quase sempre sobre previsão, e vira a cabeça para acompanhar o cursor. Muninn vive implicando com ela.",
        "Glaux, the owl of Athena, goddess of wisdom. The analyst: talks little, mostly about forecasts, and turns her head to follow your cursor. Muninn keeps pestering her.",
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
 * O que cada um diz em cada passo do tutorial: Muninn ligado no 220, falando demais; Glaux seca, o
 * mínimo necessário. Casado pelo trecho do seletor do passo. Pares [português, inglês].
 */
const FALAS: [string, { corvo: [string, string]; coruja: [string, string] }][] = [
  ["'vitrine'", {
    corvo: ["Olha esse item! Olha! Fui eu que achei. Não fui, mas podia ter sido!", "Look at this item! Look! I found it. I didn't, but I could have!"],
    coruja: ["A medalha explica por que ele está aqui. Leia.", "The medal explains why it's here. Read it."],
  }],
  ["data-chaveiro", {
    corvo: ["Puxa! Puxa! Solta! Puxa de novo! Eu adoro isso!", "Pull it! Pull it! Let go! Again! I love this!"],
    coruja: ["Jogo, tipo, evento. Só isso.", "Game, type, event. That's all."],
  }],
  ["'adesivos'", {
    corvo: ["Descola o adesivo! Tem coisa atrás! Eu já vi! Duas vezes!", "Peel the sticker! There's stuff behind! I've seen it! Twice!"],
    coruja: ["Números de hoje. Amanhã serão outros.", "Today's numbers. Tomorrow, others."],
  }],
  ["'previa'", {
    corvo: ["A linha tracejada é o futuro! Eu prefiro o passado: esse eu decorei!", "The dashed line is the future! I prefer the past: I memorized it!"],
    coruja: ["Leia a faixa, não a linha.", "Read the range, not the line."],
  }],
  ["'radar'", {
    corvo: ["Volume! Movimento! Barulho! Meu lugar favorito!", "Volume! Movement! Noise! My favorite spot!"],
    coruja: ["Volume alto: dá para sair sem derrubar o preço.", "High volume: you can exit without sinking the price."],
  }],
  ["'destaques'", {
    corvo: ["Quem subiu mais? Quem caiu mais? Eu aposto nos dois! Ao mesmo tempo!", "Who rose most? Who fell most? I bet on both! At once!"],
    coruja: ["Alta com pouco volume costuma voltar.", "A rise on thin volume tends to fade."],
  }],
  ["'transparencia'", {
    corvo: ["Odin tinha dois corvos pra saber tudo. Você tem eu. Sorte sua!", "Odin had two ravens to know everything. You have me. Lucky you!"],
    coruja: ["Modelo que esconde o erro não serve.", "A model that hides its error is useless."],
  }],
  ["data-corvo", {
    corvo: ["Sou eu! Muninn! A memória de Odin! Pergunta qualquer preço! Qualquer um!", "It's me! Muninn! Odin's memory! Ask me any price! Any!"],
    coruja: ["Infelizmente.", "Unfortunately."],
  }],
  ["data-coruja", {
    corvo: ["Essa aí? Lenta. Muito lenta. Pergunta pra ela, vai demorar.", "Her? Slow. Very slow. Ask her, it'll take a while."],
    coruja: ["Glaux. Coruja de Atena. Eu analiso.", "Glaux. Athena's owl. I analyze."],
  }],
  ["'faq'", {
    corvo: ["Pergunta pra mim! Eu respondo mais rápido que esse FAQ!", "Ask me! I answer faster than this FAQ!"],
    coruja: ["Leia antes de perguntar.", "Read before asking."],
  }],
  ["'modo-tv'", {
    corvo: ["Modo TV! Eu voo junto! Toda seção! Todas!", "TV mode! I fly along! Every section! All of them!"],
    coruja: ["Para quem observa de longe. Como eu.", "For those who watch from afar. Like me."],
  }],
  ["'tela-cheia'", {
    corvo: ["Mais tela, mais céu, mais eu!", "More screen, more sky, more me!"],
    coruja: ["Menos distração.", "Fewer distractions."],
  }],
  ["'menu-analise'", {
    corvo: ["Atalho! Corvo ama atalho! Clica, clica!", "Shortcuts! Ravens love shortcuts! Click, click!"],
    coruja: ["O ranking de oportunidades está aqui.", "The opportunities ranking is here."],
  }],
  ["'idioma'", {
    corvo: ["Eu grasno nas duas línguas! Ouve: CRÓC! Em inglês: CAW!", "I caw in both languages! Listen: CRÓC! In English: CAW!"],
    coruja: ["Os números não mudam de língua.", "Numbers don't change language."],
  }],
  ["'conta'", {
    corvo: ["Entra com a Steam! Aí eu decoro os seus itens também! Todos!", "Sign in with Steam! Then I'll memorize your items too! All of them!"],
    coruja: ["A Minha lista mostra quanto variou desde que você salvou.", "My list shows the change since you saved it."],
  }],
  ["'como-usar'", {
    corvo: ["Acabou? Já? Clica de novo! De novo!", "Done? Already? Click again! Again!"],
    coruja: ["Fim. Pode ir.", "The end. You may go."],
  }],
];

export function falasDoPasso(alvo: string): { corvo?: string; coruja?: string } {
  const par = FALAS.find(([trecho]) => alvo.includes(trecho))?.[1];
  return par ? { corvo: t(...par.corvo), coruja: t(...par.coruja) } : {};
}
