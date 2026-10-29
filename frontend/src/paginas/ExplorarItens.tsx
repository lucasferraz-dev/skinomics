import { useEffect, useEffectEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { type FiltrosItens, type ItemResumo, type PontoHistorico, useHistorico, useItens } from "../api/itens";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { Sparkline } from "../componentes/Sparkline";
import { diasAntes, formatarData, formatarInteiro, formatarPreco, formatarVariacao } from "../lib/formato";

type Ordenacao = NonNullable<FiltrosItens["ordenar"]>;
type Direcao = NonNullable<FiltrosItens["direcao"]>;

const POR_PAGINA = 20;

/** Os filtros moram na URL: dá para compartilhar o link e o "voltar" do navegador funciona. */
function useFiltrosDaUrl() {
  const [parametros, setParametros] = useSearchParams();
  const filtros: FiltrosItens = {
    busca: parametros.get("busca") ?? undefined,
    ordenar: (parametros.get("ordenar") as Ordenacao | null) ?? "volume_7d",
    direcao: (parametros.get("direcao") as Direcao | null) ?? "desc",
    pagina: Number(parametros.get("pagina") ?? 1),
    por_pagina: POR_PAGINA,
  };

  function atualizar(mudancas: Partial<Record<"busca" | "ordenar" | "direcao" | "pagina", string>>) {
    setParametros(
      (atual) => {
        const novo = new URLSearchParams(atual);
        for (const [nome, valor] of Object.entries(mudancas)) {
          if (valor) novo.set(nome, valor);
          else novo.delete(nome);
        }
        // Qualquer mudança que não seja de página volta para a primeira.
        if (!("pagina" in mudancas)) novo.delete("pagina");
        return novo;
      },
      { replace: true },
    );
  }

  return { filtros, atualizar };
}

export function ExplorarItens() {
  const { filtros, atualizar } = useFiltrosDaUrl();
  const { data, isPending, isError, isPlaceholderData } = useItens(filtros);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Rotulo destaque>No radar / Team Fortress 2</Rotulo>
          <h1 className="text-3xl titulo sm:text-4xl">Explorar itens</h1>
        </div>
        <p className="max-w-sm text-sm text-suave">
          Compare preço, movimento da semana e liquidez. Clique em um item para ver o histórico completo.
        </p>
      </header>

      <Painel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda p-3 sm:p-4">
          <span className="font-mono text-xs text-suave">
            {data ? `${formatarInteiro(data.total)} itens` : " "}
          </span>
          <CampoBusca valorInicial={filtros.busca ?? ""} aoBuscar={(busca) => atualizar({ busca })} />
        </div>

        {isPending ? (
          <Carregando texto="Carregando itens…" />
        ) : isError ? (
          <MensagemErro titulo="Não foi possível carregar os itens." detalhe="Confira se a API está no ar." />
        ) : data.itens.length === 0 ? (
          <MensagemErro titulo="Nenhum item encontrado." detalhe="Tente outro termo de busca." />
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[800px] text-left">
              <thead className="whitespace-nowrap">
                <tr className="border-b border-borda">
                  <Cabecalho rotulo="Item" coluna="nome" filtros={filtros} atualizar={atualizar} />
                  <Cabecalho rotulo="Preço" coluna="preco" filtros={filtros} atualizar={atualizar} alinharDireita />
                  <Cabecalho rotulo="Var. 7d" coluna="variacao_7d" filtros={filtros} atualizar={atualizar} alinharDireita />
                  <th className="px-4 py-3"><Rotulo>Tendência 30d</Rotulo></th>
                  <Cabecalho rotulo="Volume 7d" coluna="volume_7d" filtros={filtros} atualizar={atualizar} alinharDireita />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item) => (
                  <LinhaItem key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > POR_PAGINA && (
          <Paginacao pagina={data.pagina} total={data.total} aoMudar={(pagina) => atualizar({ pagina: String(pagina) })} />
        )}
      </Painel>

      <p className="text-xs text-apagado">
        Preços em dólar (US$) do Mercado da Comunidade Steam, um ponto por dia. Variação e volume contam os
        últimos 7 dias com preço de cada item.
      </p>
    </div>
  );
}

function CampoBusca({ valorInicial, aoBuscar }: { valorInicial: string; aoBuscar: (busca: string) => void }) {
  const [texto, setTexto] = useState(valorInicial);
  // useEffectEvent: chama sempre o aoBuscar mais recente sem reiniciar a espera a cada render.
  const buscar = useEffectEvent((termo: string) => aoBuscar(termo));

  // Espera a pessoa parar de digitar antes de consultar a API.
  useEffect(() => {
    if (texto === valorInicial) return;
    const espera = setTimeout(() => buscar(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto, valorInicial]);

  return (
    <label className="flex w-full items-center gap-2 rounded-lg border border-borda bg-fundo px-3 py-2 focus-within:border-destaque/50 sm:w-72">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-apagado" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Buscar item de TF2…"
        aria-label="Buscar item"
        className="w-full bg-transparent text-sm outline-none placeholder:text-apagado"
      />
    </label>
  );
}

function Cabecalho({
  rotulo,
  coluna,
  filtros,
  atualizar,
  alinharDireita = false,
}: {
  rotulo: string;
  coluna: Ordenacao;
  filtros: FiltrosItens;
  atualizar: ReturnType<typeof useFiltrosDaUrl>["atualizar"];
  alinharDireita?: boolean;
}) {
  const ativa = filtros.ordenar === coluna;
  // Primeiro clique: nome em ordem alfabética, números do maior para o menor.
  const proxima: Direcao = ativa ? (filtros.direcao === "desc" ? "asc" : "desc") : coluna === "nome" ? "asc" : "desc";

  return (
    <th className={`px-4 py-3 ${alinharDireita ? "text-right" : ""}`} aria-sort={ativa ? (filtros.direcao === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => atualizar({ ordenar: coluna, direcao: proxima })}
        className={`inline-flex items-center gap-1 ${ativa ? "[&>span]:text-texto" : "hover:[&>span]:text-texto"}`}
      >
        <Rotulo>{rotulo}</Rotulo>
        {ativa && <span className="font-mono text-[11px]">{filtros.direcao === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

export function LinhaItem({ item }: { item: ItemResumo }) {
  const inicio = item.data_preco ? diasAntes(item.data_preco, 30) : undefined;
  const historico = useHistorico(item.id, inicio, item.data_preco !== null);

  return (
    // A linha inteira é clicável: o link do nome se estende sobre ela (after:absolute).
    <tr className="relative border-b border-borda/60 transition-colors last:border-0 hover:bg-painel-alto">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <IconeItem url={item.icon_url} nome={item.nome} />
          <div className="min-w-0">
            <Link to={`/itens/${item.id}`} className="block truncate text-sm after:absolute after:inset-0">
              {item.nome}
            </Link>
            <span className="text-xs text-apagado">{item.tipo ?? "Team Fortress 2"}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">
        {item.preco_atual !== null ? formatarPreco(item.preco_atual) : <span className="text-apagado">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <Variacao valor={item.variacao_7d} />
      </td>
      <td className="px-4 py-3">
        <Tendencia pontos={historico.data} />
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-suave">
        {item.volume_7d !== null ? formatarInteiro(item.volume_7d) : "—"}
      </td>
      <td className="pr-4 text-right text-apagado" aria-hidden>↗</td>
    </tr>
  );
}

/**
 * Mini gráfico de 30 dias com a variação do mês ao lado. Sem o número, um item que subiu
 * na semana (Var. 7d verde) mas caiu no mês (gráfico vermelho) parecia um erro.
 */
function Tendencia({ pontos }: { pontos: PontoHistorico[] | undefined }) {
  const primeiro = pontos?.[0];
  const ultimo = pontos?.at(-1);
  if (!pontos || !primeiro || !ultimo || pontos.length < 2) {
    return <Sparkline valores={[]} />;
  }

  const variacao = ultimo.preco / primeiro.preco - 1;
  const titulo = `${formatarData(primeiro.data)} – ${formatarData(ultimo.data)}: ${formatarVariacao(variacao)}`;
  return (
    <div className="flex items-center gap-3">
      <Sparkline valores={pontos.map((ponto) => ponto.preco)} titulo={titulo} />
      <span className="text-xs">
        <Variacao valor={variacao} />
      </span>
    </div>
  );
}

function Paginacao({ pagina, total, aoMudar }: { pagina: number; total: number; aoMudar: (pagina: number) => void }) {
  const ultima = Math.ceil(total / POR_PAGINA);
  const botao = "rounded-md border border-borda px-3 py-1.5 font-mono text-xs enabled:hover:border-suave disabled:opacity-40";
  return (
    <div className="flex items-center justify-between border-t border-borda p-3 sm:px-4">
      <span className="font-mono text-xs text-suave">
        {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
      </span>
      <div className="flex gap-2">
        <button type="button" className={botao} disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
          Anterior
        </button>
        <button type="button" className={botao} disabled={pagina >= ultima} onClick={() => aoMudar(pagina + 1)}>
          Próxima
        </button>
      </div>
    </div>
  );
}
