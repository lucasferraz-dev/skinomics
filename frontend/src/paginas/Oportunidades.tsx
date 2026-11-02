import { Link, useSearchParams } from "react-router";

import type { HorizontePrevisao } from "../api/itens";
import { type Oportunidade, type RankingOportunidades, useOportunidades } from "../api/oportunidades";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { formatarData, formatarInteiro, formatarPreco } from "../lib/formato";

const HORIZONTES: HorizontePrevisao[] = [7, 15, 30];
const RISCOS = {
  baixo: { nome: "Baixo", cor: "border-destaque/25 bg-destaque-fundo text-destaque" },
  moderado: { nome: "Moderado", cor: "border-borda bg-painel-alto text-texto" },
  alto: { nome: "Alto", cor: "border-queda/30 bg-queda/5 text-queda" },
};

export function Oportunidades() {
  const [parametros, setParametros] = useSearchParams();
  const pedido = Number(parametros.get("horizonte"));
  const horizonte = HORIZONTES.find((h) => h === pedido) ?? 7;
  const numero = Number(parametros.get("pagina") ?? 1);
  const pagina = Number.isSafeInteger(numero) && numero > 0 ? numero : 1;
  const { data, isPending, isError, refetch } = useOportunidades(horizonte, pagina);

  function mudar(h: HorizontePrevisao, p = 1) {
    setParametros({ horizonte: String(h), pagina: String(p) });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Rotulo destaque>No radar / Team Fortress 2</Rotulo>
          <h1 className="text-3xl titulo sm:text-4xl">Oportunidades</h1>
        </div>
        <p className="max-w-sm text-sm text-suave">
          Itens abaixo do preço médio previsto, da maior margem estimada para a menor. Compare também o risco.
        </p>
      </header>

      <Painel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Rotulo>Cenário</Rotulo>
            <div className="flex gap-1" role="group" aria-label="Horizonte da previsão">
              {HORIZONTES.map((h) => (
                <button key={h} type="button" aria-pressed={h === horizonte} onClick={() => mudar(h)}
                  className={`rounded-md border px-3 py-1.5 font-mono text-xs ${h === horizonte ? "border-borda bg-painel-alto text-texto" : "border-transparent text-suave hover:text-texto"}`}>
                  {h} dias
                </button>
              ))}
            </div>
          </div>
          <span className="font-mono text-xs text-suave" aria-live="polite">
            {data ? `${formatarInteiro(data.total)} oportunidades` : " "}
          </span>
        </div>

        {data && data.itens_desatualizados > 0 && (
          <p role="status" className="border-b border-borda px-4 py-3 text-xs leading-relaxed text-suave">
            Exibindo dados históricos para teste: {formatarInteiro(data.itens_desatualizados)} oportunidades usam preços anteriores ao último dia completo. Consulte a data-base e a janela de cada previsão.
          </p>
        )}

        {isPending ? <Carregando texto="Buscando oportunidades…" /> : isError ? (
          <div className="pb-6 text-center">
            <MensagemErro titulo="Não foi possível carregar o ranking." />
            <button type="button" onClick={() => void refetch()} className="text-sm text-destaque hover:underline">Tentar novamente</button>
          </div>
        ) : data.itens.length === 0 ? (
          <EstadoVazio data={data} voltar={() => mudar(horizonte)} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-left">
                <caption className="sr-only">Ranking de oportunidades para {horizonte} dias, ordenado pela margem estimada</caption>
                <thead><tr className="border-b border-borda">
                  {["#", "Item", "Preço-base", "Média prevista", "Margem bruta ↓", "Risco"].map((titulo, i) => (
                    <th scope="col" key={titulo} className={`px-4 py-3 ${i >= 2 && i <= 4 ? "text-right" : ""}`}>
                      <Rotulo>{titulo}</Rotulo>
                    </th>
                  ))}
                </tr></thead>
                <tbody>{data.itens.map((item) => (
                  <tr key={item.item_id} className="border-b border-borda/60 transition-colors last:border-0 hover:bg-painel-alto">
                    <td className="pl-4 font-mono text-xs text-apagado">{String(item.posicao).padStart(2, "0")}</td>
                    <td className="px-4 py-4"><NomeItem item={item} horizonte={horizonte} /></td>
                    <td className="px-4 py-4 text-right font-mono text-sm">{formatarPreco(item.preco_atual)}</td>
                    <td className="px-4 py-4 text-right font-mono text-sm">{formatarPreco(item.preco_previsto)}</td>
                    <td className="px-4 py-4 text-right text-sm"><Margem item={item} /></td>
                    <td className="w-44 px-4 py-4"><Risco item={item} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <ol className="divide-y divide-borda md:hidden" start={(pagina - 1) * 20 + 1}>
              {data.itens.map((item) => (
                <li key={item.item_id} className="space-y-4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-apagado">{String(item.posicao).padStart(2, "0")}</span>
                    <NomeItem item={item} horizonte={horizonte} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="mb-1 text-xs text-suave">Preço-base</dt><dd className="font-mono">{formatarPreco(item.preco_atual)}</dd></div>
                    <div><dt className="mb-1 text-xs text-suave">Média prevista</dt><dd className="font-mono">{formatarPreco(item.preco_previsto)}</dd></div>
                    <div><dt className="mb-1 text-xs text-suave">Margem bruta</dt><dd><Margem item={item} /></dd></div>
                    <div><dt className="mb-1 text-xs text-suave">Risco</dt><dd><Risco item={item} /></dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          </>
        )}

        {data && data.total > data.por_pagina && (
          <div className="flex items-center justify-between border-t border-borda p-4 font-mono text-xs text-suave">
            <span>Página {pagina} de {Math.ceil(data.total / data.por_pagina)}</span>
            <div className="flex gap-2">
              <button type="button" disabled={pagina <= 1} onClick={() => mudar(horizonte, pagina - 1)} className="rounded-md border border-borda px-3 py-1.5 enabled:hover:border-suave disabled:opacity-40">Anterior</button>
              <button type="button" disabled={pagina * data.por_pagina >= data.total} onClick={() => mudar(horizonte, pagina + 1)} className="rounded-md border border-borda px-3 py-1.5 enabled:hover:border-suave disabled:opacity-40">Próxima</button>
            </div>
          </div>
        )}
      </Painel>

      {data?.data_base && (
        <p className="text-xs text-suave">Preços de {formatarData(data.data_base)}. A previsão corresponde à média da janela indicada em cada item, contada a partir dessa data.</p>
      )}
      {data && data.total > 0 && data.itens_sem_previsao_compativel > 0 && (
        <p className="text-xs text-suave">{formatarInteiro(data.itens_sem_previsao_compativel)} itens ainda não têm previsão correspondente ao preço disponível.</p>
      )}
      <Painel className="px-4 py-3 text-xs leading-relaxed text-suave">
        <p>Margem bruta estimada = (preço previsto ÷ preço-base − 1). Valores em US$, sem taxas de negociação. A margem é uma estimativa, não um retorno garantido.</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-texto">Como o risco é calculado</summary>
          <p className="mt-2">O indicador combina volume médio dos últimos 7 dias, oscilação diária dos últimos 30 dias e a faixa da previsão. Clique no risco de um item para ver os motivos.</p>
          <p className="mt-2">Menos de 10 negociações/dia ou oscilação diária a partir de 10% indicam risco alto. Abaixo de 100 negociações/dia ou oscilação a partir de 5%, moderado. Intervalo amplo ou dados insuficientes elevam o risco; uma faixa que inclui queda exige atenção. São critérios de referência, não probabilidades.</p>
        </details>
      </Painel>
    </div>
  );
}

function NomeItem({ item, horizonte }: { item: Oportunidade; horizonte: HorizontePrevisao }) {
  return <div className="flex min-w-0 items-center gap-3">
    <IconeItem url={item.icon_url} nome={item.nome} />
    <div className="min-w-0">
      <Link to={`/itens/${item.item_id}?horizonte=${horizonte}`} className="block text-sm hover:text-destaque">{item.nome} <span aria-hidden>↗</span></Link>
      <p className="mt-1 text-[11px] text-suave">Base: {formatarData(item.data_base)}{item.desatualizada && " · Dados históricos"}</p>
      <p className="mt-1 text-[11px] text-suave">Média entre {formatarData(item.janela_inicio)} e {formatarData(item.janela_fim)}</p>
    </div>
  </div>;
}

function Margem({ item }: { item: Oportunidade }) {
  return <><Variacao valor={item.margem_estimada} /><span className="mt-1 block font-mono text-[11px] text-suave">+{formatarPreco(item.diferenca_estimada)}</span></>;
}

function Risco({ item }: { item: Oportunidade }) {
  const risco = RISCOS[item.risco];
  return <details className="text-xs">
    <summary className={`w-fit cursor-pointer rounded-md border px-2 py-1 font-mono ${risco.cor}`} aria-label={`Risco ${risco.nome.toLowerCase()} de ${item.nome}: ver motivos`}>{risco.nome}</summary>
    <div className="mt-2 space-y-2 text-suave">
      {item.motivos_risco.map((motivo) => <p key={motivo}>{motivo}</p>)}
      <p>Volume médio/dia: {item.volume_medio_7d === null ? "indisponível" : formatarInteiro(Math.round(item.volume_medio_7d))}</p>
      <p>Oscilação diária: {item.volatilidade_30d === null ? "indisponível" : `${(item.volatilidade_30d * 100).toFixed(1).replace(".", ",")}%`}</p>
    </div>
  </details>;
}

function EstadoVazio({ data, voltar }: { data: RankingOportunidades; voltar: () => void }) {
  const mensagens = {
    sem_modelo_ativo: ["Previsão ainda indisponível para este horizonte.", "O ranking aparecerá quando houver um modelo ativo e previsões disponíveis."],
    aguardando_previsoes: ["Aguardando previsões para os preços disponíveis.", "Ainda não há previsões correspondentes ao histórico carregado neste cenário."],
    sem_margem_positiva: ["Nenhuma oportunidade neste cenário.", "Os itens com previsões disponíveis não apresentam margem positiva neste horizonte."],
  } as const;
  const [titulo, detalhe] = data.motivo ? mensagens[data.motivo] : ["Nenhum item nesta página.", "Volte ao início do ranking."] as const;
  return <div className="pb-6 text-center"><MensagemErro titulo={titulo} detalhe={detalhe} />
    {!data.motivo && <button type="button" onClick={voltar} className="text-sm text-destaque hover:underline">Primeira página</button>}
    {data.motivo && <Link to="/itens" className="text-sm text-destaque hover:underline">Explorar itens →</Link>}
  </div>;
}
