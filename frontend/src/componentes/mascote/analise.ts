import { type Alerta, quantoFalta } from "../../api/alertas";
import type { ItemResumo, PontoHistorico, PrevisaoItem } from "../../api/itens";
import type { RankingOportunidades } from "../../api/oportunidades";
import { t } from "../../lib/idioma";
import { formatarData, formatarInteiro, formatarPreco, formatarVariacao } from "../../lib/formato";
import { type NivelSinal, type Sinal, TAXA_STEAM } from "../../lib/sinal";
import type { TipoMedalha } from "../../paginas/inicio/Medalha";
import { rotuloDoNivel } from "../SinalModelo";

/**
 * O que Muninn e Glaux dizem sobre a página aberta, a partir dos dados dela. `abertura` é dita sozinha
 * quando os dados chegam (e de novo se mudarem: outro item, outro filtro); `linhas` saem quando a pessoa
 * clica no mascote. Muninn comenta com memória e empolgação; Glaux, seca, lê a previsão e o risco.
 */
export type Falas = { abertura?: string; linhas: string[] };
export type FalasDaPagina = { corvo: Falas; coruja: Falas };

// Abaixo disso a variação vem de pouquíssimas vendas (o mesmo corte dos destaques da semana).
const VOLUME_MINIMO = 50;

const percentual = (fracao: number) => `${Math.round(fracao * 100)}%`;
const semSinal = (fracao: number) => formatarVariacao(Math.abs(fracao)).replace(/^[+-]/, "");

// O que a Glaux diz de cada leitura do medidor, em uma frase seca.
const LEITURA_CURTA: Record<NivelSinal, () => string> = {
  alta_forte: () => t("Até o pior caso fica acima de hoje.", "Even the worst case stays above today."),
  alta: () => t("Centro acima de hoje, mas a faixa ainda permite queda.", "Center above today, but the range still allows a drop."),
  neutro: () => t("Nada a fazer por enquanto.", "Nothing to do for now."),
  baixa: () => t("Centro abaixo de hoje, mas a faixa ainda permite alta.", "Center below today, but the range still allows a rise."),
  baixa_forte: () => t("Até o melhor caso fica abaixo de hoje.", "Even the best case stays below today."),
};

type DadosItem = {
  item: ItemResumo;
  sinal: Sinal | undefined;
  previsao: PrevisaoItem | undefined;
  previsaoCarregando: boolean;
  horizonte: number;
  pontos: PontoHistorico[] | undefined;
  medalha: TipoMedalha | undefined;
  categoria: string | undefined;
  parecidos: number;
};

export function analiseDoItem({ item, sinal, previsao, previsaoCarregando, horizonte, pontos, medalha, categoria, parecidos }: DadosItem): FalasDaPagina {
  const corvo: Falas = { linhas: [] };
  const coruja: Falas = { linhas: [] };
  const variacao = item.variacao_7d;
  const volume = item.volume_7d;
  const prevista = previsao?.disponivel && previsao.preco_previsto != null ? previsao : undefined;
  const inferior = prevista?.intervalo_inferior;
  const superior = prevista?.intervalo_superior;
  const temFaixa = prevista != null && inferior != null && superior != null;

  // --- Glaux: a previsão, a faixa e o risco.
  if (!previsaoCarregando) {
    if (temFaixa) {
      const confianca = percentual(prevista.nivel_confianca ?? 0.8);
      coruja.abertura = t(
        `${horizonte} dias: cerca de ${formatarPreco(prevista.preco_previsto!)}. Com ${confianca} de confiança, entre ${formatarPreco(inferior)} e ${formatarPreco(superior)}.`,
        `${horizonte} days: about ${formatarPreco(prevista.preco_previsto!)}. With ${confianca} confidence, between ${formatarPreco(inferior)} and ${formatarPreco(superior)}.`,
      );
      const meiaFaixa = (superior - inferior) / 2 / prevista.preco_previsto!;
      coruja.linhas.push(
        meiaFaixa < 0.05
          ? t(`Faixa de ±${semSinal(meiaFaixa)}. Estreita. O modelo está seguro.`, `Range of ±${semSinal(meiaFaixa)}. Narrow. The model is confident.`)
          : meiaFaixa < 0.15
            ? t(`Faixa de ±${semSinal(meiaFaixa)}. Incerteza moderada.`, `Range of ±${semSinal(meiaFaixa)}. Moderate uncertainty.`)
            : t(`Faixa de ±${semSinal(meiaFaixa)}. Larga. Não confie no número do meio.`, `Range of ±${semSinal(meiaFaixa)}. Wide. Don't trust the middle number.`),
      );
    } else if (prevista) {
      coruja.abertura = t(`${horizonte} dias: cerca de ${formatarPreco(prevista.preco_previsto!)}.`, `${horizonte} days: about ${formatarPreco(prevista.preco_previsto!)}.`);
    } else {
      coruja.abertura = t("Sem previsão para este horizonte agora. Leia o histórico.", "No forecast for this horizon right now. Read the history.");
    }
  }
  if (sinal?.tipo === "leitura") {
    if (coruja.abertura) coruja.linhas.unshift(coruja.abertura);
    coruja.abertura = t(
      `Leitura de ${horizonte} dias: ${rotuloDoNivel(sinal.nivel).toLowerCase()}. ${LEITURA_CURTA[sinal.nivel]()}${sinal.desatualizado ? " Leitura antiga. Desconfie." : ""}`,
      `${horizonte}-day reading: ${rotuloDoNivel(sinal.nivel).toLowerCase()}. ${LEITURA_CURTA[sinal.nivel]()}${sinal.desatualizado ? " An old reading. Be wary." : ""}`,
    );
  } else if (sinal?.tipo === "sem" && sinal.motivo === "piso") {
    coruja.abertura = t("No piso do mercado. Não cai. Também não paga a taxa se subir um centavo.", "At the market floor. It won't fall. Nor will a one-cent rise pay the fee.");
  } else if (sinal?.tipo === "sem" && sinal.motivo === "pouco_volume") {
    coruja.linhas.push(t("Sem leitura: pouca venda. Não confio nesse preço.", "No reading: few sales. I don't trust that price."));
  }
  if (prevista?.desatualizada) {
    const base = prevista.data_base ? formatarData(prevista.data_base) : "";
    coruja.linhas.push(t(`Previsão desatualizada${base ? `, base de ${base}` : ""}. Desconfie.`, `Outdated forecast${base ? `, based on ${base}` : ""}. Be wary.`));
  }
  if (volume == null || volume === 0) {
    coruja.linhas.push(t("Sem vendas na semana. Preço sem lastro.", "No sales this week. A price with nothing behind it."));
  } else if (volume < VOLUME_MINIMO) {
    coruja.linhas.push(t(`${formatarInteiro(volume)} vendas em 7 dias. Pouco. Preço frágil.`, `${formatarInteiro(volume)} sales in 7 days. Few. A fragile price.`));
  } else {
    coruja.linhas.push(t(`${formatarInteiro(volume)} vendas em 7 dias. Dá para sair sem derrubar o preço.`, `${formatarInteiro(volume)} sales in 7 days. You can exit without sinking the price.`));
  }
  if (variacao != null && prevista?.variacao_prevista != null) {
    if (variacao > 0.1 && prevista.variacao_prevista < 0) {
      coruja.linhas.push(t("Subiu forte na semana e o modelo prevê queda. Pico, provavelmente.", "Rose hard this week and the model expects a drop. A spike, probably."));
    } else if (variacao < -0.1 && prevista.variacao_prevista > 0) {
      coruja.linhas.push(t("Caiu forte na semana e o modelo prevê recuperação. Talvez.", "Fell hard this week and the model expects a rebound. Maybe."));
    }
  }
  if (horizonte > 7) {
    coruja.linhas.push(t(`${horizonte} dias erra mais que 7. A faixa mostra isso.`, `${horizonte} days misses more than 7. The range shows it.`));
  }
  coruja.linhas.push(t("Previsão não é recomendação. É estimativa.", "A forecast isn't advice. It's an estimate."));

  // --- Muninn: memória, medalhas e empolgação.
  if (medalha === "alta" && variacao != null) {
    corvo.abertura = t(`A MAIOR ALTA da semana! ${formatarVariacao(variacao)}! Eu vi primeiro! Eu sempre vejo primeiro!`, `The BIGGEST RISE of the week! ${formatarVariacao(variacao)}! I saw it first! I always see it first!`);
  } else if (medalha === "queda" && variacao != null) {
    corvo.abertura = t(`A maior queda da semana! ${formatarVariacao(variacao)}! Ai, ai, ai!`, `The biggest drop of the week! ${formatarVariacao(variacao)}! Oh dear, oh dear!`);
  } else if (medalha === "volume" && volume != null) {
    corvo.abertura = t(`O mais negociado da semana! ${formatarInteiro(volume)} vendas! Eu contei uma por uma!`, `The most traded this week! ${formatarInteiro(volume)} sales! I counted every one!`);
  } else if (medalha === "margem") {
    corvo.abertura = t("Melhor margem prevista! A coruja calculou. Mas fui EU que achei!", "Best forecast margin! The owl did the math. But I found it!");
  } else if (variacao != null && Math.abs(variacao) >= 0.005) {
    corvo.abertura = variacao > 0
      ? t(`Eu lembro desse! Subiu ${semSinal(variacao)} em 7 dias!`, `I remember this one! Up ${semSinal(variacao)} in 7 days!`)
      : t(`Eu lembro desse! Caiu ${semSinal(variacao)} em 7 dias!`, `I remember this one! Down ${semSinal(variacao)} in 7 days!`);
  } else {
    corvo.abertura = t("Esse quase não se mexeu na semana. Sossegado. Diferente de mim!", "This one barely moved this week. Calm. Unlike me!");
  }
  // O sinal forte passa na frente de tudo; os outros entram nas falas de clique.
  if (sinal?.tipo === "leitura") {
    const { nivel } = sinal;
    if (nivel === "alta_forte") {
      corvo.abertura = t("TOURO! Touro forte! Até o pior caso sobe! Eu compraria! Se corvo tivesse bolso!", "BULL! Strong bull! Even the worst case goes up! I'd buy! If ravens had pockets!");
    } else if (nivel === "baixa_forte") {
      corvo.abertura = t("URSO! Urso forte! Até o melhor caso cai! Eu, hein!", "BEAR! Strong bear! Even the best case goes down! Yikes!");
    } else {
      corvo.linhas.unshift(
        nivel === "alta"
          ? t("Touro! Mas tímido. A faixa ainda deixa cair.", "Bull! A shy one. The range still lets it fall.")
          : nivel === "baixa"
            ? t("Urso, mas meio dorminhoco. A faixa ainda deixa subir.", "Bear, a sleepy one. The range still lets it rise.")
            : t("Neutro. Nem touro nem urso. Chato! Igual a coruja!", "Neutral. No bull, no bear. Boring! Like the owl!"),
      );
    }
  }
  if (prevista?.variacao_prevista != null && Math.abs(prevista.variacao_prevista) >= 0.005) {
    corvo.linhas.push(
      prevista.variacao_prevista > 0
        ? t(`A previsão diz que sobe ${semSinal(prevista.variacao_prevista)} em ${horizonte} dias! Sobe! Sobe!`, `The forecast says up ${semSinal(prevista.variacao_prevista)} in ${horizonte} days! Up! Up!`)
        : t(`A previsão diz que cai ${semSinal(prevista.variacao_prevista)} em ${horizonte} dias! Cuidado!`, `The forecast says down ${semSinal(prevista.variacao_prevista)} in ${horizonte} days! Careful!`),
    );
  }
  if (pontos && pontos.length > 1) {
    const precos = pontos.map((ponto) => ponto.preco);
    corvo.linhas.push(
      t(
        `Maior preço que eu decorei no período: ${formatarPreco(Math.max(...precos))}! Menor: ${formatarPreco(Math.min(...precos))}! Não esqueço nenhum!`,
        `Highest price I memorized in this period: ${formatarPreco(Math.max(...precos))}! Lowest: ${formatarPreco(Math.min(...precos))}! I forget none!`,
      ),
    );
  }
  if (categoria && parecidos > 0) {
    corvo.linhas.push(t(`Tem mais itens de ${categoria} lá embaixo! Rola a página! Rola!`,`There's more like it down below! Scroll! Scroll!`));
  }
  corvo.linhas.push(
    t("Troca o horizonte pra 30 dias! A coruja odeia. Troca!", "Switch the horizon to 30 days! The owl hates it. Switch!"),
    t("Clica em Acompanhar! Aí eu fico de olho nele pra você!", "Click Follow! Then I'll keep an eye on it for you!"),
    t("Puxa os chaveiros da vitrine! Eles balançam! Eu adoro!", "Pull the keychains on the showcase! They swing! I love it!"),
  );

  return { corvo, coruja };
}

type DadosExplorar = {
  /** As leituras de 7 dias dos itens na tela (as que já chegaram). */
  sinais: Sinal[];
  catalogo: ItemResumo[];
  resultado: ItemResumo[] | undefined;
  total: number | undefined;
  categoria: string | undefined;
  filtrando: boolean;
};

export function analiseDoExplorar({ sinais, catalogo, resultado, total, categoria, filtrando }: DadosExplorar): FalasDaPagina {
  const corvo: Falas = { linhas: [] };
  const coruja: Falas = { linhas: [] };
  // Com filtro, os dois comentam o que está na tela; sem filtro, o catálogo inteiro.
  const base = filtrando ? (resultado ?? []) : catalogo;

  if (total !== undefined) {
    corvo.abertura = total === 0
      ? t("Nada! Nadinha! Tira um filtro aí!", "Nothing! Zilch! Drop a filter!")
      : categoria
        ? t(`${total} itens em ${categoria}! Eu decorei todos! Todos!`, `${total} items in this category! I memorized them all! All!`)
        : t(`${total} itens! Eu decorei todos! Clica num card que eu conto mais!`, `${total} items! I memorized them all! Click a card and I'll tell you more!`);
  }

  const comVariacao = base.filter((item) => item.variacao_7d != null);
  const negociados = comVariacao.filter((item) => (item.volume_7d ?? 0) >= VOLUME_MINIMO);
  const maisNegociado = [...base].sort((a, b) => (b.volume_7d ?? 0) - (a.volume_7d ?? 0))[0];
  // A abertura é agregada: o mais negociado é quase sempre o mesmo item e não deve virar vitrine fixa.
  if (comVariacao.length) {
    const subiram = comVariacao.filter((item) => item.variacao_7d! > 0).length;
    const ordenadas = comVariacao.map((item) => item.variacao_7d!).sort((a, b) => a - b);
    const mediana = ordenadas[Math.floor(ordenadas.length / 2)]!;
    coruja.abertura = t(
      `Subiram ${subiram} de ${comVariacao.length} na semana. Variação mediana: ${formatarVariacao(mediana)}.`,
      `${subiram} of ${comVariacao.length} rose this week. Median change: ${formatarVariacao(mediana)}.`,
    );
  }
  if (maisNegociado?.volume_7d) {
    coruja.linhas.push(
      t(
        `Mais negociado aqui: ${maisNegociado.nome}. ${formatarInteiro(maisNegociado.volume_7d)} vendas em 7 dias.`,
        `Most traded here: ${maisNegociado.nome}. ${formatarInteiro(maisNegociado.volume_7d)} sales in 7 days.`,
      ),
    );
  }
  // Alta grande com pouca venda: o caso clássico de preço que volta.
  const suspeito = comVariacao
    .filter((item) => item.variacao_7d! > 0.1 && (item.volume_7d ?? 0) < VOLUME_MINIMO)
    .sort((a, b) => b.variacao_7d! - a.variacao_7d!)[0];
  if (suspeito) {
    coruja.linhas.push(
      t(
        `${suspeito.nome}: ${formatarVariacao(suspeito.variacao_7d!)} com ${formatarInteiro(suspeito.volume_7d ?? 0)} vendas. Volume baixo. Desconfie.`,
        `${suspeito.nome}: ${formatarVariacao(suspeito.variacao_7d!)} on ${formatarInteiro(suspeito.volume_7d ?? 0)} sales. Thin volume. Be wary.`,
      ),
    );
  }
  const leituras = sinais.filter((sinal) => sinal.tipo === "leitura");
  const touros = leituras.filter((sinal) => sinal.nivel === "alta_forte").length;
  const ursos = leituras.filter((sinal) => sinal.nivel === "baixa_forte").length;
  if (leituras.length) {
    coruja.linhas.unshift(
      t(
        `Nesta página: ${touros} em alta forte, ${ursos} em baixa forte, de ${leituras.length} com leitura.`,
        `On this page: ${touros} strong bull, ${ursos} strong bear, out of ${leituras.length} with a reading.`,
      ),
    );
  }
  if (touros) {
    corvo.linhas.unshift(
      touros === 1
        ? t("Tem um touro forte aqui! Procura o selo verde cheio!", "There's a strong bull here! Look for the solid green badge!")
        : t(`Tem ${touros} touros fortes aqui! Procura o selo verde cheio!`, `There are ${touros} strong bulls here! Look for the solid green badge!`),
    );
  }
  coruja.linhas.push(
    t("Selo de touro não é recomendação. É a leitura do modelo.", "A bull badge isn't advice. It's the model's reading."),
    t("Medalha não é recomendação. É só o que mais se mexeu.", "A medal isn't advice. It's just what moved most."),
    t("Abra um item. A previsão está lá, com a faixa.", "Open an item. The forecast is there, with its range."),
  );

  const alta = [...negociados].sort((a, b) => b.variacao_7d! - a.variacao_7d!)[0];
  if (alta && alta.variacao_7d! > 0) {
    corvo.linhas.push(t(`Quem mais subiu: ${alta.nome}, ${formatarVariacao(alta.variacao_7d!)}! Eu vi!`, `Top riser: ${alta.nome}, ${formatarVariacao(alta.variacao_7d!)}! I saw it!`));
  }
  const barato = [...base].filter((item) => item.preco_atual != null).sort((a, b) => a.preco_atual! - b.preco_atual!)[0];
  if (barato) {
    corvo.linhas.push(t(`O mais barato aqui: ${barato.nome}, ${formatarPreco(barato.preco_atual!)}! Barato! Eu gosto!`, `Cheapest here: ${barato.nome}, ${formatarPreco(barato.preco_atual!)}! Cheap! I like it!`));
  }
  corvo.linhas.push(
    t("Ordena por Maiores quedas! Às vezes tem pechincha! Às vezes tem armadilha!", "Sort by Biggest drops! Sometimes a bargain! Sometimes a trap!"),
    t("Puxa os chaveiros dos cards! Eles balançam!", "Pull the keychains on the cards! They swing!"),
    t("Lista é pra comparar número. Grade é mais bonita. Eu prefiro a grade. Brilha!", "List is for comparing numbers. Grid is prettier. I prefer the grid. Shiny!"),
  );

  return { corvo, coruja };
}

/** Margem que sobra depois da taxa da Steam: quem vende recebe o preço dividido por 1 + taxa. */
export const margemDepoisDaTaxa = (margem: number) => (1 + margem) / (1 + TAXA_STEAM) - 1;

type DadosOportunidades = {
  ranking: RankingOportunidades | undefined;
  horizonte: number;
  pagina: number;
};

export function analiseDasOportunidades({ ranking, horizonte, pagina }: DadosOportunidades): FalasDaPagina {
  const corvo: Falas = { linhas: [] };
  const coruja: Falas = { linhas: [] };
  if (!ranking) return { corvo, coruja };
  const itens = ranking.itens;
  const primeiro = itens[0];

  if (ranking.motivo === "sem_margem_positiva") {
    corvo.abertura = t("Nada barato hoje! Tudo no preço! Tenta outro horizonte!", "Nothing cheap today! All fairly priced! Try another horizon!");
    coruja.abertura = t(`Em ${horizonte} dias, nenhum item fica acima do preço de hoje. Isso também é informação.`, `In ${horizonte} days, no item ends above today's price. That's information too.`);
  } else if (ranking.motivo) {
    corvo.abertura = t("Os números ainda estão chegando! Espera! Espera!", "The numbers are still coming! Wait! Wait!");
    coruja.abertura = t("Sem previsão para este horizonte ainda. Sem previsão, sem ranking.", "No forecast for this horizon yet. No forecast, no ranking.");
  } else if (primeiro) {
    corvo.abertura = pagina === 1
      ? t(`${ranking.total} oportunidades! A maior: ${primeiro.nome}, ${formatarVariacao(primeiro.margem_estimada)}! Brilha!`, `${ranking.total} opportunities! The biggest: ${primeiro.nome}, ${formatarVariacao(primeiro.margem_estimada)}! Shiny!`)
      : t(`Página ${pagina}! As margens aqui são menores! Mas eu guardei todas!`, `Page ${pagina}! Smaller margins here! But I kept them all!`);
    const altos = itens.filter((item) => item.risco === "alto").length;
    const baixos = itens.filter((item) => item.risco === "baixo").length;
    coruja.abertura = t(
      `Nesta página: ${baixos} com risco baixo, ${altos} com risco alto, de ${itens.length}. Margem não é retorno.`,
      `On this page: ${baixos} low risk, ${altos} high risk, out of ${itens.length}. Margin isn't return.`,
    );
  }

  if (primeiro && !ranking.motivo) {
    const liquida = margemDepoisDaTaxa(primeiro.margem_estimada);
    coruja.linhas.push(
      liquida > 0
        ? t(`${primeiro.nome}: ${formatarVariacao(primeiro.margem_estimada)} de margem. Depois da taxa da Steam, ${formatarVariacao(liquida)}.`, `${primeiro.nome}: ${formatarVariacao(primeiro.margem_estimada)} margin. After the Steam fee, ${formatarVariacao(liquida)}.`)
        : t(`${primeiro.nome}: ${formatarVariacao(primeiro.margem_estimada)} de margem. A taxa da Steam come tudo.`, `${primeiro.nome}: ${formatarVariacao(primeiro.margem_estimada)} margin. The Steam fee eats all of it.`),
    );
    // Margem alta com risco alto: o caso que mais engana no topo do ranking.
    const armadilha = itens.slice(0, 5).find((item) => item.risco === "alto");
    if (armadilha) {
      coruja.linhas.push(t(
        `${armadilha.nome} está no topo com risco alto. Pouca venda ou oscilação grande. Abra os motivos.`,
        `${armadilha.nome} is near the top with high risk. Thin volume or big swings. Open the reasons.`,
      ));
    }
    const seguro = itens.find((item) => item.risco === "baixo");
    if (seguro) {
      corvo.linhas.push(t(
        `A melhor com risco baixo: ${seguro.nome}, ${formatarVariacao(seguro.margem_estimada)}! Essa a coruja aprova! Quase!`,
        `Best low-risk one: ${seguro.nome}, ${formatarVariacao(seguro.margem_estimada)}! The owl approves! Almost!`,
      ));
    }
  }
  if (ranking.itens_desatualizados > 0) {
    coruja.linhas.push(t(
      `${formatarInteiro(ranking.itens_desatualizados)} usam preços antigos. Confira a data-base antes de agir.`,
      `${formatarInteiro(ranking.itens_desatualizados)} use old prices. Check the base date before acting.`,
    ));
  }
  coruja.linhas.push(
    t("A margem é sobre a média prevista da janela, não sobre um dia só.", "The margin is on the window's predicted average, not on a single day."),
    t("Risco baixo não é risco zero. É o critério de referência.", "Low risk isn't zero risk. It's the reference criterion."),
  );
  corvo.linhas.push(
    t("Clica no risco de um item! Ele conta o porquê! Eu já sei de cor!", "Click an item's risk! It tells you why! I know it by heart!"),
    t("Troca pra 30 dias! As margens ficam maiores! A faixa também! A coruja reclama!", "Switch to 30 days! Margins get bigger! So does the range! The owl complains!"),
    t("O primeiro lugar ganha medalha! Eu queria uma! Ninguém me dá!", "First place gets a medal! I want one! Nobody gives me one!"),
  );

  return { corvo, coruja };
}

type DadosAlertas = { logado: boolean; alertas: Alerta[] | undefined };

export function analiseDosAlertas({ logado, alertas }: DadosAlertas): FalasDaPagina {
  const corvo: Falas = { linhas: [] };
  const coruja: Falas = { linhas: [] };

  if (!logado) {
    corvo.abertura = t("Entra com a Steam! Aí eu vigio os preços pra você! De graça!", "Sign in with Steam! Then I'll watch prices for you! For free!");
    coruja.abertura = t("Sem conta, sem alerta. O alerta fica guardado nela.", "No account, no alerts. They're saved to it.");
    return { corvo, coruja };
  }
  if (!alertas) return { corvo, coruja };

  if (alertas.length === 0) {
    corvo.abertura = t("Nenhum alerta! Escolhe um item ali em cima! Eu vigio! Eu não durmo!", "No alerts! Pick an item up there! I'll watch! I never sleep!");
    coruja.abertura = t("Escolha um alvo realista. A faixa da previsão ajuda.", "Pick a realistic target. The forecast range helps.");
  } else {
    const disparados = alertas.filter((alerta) => alerta.estado === "disparado");
    const vigiando = alertas.filter((alerta) => alerta.estado === "aguardando");
    const pausados = alertas.length - disparados.length - vigiando.length;
    const novo = disparados.find((alerta) => !alerta.visto) ?? disparados[0];

    corvo.abertura = novo
      ? t(`${novo.item.nome} chegou no preço! Eu avisei! Eu sempre aviso!`, `${novo.item.nome} hit the price! I told you! I always tell you!`)
      : t(`${vigiando.length} ${vigiando.length === 1 ? "alerta" : "alertas"} de vigia! Eu fico de olho! Os dois olhos!`, `${vigiando.length} ${vigiando.length === 1 ? "alert" : "alerts"} on watch! I'm keeping an eye out! Both eyes!`);

    const distancias = vigiando
      .map((alerta) => ({ alerta, falta: quantoFalta(alerta, alerta.item.preco_atual) }))
      .filter((par): par is { alerta: Alerta; falta: number } => par.falta !== null)
      .sort((a, b) => a.falta - b.falta);
    const maisPerto = distancias[0];
    if (maisPerto) {
      coruja.abertura = t(
        `O mais perto: ${maisPerto.alerta.item.nome}, a ${semSinal(maisPerto.falta)} do alvo.`,
        `Closest: ${maisPerto.alerta.item.nome}, ${semSinal(maisPerto.falta)} from target.`,
      );
    } else if (disparados.length) {
      coruja.abertura = t("Disparado não vigia mais. Troque o alvo para vigiar de novo.", "A triggered alert stops watching. Change the target to watch again.");
    }
    const maisLonge = distancias.at(-1);
    if (maisLonge && maisLonge !== maisPerto && maisLonge.falta > 0.3) {
      coruja.linhas.push(t(
        `${maisLonge.alerta.item.nome} precisa andar ${semSinal(maisLonge.falta)}. Pode demorar. Pode não vir.`,
        `${maisLonge.alerta.item.nome} needs to move ${semSinal(maisLonge.falta)}. It may take a while. It may not come.`,
      ));
    }
    if (pausados) {
      coruja.linhas.push(t(`${pausados} ${pausados === 1 ? "pausado" : "pausados"}. Pausado não dispara.`, `${pausados} paused. Paused ones don't trigger.`));
    }
    if (disparados.length) {
      corvo.linhas.push(t("Disparou? Muda o alvo que ele vigia de novo!", "Triggered? Change the target and it watches again!"));
    }
  }

  coruja.linhas.push(
    t("Confiro uma vez por dia, depois da coleta. Preço de minuto não existe aqui.", "I check once a day, after the collection. There are no minute prices here."),
    t("Alvo que o preço de hoje já passou é recusado. Dispararia na hora.", "A target today's price already passed is refused. It would trigger at once."),
    t("Lembre da taxa da Steam ao vender. Uns 15%.", "Remember the Steam fee when selling. About 15%."),
  );
  corvo.linhas.push(
    t("Alerta de queda é pra comprar! De alta é pra vender! Eu sei tudo!", "A drop alert is for buying! A rise alert is for selling! I know everything!"),
    t("Quando dispara, o sino lá em cima fica verde! Igual na Steam! Brilha!", "When one triggers, the bell up top turns green! Just like Steam! Shiny!"),
  );

  return { corvo, coruja };
}
