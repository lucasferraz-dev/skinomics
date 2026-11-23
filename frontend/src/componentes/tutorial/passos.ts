/**
 * Passos do "Como usar" de cada página. Cada passo destaca o que o seletor `alvo` encontrar (se forem
 * vários elementos, a área que cobre todos). Para ensinar um botão novo, basta marcar o elemento com
 * `data-tour="..."` e acrescentar o passo aqui, na ordem em que ele aparece na tela.
 */
export type Passo = { alvo: string; titulo: string; texto: string };

const INICIO: Passo[] = [
  {
    alvo: "[data-tour='vitrine']",
    titulo: "Item em destaque",
    texto:
      "Um item do Mercado da Steam sorteado a cada visita, com o preço de hoje e a variação da semana. A medalha no canto diz por que ele apareceu. Use \"Outro item\" para sortear outro.",
  },
  {
    // O svg do chaveiro é só a fixação; as argolas e os pingentes ficam nos grupos arrastáveis.
    alvo: "[data-tour='vitrine-area'] svg[aria-label^='Chaveiro'], [data-tour='vitrine-area'] svg[aria-label^='Chaveiro'] g.cursor-grab",
    titulo: "Chaveiros",
    texto:
      "Dizem o que o item é: o jogo, o tipo e, quando houver, o evento e a qualidade. Dá para pegar e arrastar; eles batem uns nos outros.",
  },
  {
    alvo: "[data-tour='adesivos']",
    titulo: "Números da plataforma",
    texto:
      "Itens monitorados, data da última cotação, oportunidades e horizontes de previsão. Puxe a ponta de um adesivo para descolar e ver um detalhe a mais.",
  },
  {
    alvo: "[data-tour='previa']",
    titulo: "Histórico e previsão",
    texto:
      "É assim que cada item aparece no Terminal: o preço diário dos últimos meses e a previsão dos próximos 7 dias, com a faixa onde o preço deve ficar.",
  },
  {
    alvo: "[data-tour='radar']",
    titulo: "Mais negociados",
    texto: "Os itens com mais vendas na semana, com preço, variação e tendência. Clique numa linha para abrir o item.",
  },
  {
    alvo: "[data-tour='destaques']",
    titulo: "Destaques da semana",
    texto: "Maior alta, maior queda, mais vendido e melhor margem prevista. Cada terminal abre a página do item.",
  },
  {
    alvo: "[data-tour='transparencia']",
    titulo: "De onde vêm os números",
    texto: "A fonte dos dados, a qualidade atual do modelo (medida em dados que ele não viu no treino) e o que a plataforma não faz.",
  },
  {
    alvo: "svg[aria-label='Corvo do Skinomics']",
    titulo: "O corvo",
    texto:
      "O mascote do Skinomics. Anda pelos cards, voa entre as seções e de vez em quando conta algo sobre o mercado. Clique nele para ouvir.",
  },
  {
    alvo: "[data-tour='modo-tv']",
    titulo: "Modo TV",
    texto:
      "Abre em tela cheia e passa sozinho pelas seções da página, descendo devagar nas mais longas. Bom para deixar numa TV. Dá para pausar, voltar, avançar e sair pela barra de baixo; o mouse some depois de 3 segundos parado.",
  },
  {
    alvo: "[data-tour='tela-cheia']",
    titulo: "Tela cheia",
    texto: "Esconde a barra do navegador e usa a tela inteira. Combina com o modo TV. Esc sai.",
  },
  {
    alvo: "[data-tour='menu-analise']",
    titulo: "Área de análise",
    texto: "Atalho para explorar todos os itens, ver o ranking de oportunidades e a sua lista.",
  },
  {
    alvo: "[data-tour='conta']",
    titulo: "Conta",
    texto: "Entre com a Steam para salvar os itens que você acompanha na Minha lista.",
  },
  {
    alvo: "[data-tour='como-usar']",
    titulo: "Como usar",
    texto: "Este guia fica sempre aqui. Abra quando quiser rever o que cada parte faz.",
  },
];

/** Tutorial de cada rota. Páginas sem entrada aqui não mostram o botão. */
export const TUTORIAIS: Record<string, Passo[]> = {
  "/": INICIO,
};
