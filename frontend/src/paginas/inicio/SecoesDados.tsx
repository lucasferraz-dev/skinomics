import { Link } from "react-router";

import { useItens } from "../../api/itens";
import { Carregando, IconeItem, Painel, Rotulo, Variacao } from "../../componentes/Basicos";
import { GraficoHistorico } from "../../componentes/GraficoHistorico";
import { MarcaLogo } from "../../componentes/Logo";
import { formatarData, formatarPreco } from "../../lib/formato";
import { LinhaItem } from "../ExplorarItens";
import { useItemVitrine } from "./dados";
import { CabecalhoSecao, Container } from "./ui";

/** Seção 2: uma "janela" do Terminal com o gráfico real da Key. */
export function PreviaDaPlataforma() {
  const { item, pontos } = useItemVitrine(90);

  return (
    <section id="plataforma" className="scroll-mt-16 py-20 sm:py-28">
      <Container className="space-y-10">
        <CabecalhoSecao
          rotulo="Uma visão além do preço"
          titulo={
            <>
              O mercado muda.
              <br />
              Sua leitura também.
            </>
          }
          texto="Do histórico ao próximo cenário: conecte os sinais antes de decidir o que fazer com seus itens."
          selo="Prévia da plataforma · dados reais"
        />

        <div className="overflow-hidden rounded-2xl border border-borda bg-painel">
          <div className="flex h-12 items-center justify-between border-b border-borda px-4">
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              <MarcaLogo tamanho={18} />
              Terminal <span className="font-normal text-apagado">/ Team Fortress 2</span>
            </span>
            <span className="rounded bg-destaque-fundo px-2 py-0.5 font-rotulo text-xs font-semibold tracking-[0.06em] text-destaque">
              Prévia
            </span>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
            <div className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {item && <IconeItem url={item.icon_url} nome={item.nome} tamanho={44} />}
                  <div className="min-w-0">
                    <p className="truncate text-lg">{item?.nome ?? " "}</p>
                    <Rotulo>TF2 / {item?.tipo ?? "Item"}</Rotulo>
                  </div>
                </div>
                {item && (
                  <Link
                    to={`/itens/${item.id}`}
                    className="shrink-0 rounded-lg border border-borda px-3 py-1.5 text-sm transition-colors hover:border-suave"
                  >
                    Abrir no Terminal ↗
                  </Link>
                )}
              </div>

              <div className="rounded-xl border border-borda bg-fundo/40 p-4">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="font-mono text-2xl">
                    {item?.preco_atual != null ? formatarPreco(item.preco_atual) : "—"}
                  </span>
                  <Variacao valor={item?.variacao_7d} sufixo="7d" />
                  <span className="ml-auto font-mono text-[11px] text-apagado">90 dias</span>
                </div>
                {pontos ? <GraficoHistorico pontos={pontos} altura={260} /> : <div className="h-[260px]"><Carregando /></div>}
              </div>
            </div>

            <aside className="space-y-4 rounded-xl border border-borda bg-fundo/40 p-5">
              <Rotulo>Cenário / 7 dias</Rotulo>
              <p className="text-lg">Previsão em breve</p>
              <p className="text-sm text-suave">
                A faixa de preço estimada pelo modelo entra aqui, ao lado do histórico.
              </p>
              <div className="border-t border-borda pt-4">
                <p className="mb-3 text-sm">O que observar</p>
                <ul className="space-y-2 text-sm text-suave">
                  {["Movimento recente de preço", "Oscilação dentro do período", "Liquidez antes de negociar"].map((dica) => (
                    <li key={dica} className="flex gap-2">
                      <span className="text-destaque" aria-hidden>↗</span>
                      {dica}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <p className="mx-4 mb-4 rounded-lg border border-borda px-4 py-3 text-xs text-suave sm:mx-6 sm:mb-6">
            Dados reais do Mercado da Comunidade Steam
            {item?.data_preco ? `, atualizados até ${formatarData(item.data_preco)}` : ""}. Preços em dólar (US$).
          </p>
        </div>

        <div className="grid gap-4 font-rotulo text-[13px] font-semibold tracking-[0.06em] text-apagado sm:grid-cols-3">
          <span>01 / Histórico e tendência no mesmo gráfico</span>
          <span className="sm:text-center">02 / Incerteza visível, não escondida</span>
          <span className="sm:text-right">03 / Contexto para a sua decisão</span>
        </div>
      </Container>
    </section>
  );
}

/** Seção 3: os itens mais negociados da semana, com dados reais. */
export function Radar() {
  const { data } = useItens({ ordenar: "volume_7d", direcao: "desc", por_pagina: 5 });

  return (
    <section className="border-t border-borda py-20 sm:py-28">
      <Container className="space-y-10">
        <CabecalhoSecao
          rotulo="No radar / Team Fortress 2"
          titulo={
            <>
              Cada item conta uma história.
              <br />
              Leia os sinais.
            </>
          }
          texto="Compare movimentos recentes e a liquidez de cada item. Oportunidade começa com uma boa pergunta."
          selo="Os mais negociados da semana"
        />

        <Painel>
          <div className="flex items-center justify-between border-b border-borda px-4 py-3">
            <span className="rounded-md border border-destaque/25 bg-destaque-fundo px-3 py-1.5 text-sm text-destaque">
              Todos os itens
            </span>
            <Link to="/itens" className="text-sm text-suave hover:text-texto">
              Buscar item de TF2…
            </Link>
          </div>
          {data ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead className="whitespace-nowrap">
                  <tr className="border-b border-borda">
                    {["Item", "Preço", "Var. 7d", "Tendência 30d", "Volume 7d", ""].map((titulo, i) => (
                      <th key={i} className={`px-4 py-3 ${i === 1 || i === 2 || i === 4 ? "text-right" : ""}`}>
                        <Rotulo>{titulo}</Rotulo>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.itens.map((item) => (
                    <LinhaItem key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Carregando />
          )}
        </Painel>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-apagado">
          <p>Preços em US$ do Mercado da Comunidade Steam. Efeitos e qualidades alteram o valor de um item.</p>
          <Link to="/itens" className="text-sm text-destaque hover:underline">
            Explorar itens de TF2 →
          </Link>
        </div>
      </Container>
    </section>
  );
}
