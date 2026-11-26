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

// Final das páginas do Terminal: os dois mascotes (de plantão no canto, não voando) e o próprio botão.
const FINAL: Passo[] = [
  {
    alvo: "svg[data-corvo]",
    get titulo() {
      return t("Muninn, o corvo", "Muninn, the raven");
    },
    get texto() {
      return t("Fica de plantão no canto da tela e comenta o que está aberto: medalhas, variação, o que ele lembra do histórico. Clique nele para ouvir mais.", "He stays on duty in the corner and comments on what's open: medals, change, what he remembers from the history. Click him to hear more.");
    },
  },
  {
    alvo: "svg[data-coruja]",
    get titulo() {
      return t("Glaux, a coruja", "Glaux, the owl");
    },
    get texto() {
      return t("A analista: lê a previsão, a faixa de confiança e o volume, e avisa quando algo pede cuidado. Clique nela para ouvir outra análise.", "The analyst: reads the forecast, the confidence range and the volume, and warns when something calls for caution. Click her for another reading.");
    },
  },
  INICIO.find((passo) => passo.alvo === "[data-tour='como-usar']")!,
];

const EXPLORAR: Passo[] = [
  {
    alvo: "[data-tour='destaques-explorar']",
    get titulo() {
      return t("Destaques da semana", "Weekly highlights");
    },
    get texto() {
      return t("Os quatro itens que mais chamaram atenção nos últimos 7 dias. Somem quando você filtra, para a lista ficar no topo.", "The four items that stood out most in the last 7 days. They hide while you filter, so the list stays on top.");
    },
  },
  {
    alvo: "[data-tour='busca']",
    get titulo() {
      return t("Busca", "Search");
    },
    get texto() {
      return t("Digite parte do nome do item. A busca espera você parar de digitar.", "Type part of the item's name. The search waits until you stop typing.");
    },
  },
  {
    alvo: "[data-tour='filtros']",
    get titulo() {
      return t("Filtros", "Filters");
    },
    get texto() {
      return t("Jogo (TF2 ou CS2), categoria (a mesma dos chaveiros), faixa de preço e ordem. Clique de novo num chip para tirar o filtro. Tudo fica no link, dá para compartilhar.", "Game (TF2 or CS2), category (the same as the keychains), price range and order. Click a chip again to remove it. Everything goes in the link, so you can share it.");
    },
  },
  {
    alvo: "[data-tour='visao']",
    get titulo() {
      return t("Grade ou lista", "Grid or list");
    },
    get texto() {
      return t("Na grade, cada item é um card com imagem e gráfico de 30 dias. Na lista, uma tabela para comparar números e ordenar pelas colunas.", "In the grid, each item is a card with its image and a 30-day chart. In the list, a table to compare numbers and sort by column.");
    },
  },
  {
    // Só a primeira fileira (cards ou linhas da tabela): a lista inteira passa da altura da tela.
    alvo: "[data-tour='resultados'] .grid > :nth-child(-n+4), [data-tour='resultados'] thead, [data-tour='resultados'] tbody tr:nth-child(-n+3)",
    get titulo() {
      return t("Itens", "Items");
    },
    get texto() {
      return t("Preço, variação da semana, tendência e vendas. As medalhas marcam os destaques da semana, e o selo de touro ou urso é a leitura do modelo para 7 dias (cheio quando é forte). Clique num item para ver o histórico e a previsão.", "Price, weekly change, trend and sales. Medals mark the week's highlights, and the bull or bear badge is the model's 7-day reading (solid when strong). Click an item to see its history and forecast.");
    },
  },
  ...FINAL,
];

const DETALHE: Passo[] = [
  {
    alvo: "[data-tour='item-topo']",
    get titulo() {
      return t("O item", "The item");
    },
    get texto() {
      return t("Nome, categoria, evento e qualidade, o preço de hoje e a variação da semana. \"Ver no Mercado da Steam\" abre o anúncio oficial.", "Name, category, event and quality, today's price and the week's change. \"View on the Steam Market\" opens the official listing.");
    },
  },
  {
    alvo: "[data-tour='item-acompanhar']",
    get titulo() {
      return t("Acompanhar", "Follow");
    },
    get texto() {
      return t("Salva o item na Minha lista, que mostra quanto ele variou desde que você salvou. Precisa entrar com a Steam.", "Saves the item to My list, which shows how much it changed since you saved it. Requires signing in with Steam.");
    },
  },
  {
    alvo: "[data-tour='item-numeros']",
    get titulo() {
      return t("Números do item", "Item numbers");
    },
    get texto() {
      return t("Preço, variação, previsão de 7 dias e vendas. Puxe a ponta de um adesivo para ver o detalhe no verso, como a faixa de 80% da previsão.", "Price, change, 7-day forecast and sales. Pull a sticker's corner to see the detail on the back, like the forecast's 80% range.");
    },
  },
  {
    alvo: "[data-tour='item-grafico']",
    get titulo() {
      return t("Histórico e previsão", "History and forecast");
    },
    get texto() {
      return t("O preço diário no período escolhido (de 7 dias a tudo). No fim da linha, a previsão e a faixa onde o preço deve ficar.", "The daily price over the chosen period (7 days to all). At the end of the line, the forecast and the range where the price should land.");
    },
  },
  {
    alvo: "[data-tour='item-sinal']",
    get titulo() {
      return t("Leitura do modelo", "Model reading");
    },
    get texto() {
      return t(
        "Do urso ao touro, o que a previsão diz em cinco níveis. Alta forte quer dizer que até o pior caso da faixa de 80% fica acima do preço de hoje; baixa forte, que até o melhor caso fica abaixo. Com pouca venda ou faixa larga demais, não há leitura. É uma leitura do modelo, não uma recomendação.",
        "From bear to bull, what the forecast says in five levels. Strong bull means even the worst case of the 80% range stays above today's price; strong bear, that even the best case stays below. With few sales or too wide a range, there's no reading. It's the model's reading, not advice.",
      );
    },
  },
  {
    alvo: "[data-tour='item-previsao']",
    get titulo() {
      return t("Cenário", "Scenario");
    },
    get texto() {
      return t("A previsão para 7, 15 ou 30 dias, com o nível de confiança. Quanto mais longe, mais larga a faixa. O resumo de baixo mostra mínimo, máximo e volume do período.", "The forecast for 7, 15 or 30 days, with its confidence level. The further out, the wider the range. The summary below shows the period's low, high and volume.");
    },
  },
  {
    alvo: "[data-tour='item-parecidos']",
    get titulo() {
      return t("Itens parecidos", "Similar items");
    },
    get texto() {
      return t("Os mais negociados da mesma categoria, para comparar.", "The most traded items in the same category, to compare.");
    },
  },
  ...FINAL,
];

const OPORTUNIDADES: Passo[] = [
  {
    alvo: "[data-tour='oport-cenario']",
    get titulo() {
      return t("Cenário", "Scenario");
    },
    get texto() {
      return t("O horizonte da previsão: 7, 15 ou 30 dias. Trocar o cenário refaz o ranking inteiro, porque cada horizonte tem a sua previsão.", "The forecast horizon: 7, 15 or 30 days. Switching it rebuilds the whole ranking, since each horizon has its own forecast.");
    },
  },
  {
    alvo: "[data-tour='oport-numeros']",
    get titulo() {
      return t("Números do cenário", "Scenario numbers");
    },
    get texto() {
      return t("Quantas oportunidades há, a maior margem, quantas têm risco baixo e de quando são os preços. Puxe a ponta de um adesivo para ver o verso.", "How many opportunities there are, the biggest margin, how many are low risk and how old the prices are. Pull a sticker's corner to see the back.");
    },
  },
  {
    alvo: "[data-tour='oport-podio']",
    get titulo() {
      return t("Pódio", "Podium");
    },
    get texto() {
      return t("As três maiores margens, com o que sobra depois da taxa da Steam e o risco. Clique numa vitrine para abrir o item com a previsão desse cenário.", "The three biggest margins, with what's left after the Steam fee and the risk. Click a showcase to open the item with this scenario's forecast.");
    },
  },
  {
    alvo: "[data-tour='oport-ranking'] > div:first-child, [data-tour='oport-ranking'] li:nth-child(-n+3)",
    get titulo() {
      return t("Ranking", "Ranking");
    },
    get texto() {
      return t("O resto, da maior margem para a menor. Clique no selo de risco de uma linha para ver os motivos: vendas por dia e quanto o preço oscila.", "The rest, from the biggest margin to the smallest. Click a row's risk badge to see why: sales per day and how much the price swings.");
    },
  },
  ...FINAL,
];

const ALERTAS: Passo[] = [
  {
    alvo: "[data-tour='alerta-vazio']",
    get titulo() {
      return t("Entre primeiro", "Sign in first");
    },
    get texto() {
      return t("Os alertas ficam guardados na sua conta Steam. Depois de entrar, esta página mostra a busca para criar alertas e os que você já tem.", "Alerts are saved to your Steam account. Once you sign in, this page shows the search to create alerts and the ones you have.");
    },
  },
  {
    alvo: "[data-tour='alerta-novo']",
    get titulo() {
      return t("Novo alerta", "New alert");
    },
    get texto() {
      return t("Busque o item pelo nome (sem busca aparecem os mais negociados), escolha um e diga se quer o aviso quando o preço cair até um valor ou subir até um valor.", "Search the item by name (with no search you get the most traded), pick one and choose whether you want a notice when the price drops to a value or rises to one.");
    },
  },
  {
    alvo: "[data-tour='alerta-disparados']",
    get titulo() {
      return t("Disparados", "Triggered");
    },
    get texto() {
      return t("Os alertas que chegaram no preço, com o valor que disparou. Um alerta dispara uma vez só; para vigiar de novo, troque o alvo.", "Alerts that hit the price, with the value that triggered them. An alert triggers only once; to watch again, change the target.");
    },
  },
  {
    alvo: "[data-tour='alerta-vigiando']",
    get titulo() {
      return t("Vigiando", "Watching");
    },
    get texto() {
      return t("Os alertas armados, com o preço de hoje e o caminho até o alvo. Dá para trocar o alvo, pausar ou apagar ali mesmo.", "Armed alerts, with today's price and the way to the target. You can change the target, pause or delete right there.");
    },
  },
  {
    alvo: "[data-tour='sino']",
    get titulo() {
      return t("Sino", "Bell");
    },
    get texto() {
      return t("Quando um alerta dispara, o sino fica verde em qualquer página do site. O aviso é só aqui dentro, sem e-mail.", "When an alert triggers, the bell turns green on any page of the site. The notice stays here, no e-mail.");
    },
  },
  ...FINAL,
];

const MINHA_LISTA: Passo[] = [
  {
    alvo: "[data-tour='lista-vazia']",
    get titulo() {
      return t("Sua lista", "Your list");
    },
    get texto() {
      return t("Para pôr um item aqui, entre com a Steam, abra o item e use Acompanhar. A lista fica guardada na sua conta.", "To add an item, sign in with Steam, open the item and use Follow. The list is saved to your account.");
    },
  },
  {
    alvo: "[data-tour='lista-destaques']",
    get titulo() {
      return t("Melhor e pior", "Best and worst");
    },
    get texto() {
      return t("Quem mais subiu e quem mais caiu desde que entrou na lista, contra o preço do dia em que você acompanhou.", "What rose and fell the most since it joined the list, against the price on the day you followed it.");
    },
  },
  {
    alvo: "[data-tour='lista-tabela'] thead, [data-tour='lista-tabela'] tbody tr:nth-child(-n+3)",
    get titulo() {
      return t("Todos os itens", "All items");
    },
    get texto() {
      return t("O preço de hoje, a barra de quanto mudou desde que entrou (a mesma escala para todos), a semana e os últimos 30 dias. Remover tira o item da lista.", "Today's price, a bar of how much it changed since it joined (same scale for all), the week and the last 30 days. Remove takes it off the list.");
    },
  },
  ...FINAL,
];

/**
 * Tutorial de cada rota; páginas sem entrada não mostram o botão. `chave` é o que fica salvo como "já
 * visto". `automatico`: abre sozinho na primeira visita (só na landing; no Terminal, só quando pedirem).
 */
const TUTORIAIS: { rota: RegExp; chave: string; passos: Passo[]; automatico: boolean }[] = [
  { rota: /^\/$/, chave: "/", passos: INICIO, automatico: true },
  { rota: /^\/itens\/?$/, chave: "/itens", passos: EXPLORAR, automatico: false },
  { rota: /^\/itens\/\d+\/?$/, chave: "/itens/:id", passos: DETALHE, automatico: false },
  { rota: /^\/oportunidades\/?$/, chave: "/oportunidades", passos: OPORTUNIDADES, automatico: false },
  { rota: /^\/alertas\/?$/, chave: "/alertas", passos: ALERTAS, automatico: false },
  { rota: /^\/minha-lista\/?$/, chave: "/minha-lista", passos: MINHA_LISTA, automatico: false },
];

export function tutorialDaRota(pathname: string) {
  return TUTORIAIS.find(({ rota }) => rota.test(pathname));
}

/**
 * O que cada um diz em cada passo do tutorial: Muninn ligado no 220, falando demais; Glaux seca, o
 * mínimo necessário. Casado pelo trecho do seletor do passo. Pares [português, inglês].
 */
const FALAS: [string, { corvo: [string, string]; coruja: [string, string] }][] = [
  ["'destaques-explorar'", {
    corvo: ["Os quatro que eu mais gosto! Hoje. Amanhã muda. Eu lembro de todos os de ontem!", "My four favorites! Today. Tomorrow it changes. I remember all of yesterday's!"],
    coruja: ["Ponto de partida. Não conclusão.", "A starting point. Not a conclusion."],
  }],
  ["'busca'", {
    corvo: ["Escreve qualquer coisa! \"case\"! \"crate\"! \"corvo\"! Corvo não tem. Ainda!", "Type anything! \"case\"! \"crate\"! \"raven\"! No ravens. Yet!"],
    coruja: ["Parte do nome basta.", "Part of the name is enough."],
  }],
  ["'filtros'", {
    corvo: ["Chip! Chip! Clica em todos! Não, clica num só. Ou em três!", "Chips! Chips! Click them all! No, just one. Or three!"],
    coruja: ["Filtre por faixa de preço antes de comparar variação.", "Filter by price range before comparing changes."],
  }],
  ["'visao'", {
    corvo: ["Grade! Grade! Tem chaveiro na grade!", "Grid! Grid! The grid has keychains!"],
    coruja: ["Lista para comparar. Grade para olhar.", "List to compare. Grid to look."],
  }],
  ["'resultados'", {
    corvo: ["Medalha! Quem tem medalha fui eu que escolhi! Mentira, foi a conta. Mas eu concordo!", "Medals! I picked who gets one! Not really, the math did. But I agree!"],
    coruja: ["Variação sem volume não significa nada.", "Change without volume means nothing."],
  }],
  ["'item-topo'", {
    corvo: ["Esse eu conheço! Eu conheço todos! Pergunta o preço de ontem! Pergunta!", "I know this one! I know them all! Ask me yesterday's price! Ask!"],
    coruja: ["Comece pelo preço e pela variação.", "Start with the price and the change."],
  }],
  ["'item-acompanhar'", {
    corvo: ["Acompanha! Aí eu vigio pra você! De dia e de noite! Corvo não dorme! Dorme sim.", "Follow it! Then I'll watch it for you! Day and night! Ravens don't sleep! We do."],
    coruja: ["Útil para medir depois. Não antes.", "Useful to measure later. Not before."],
  }],
  ["'item-numeros'", {
    corvo: ["Descola! Descola! O verso da previsão tem a faixa! Eu já espiei!", "Peel it! Peel it! The forecast's back has the range! I peeked!"],
    coruja: ["O verso da previsão é o que importa.", "The forecast's back is what matters."],
  }],
  ["'item-grafico'", {
    corvo: ["Cada pontinho é um dia! Eu lembro de todos! TODOS!", "Each dot is a day! I remember them all! ALL!"],
    coruja: ["Olhe a faixa no fim da linha, não o ponto.", "Look at the range at the end of the line, not the dot."],
  }],
  ["'item-sinal'", {
    corvo: ["Touro! Urso! Eu torço pro touro! Sempre! Mesmo quando é urso!", "Bull! Bear! I root for the bull! Always! Even when it's a bear!"],
    coruja: ["Olhe o pior caso antes do centro.", "Check the worst case before the center."],
  }],
  ["'item-previsao'", {
    corvo: ["Ela que calcula isso. Demora. Mas acerta. Às vezes. Muitas vezes. Tá, quase sempre!", "She calculates this. Slowly. But she's right. Sometimes. Often. Fine, almost always!"],
    coruja: ["80% de confiança: em 8 de 10 vezes, o preço fica na faixa.", "80% confidence: 8 times out of 10, the price lands in the range."],
  }],
  ["'item-parecidos'", {
    corvo: ["Mais itens! Mais preços pra eu decorar! Oba!", "More items! More prices to memorize! Yay!"],
    coruja: ["Compare com os da mesma categoria.", "Compare with the same category."],
  }],
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
  ["'oport-cenario'", {
    corvo: ["Sete! Quinze! Trinta! Clica em todos! Eu quero ver tudo!", "Seven! Fifteen! Thirty! Click them all! I want to see everything!"],
    coruja: ["Horizonte maior, faixa maior.", "Longer horizon, wider range."],
  }],
  ["'oport-numeros'", {
    corvo: ["Descola! Tem número atrás! Eu já espiei!", "Peel it! There are numbers behind! I peeked!"],
    coruja: ["Confira a data dos preços primeiro.", "Check the price date first."],
  }],
  ["'oport-podio'", {
    corvo: ["Pódio! O primeiro ganha medalha! Eu nunca ganho!", "Podium! First place gets a medal! I never do!"],
    coruja: ["Margem alta com risco alto não é pódio. É aviso.", "A high margin with high risk isn't a podium. It's a warning."],
  }],
  ["'oport-ranking'", {
    corvo: ["Clica no risco! Ele conta tudo! Eu já sei de cor!", "Click the risk! It tells everything! I know it by heart!"],
    coruja: ["Leia o risco antes da margem.", "Read the risk before the margin."],
  }],
  ["'alerta-vazio'", {
    corvo: ["Entra! Entra! Aí eu vigio pra você!", "Sign in! Sign in! Then I'll watch for you!"],
    coruja: ["Sem conta, sem alerta.", "No account, no alerts."],
  }],
  ["'alerta-novo'", {
    corvo: ["Escolhe um item! Qualquer um! Eu vigio todos!", "Pick an item! Any one! I watch them all!"],
    coruja: ["Um alvo que o preço já passou é recusado.", "A target the price already passed is refused."],
  }],
  ["'alerta-disparados'", {
    corvo: ["Disparou! Eu avisei! Eu sempre aviso!", "Triggered! I told you! I always tell you!"],
    coruja: ["Disparado não vigia mais.", "A triggered alert stops watching."],
  }],
  ["'alerta-vigiando'", {
    corvo: ["A pista! Quando chega no fim, plim!", "The track! When it reaches the end, ding!"],
    coruja: ["Pausado não dispara.", "Paused ones don't trigger."],
  }],
  ["'sino'", {
    corvo: ["O sino! Fica verde e balança! Igual na Steam!", "The bell! It turns green and swings! Just like Steam!"],
    coruja: ["Conferido uma vez por dia.", "Checked once a day."],
  }],
  ["'lista-vazia'", {
    corvo: ["Lista vazia! Vai lá e acompanha um item! Rápido!", "Empty list! Go follow an item! Quick!"],
    coruja: ["Acompanhar é medir, não comprar.", "Following is measuring, not buying."],
  }],
  ["'lista-destaques'", {
    corvo: ["Quem subiu! Quem caiu! Eu lembro do preço de quando entrou!", "Who rose! Who fell! I remember the price when it joined!"],
    coruja: ["A conta é contra o dia em que entrou, não contra o que você pagou.", "It's against the day it joined, not what you paid."],
  }],
  ["'lista-tabela'", {
    corvo: ["Barra verde pra direita! Coral pra esquerda! Eu prefiro a verde!", "Green bar to the right! Coral to the left! I like the green one!"],
    coruja: ["Mesma escala para todos. Dá para comparar.", "Same scale for all. You can compare."],
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
