import { type ReactNode, useRef } from "react";
import { Link } from "react-router";

import { type ItemResumo, useHistorico, useItens } from "../../api/itens";
import { useOportunidades } from "../../api/oportunidades";
import { Carregando, IconeItem, Rotulo, Variacao } from "../../componentes/Basicos";
import { ChaveirosDoItem } from "../../componentes/chaveiro/Chaveiro";
import { Sparkline } from "../../componentes/Sparkline";
import { diasAntes, formatarInteiro, formatarPreco, formatarVariacao } from "../../lib/formato";
import { CabecalhoSecao, Container } from "./ui";

// Abaixo disso a variação da semana vem de pouquíssimas vendas e não diz muito.
const VOLUME_MINIMO = 50;

const COR_RISCO = { baixo: "text-destaque", moderado: "text-amber-300", alto: "text-queda" } as const;

type Base = {
  id: number;
  appid: number;
  nome: string;
  tipo: string | null;
  icon_url: string | null;
  data_preco?: string | null;
};

/** Um "terminal" compacto: o motivo do destaque, o item, o preço, um dado e o gráfico de 30 dias. */
function TerminalItem({
  rotulo,
  item,
  preco,
  detalhe,
  rodape,
  semDados,
}: {
  semDados?: string;
  rotulo: string;
  item: Base | undefined;
  preco: number | null | undefined;
  detalhe: ReactNode;
  rodape: ReactNode;
}) {
  const inicio = item?.data_preco ? diasAntes(item.data_preco, 30) : diasAntes(new Date().toISOString().slice(0, 10), 30);
  const { data: pontos } = useHistorico(item?.id ?? 0, inicio, item !== undefined);
  const card = useRef<HTMLAnchorElement & HTMLDivElement>(null);

  const conteudo = item ? (
    <div className="space-y-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <IconeItem url={item.icon_url} nome={item.nome} tamanho={40} />
        <div className="min-w-0">
          <p className="truncate text-sm">{item.nome}</p>
          <p className="truncate text-xs text-apagado">{item.tipo ?? " "}</p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-mono text-2xl">{preco != null ? formatarPreco(preco) : "—"}</p>
        <div className="font-mono text-xs">{detalhe}</div>
      </div>
      <Sparkline valores={pontos?.map((ponto) => ponto.preco) ?? []} largura={220} altura={44} />
      <p className="border-t border-borda pt-3 font-mono text-[11px] text-apagado">{rodape}</p>
    </div>
  ) : semDados ? (
    <p className="p-4 text-sm text-suave">{semDados}</p>
  ) : (
    <Carregando />
  );

  const cabecalho = (
    <div className="flex h-10 items-center justify-between border-b border-borda px-4">
      <Rotulo destaque>{rotulo}</Rotulo>
      <span className="font-mono text-sm text-apagado transition-colors group-hover:text-destaque" aria-hidden>
        ↗
      </span>
    </div>
  );
  const classe = "group flex min-w-0 flex-col rounded-2xl border border-borda bg-painel transition-colors";

  return item ? (
    <div className="relative flex min-w-0">
      <Link ref={card} to={`/itens/${item.id}`} data-poleiro className={`${classe} w-full hover:border-destaque/40`}>
        {cabecalho}
        {conteudo}
      </Link>
      {/* Chaveiros do jogo e do tipo do item. Só com os quatro terminais lado a lado: em colunas
          empilhadas eles cairiam por cima do terminal de baixo. */}
      <ChaveirosDoItem item={item} parede={card} direita="1rem" className="hidden lg:block" />
    </div>
  ) : (
    <div data-poleiro className={classe}>
      {cabecalho}
      {conteudo}
    </div>
  );
}

/** Seção de destaques: quatro terminais com os itens que mais se destacaram na semana. */
export function DestaquesDaSemana() {
  const itens = useItens({ por_pagina: 100 }).data?.itens ?? [];
  const ranking = useOportunidades(7, 1).data;
  const negociados = itens.filter((item) => item.variacao_7d != null && (item.volume_7d ?? 0) >= VOLUME_MINIMO);
  const porVariacao = [...negociados].sort((a, b) => b.variacao_7d! - a.variacao_7d!);
  const alta: ItemResumo | undefined = porVariacao[0];
  const queda: ItemResumo | undefined = porVariacao.at(-1);
  const maisNegociado = [...itens].sort((a, b) => (b.volume_7d ?? 0) - (a.volume_7d ?? 0))[0];
  // A melhor oportunidade que ainda não aparece nos outros terminais, para não repetir item.
  const jaMostrados = new Set([alta?.id, queda?.id, maisNegociado?.id]);
  const oportunidade = ranking?.itens.find((o) => !jaMostrados.has(o.item_id)) ?? ranking?.itens[0];
  const itemOportunidade = oportunidade && itens.find((item) => item.id === oportunidade.item_id);

  const vendas = (item: ItemResumo | undefined) =>
    item?.volume_7d != null ? `${formatarInteiro(item.volume_7d)} vendas em 7 dias` : "Sem vendas registradas";

  return (
    <section className="border-t border-borda py-20 sm:py-28">
      <Container className="space-y-10">
        <CabecalhoSecao
          rotulo="Destaques da semana"
          titulo="Quem mais se mexeu nos últimos 7 dias."
          texto="Atualizado a cada coleta, com os preços do Mercado da Steam. Clique num terminal para abrir o item."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TerminalItem
            rotulo="Maior alta em 7 dias"
            item={alta}
            preco={alta?.preco_atual}
            detalhe={<Variacao valor={alta?.variacao_7d} />}
            rodape={vendas(alta)}
          />
          <TerminalItem
            rotulo="Maior queda em 7 dias"
            item={queda}
            preco={queda?.preco_atual}
            detalhe={<Variacao valor={queda?.variacao_7d} />}
            rodape={vendas(queda)}
          />
          <TerminalItem
            rotulo="Mais negociado"
            item={maisNegociado}
            preco={maisNegociado?.preco_atual}
            detalhe={<Variacao valor={maisNegociado?.variacao_7d} />}
            rodape={vendas(maisNegociado)}
          />
          <TerminalItem
            rotulo="Maior margem prevista"
            semDados={ranking && !oportunidade ? "Nenhum item com margem positiva prevista agora." : undefined}
            item={
              oportunidade && {
                id: oportunidade.item_id,
                appid: itemOportunidade?.appid ?? 0,
                nome: oportunidade.nome,
                tipo: oportunidade.tipo,
                icon_url: oportunidade.icon_url,
                data_preco: itemOportunidade?.data_preco,
              }
            }
            preco={oportunidade?.preco_atual}
            detalhe={
              oportunidade && (
                <span>
                  <span className="text-destaque">{formatarVariacao(oportunidade.margem_estimada)}</span>{" "}
                  <span className="text-apagado">até {formatarPreco(oportunidade.preco_previsto)} em 7 dias</span>
                </span>
              )
            }
            rodape={
              oportunidade ? (
                <span>
                  Risco <span className={COR_RISCO[oportunidade.risco]}>{oportunidade.risco}</span>
                </span>
              ) : (
                "Sem oportunidade com margem positiva"
              )
            }
          />
        </div>
      </Container>
    </section>
  );
}
