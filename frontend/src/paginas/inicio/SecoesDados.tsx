import { t } from "../../lib/idioma";
import { useRef } from "react";
import { Link } from "react-router";

import { useItens, usePrevisao } from "../../api/itens";
import { Carregando, IconeItem, Painel, Rotulo, Variacao } from "../../componentes/Basicos";
import { ChaveirosDoItem } from "../../componentes/chaveiro/Chaveiro";
import { GraficoHistorico } from "../../componentes/GraficoHistorico";
import { MarcaLogo } from "../../componentes/Logo";
import { formatarData, formatarDiaMes, formatarPreco } from "../../lib/formato";
import { LinhaItem } from "../ExplorarItens";
import { useItemVitrine } from "./dados";
import { BotaoSecundario, CabecalhoSecao, Container, SetaTrocando } from "./ui";

/** Seção 2: uma "janela" do Terminal com o histórico e a previsão reais do item da vitrine. */
export function PreviaDaPlataforma() {
  const { item, pontos } = useItemVitrine(90);
  const card = useRef<HTMLDivElement>(null);

  return (
    <section id="plataforma" data-tv={t("Prévia", "Preview")} data-tv-chave="previa" className="scroll-mt-32 py-14 sm:py-28">
      <Container className="space-y-10">
        <CabecalhoSecao
          rotulo={t("Prévia", "Preview")}
          titulo={
            <>
              {t("Histórico e previsão", "History and forecast")}
              <br />
              {t("na mesma tela.", "on one screen.")}
            </>
          }
          texto={t("É assim que cada item aparece no Terminal: o preço diário dos últimos meses e a previsão do modelo, com a faixa onde o preço deve ficar.", "This is how each item looks in the Terminal: the daily price over recent months and the model's forecast, with the range where the price should land.")}
          selo={t("Dados reais", "Real data")}
        />

        <div data-tour="previa" className="relative">
          <div ref={card} data-poleiro className="overflow-hidden rounded-2xl border border-borda bg-painel">
            <div className="flex h-12 items-center justify-between border-b border-borda px-4">
              <span className="flex items-center gap-2.5 text-sm font-semibold">
                <MarcaLogo tamanho={18} />
                Terminal
              </span>
              <span className="rounded bg-destaque-fundo px-2 py-0.5 font-rotulo text-xs font-semibold tracking-[0.06em] text-destaque">
                {t("Prévia", "Preview")}
              </span>
            </div>

            <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {item && <IconeItem url={item.icon_url} nome={item.nome} tamanho={44} />}
                    <div className="min-w-0">
                      <p className="truncate text-lg">{item?.nome ?? " "}</p>
                      <Rotulo>{item?.tipo ?? "Item"}</Rotulo>
                    </div>
                  </div>
                  {item && (
                    <BotaoSecundario para={`/itens/${item.id}`} tamanho="sm" className="text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        Abrir no Terminal <SetaTrocando />
                      </span>
                    </BotaoSecundario>
                  )}
                </div>

                <div className="rounded-xl border border-borda bg-fundo/40 p-4">
                  <div className="mb-4 flex items-baseline gap-3">
                    <span className="font-mono text-2xl">
                      {item?.preco_atual != null ? formatarPreco(item.preco_atual) : "—"}
                    </span>
                    <Variacao valor={item?.variacao_7d} sufixo="7d" />
                    <span className="ml-auto hidden font-mono text-[11px] text-apagado sm:inline">90 dias</span>
                  </div>
                  {pontos ? <GraficoHistorico pontos={pontos} altura={260} /> : <div className="h-[260px]"><Carregando /></div>}
                </div>
              </div>

              <PrevisaoVitrine itemId={item?.id} />
            </div>

            <p className="mx-4 mb-4 rounded-lg border border-borda px-4 py-3 text-xs text-suave sm:mx-6 sm:mb-6">
              {t("Dados reais do Mercado da Comunidade Steam", "Real data from the Steam Community Market")}
              {item?.data_preco ? t(`, atualizados até ${formatarData(item.data_preco)}`, `, updated through ${formatarData(item.data_preco)}`) : ""}{t(". Preços em dólar (US$).", ". Prices in US dollars.")}
            </p>
          </div>
          {/* Pendurado embaixo do card, que funciona como parede para ele. */}
          <ChaveirosDoItem item={item} parede={card} direita="30%" className="hidden sm:block" />
        </div>
      </Container>
    </section>
  );
}

/** Painel lateral da prévia: a previsão de 7 dias publicada para o item. */
function PrevisaoVitrine({ itemId }: { itemId: number | undefined }) {
  const { data: previsao } = usePrevisao(itemId ?? 0, 7, itemId !== undefined);
  const linhas: [string, string][] =
    previsao?.disponivel && previsao.preco_previsto != null
      ? [
          [
            t("Faixa de 80%", "80% range"),
            previsao.intervalo_inferior != null && previsao.intervalo_superior != null
              ? `${formatarPreco(previsao.intervalo_inferior)}${t(" a ", " to ")}${formatarPreco(previsao.intervalo_superior)}`
              : t("indisponível", "unavailable"),
          ],
          [
            t("Média entre", "Average between"),
            previsao.janela_inicio && previsao.janela_fim
              ? `${formatarDiaMes(previsao.janela_inicio)}${t(" e ", " and ")}${formatarDiaMes(previsao.janela_fim)}`
              : "—",
          ],
          [t("Preço de base", "Base price"), previsao.preco_base != null ? formatarPreco(previsao.preco_base) : "—"],
        ]
      : [];

  return (
    <aside className="space-y-4 rounded-xl border border-borda bg-fundo/40 p-5">
      <Rotulo>{t("Previsão para 7 dias", "7-day forecast")}</Rotulo>
      {!previsao ? (
        <Carregando />
      ) : previsao.disponivel && previsao.preco_previsto != null ? (
        <>
          <div className="space-y-1">
            <p className="font-mono text-3xl">{formatarPreco(previsao.preco_previsto)}</p>
            <p className="font-mono text-sm">
              <Variacao valor={previsao.variacao_prevista} /> <span className="text-apagado">{t("em relação a hoje", "vs. today")}</span>
            </p>
          </div>
          <dl className="space-y-2 border-t border-borda pt-4 text-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex justify-between gap-3">
                <dt className="whitespace-nowrap text-suave">{rotulo}</dt>
                <dd className="text-right font-mono">{valor}</dd>
              </div>
            ))}
          </dl>
          {previsao.incerteza_elevada && (
            <p className="text-xs text-queda">{t("Incerteza elevada: a faixa está larga para este item.", "High uncertainty: the range is wide for this item.")}</p>
          )}
          <p className="text-xs text-apagado">{t("Estimativa do modelo, não recomendação de compra ou venda.", "Model estimate, not a buy or sell recommendation.")}</p>
        </>
      ) : (
        <p className="text-sm text-suave">{t("Ainda não há previsão publicada para este item.", "No forecast published for this item yet.")}</p>
      )}
    </aside>
  );
}

/** Seção 3: os itens mais negociados da semana, com dados reais. */
export function Radar() {
  // Os cinco mais negociados saem da lista completa que o resto da landing já carrega.
  const lista = useItens({ por_pagina: 100 }).data;
  const data = lista && {
    itens: [...lista.itens].sort((a, b) => (b.volume_7d ?? 0) - (a.volume_7d ?? 0)).slice(0, 5),
  };

  return (
    <section data-tv={t("Mais negociados", "Most traded")} data-tv-chave="radar" className="py-14 sm:py-28">
      <Container className="space-y-10">
        <CabecalhoSecao
          rotulo={t("No radar", "On the radar")}
          titulo={
            <>
              {t("Os itens mais negociados", "The most traded items")}
              <br />
              {t("da semana.", "of the week.")}
            </>
          }
          texto={t("Preço, variação em 7 dias, tendência de 30 dias e quantas unidades foram vendidas no Mercado da Steam.", "Price, 7-day change, 30-day trend and how many units sold on the Steam Market.")}
        />

        {/* A tabela também é poleiro: a borda de cima é larga e cabe os dois mascotes */}
        <div data-tour="radar" data-poleiro>
        <Painel>
          <div className="flex items-center justify-between border-b border-borda px-4 py-3">
            <span className="rounded-md border border-destaque/25 bg-destaque-fundo px-3 py-1.5 text-sm text-destaque">
              {t("Todos os itens", "All items")}
            </span>
            <Link to="/itens" className="text-sm text-suave hover:text-texto">
              {t("Buscar item…", "Search item…")}
            </Link>
          </div>
          {data ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="whitespace-nowrap">
                  <tr className="border-b border-borda">
                    {["Item", t("Preço", "Price"), t("Var. 7d", "7d chg."), t("Tendência 30d", "30d trend"), t("Volume 7d", "7d volume"), ""].map((titulo, i) => (
                      <th key={i} className={`px-4 py-3 ${i === 1 || i === 2 || i === 4 ? "text-right" : ""}`}>
                        <Rotulo>{titulo}</Rotulo>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.itens.map((item) => (
                    <LinhaItem key={item.id} item={item} chaveiros />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Carregando />
          )}
        </Painel>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-apagado">
          <p>{t("Preços em US$ do Mercado da Comunidade Steam. Efeitos e qualidades alteram o valor de um item.", "Prices in US$ from the Steam Community Market. Effects and qualities change an item's value.")}</p>
          <Link to="/itens" className="group/botao inline-flex items-center gap-1.5 text-sm text-destaque">
            <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/botao:bg-[length:100%_1px]">
              {t("Explorar todos os itens", "Explore all items")}
            </span>
            <span aria-hidden className="transition-transform duration-300 group-hover/botao:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
