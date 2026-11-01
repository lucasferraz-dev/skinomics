import type { HorizontePrevisao, usePrevisao } from "../api/itens";
import { intervaloValido } from "../lib/grafico";
import { formatarData, formatarInstante, formatarPreco } from "../lib/formato";
import { Carregando, Painel, Rotulo, Variacao } from "./Basicos";

export function PrevisaoPreco({ consulta, horizonte, aoMudarHorizonte }: {
  consulta: ReturnType<typeof usePrevisao>;
  horizonte: HorizontePrevisao;
  aoMudarHorizonte: (valor: HorizontePrevisao) => void;
}) {
  const { data, isPending, isError, refetch } = consulta;
  const intervalo = intervaloValido(data);

  return (
    <Painel className="p-5">
      <Rotulo>Cenário / {horizonte} dias</Rotulo>
      <div className="mt-3 flex gap-1" role="group" aria-label="Horizonte da previsão">
        {([7, 15, 30] as const).map((opcao) => (
          <button
            key={opcao} type="button" aria-pressed={opcao === horizonte}
            onClick={() => aoMudarHorizonte(opcao)}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
              opcao === horizonte ? "bg-painel-alto text-texto ring-1 ring-borda" : "text-apagado hover:text-texto"
            }`}
          >{opcao} dias</button>
        ))}
      </div>
      {isPending ? <Carregando texto="Carregando previsão…" /> : isError ? (
        <div role="alert" className="mt-3 text-sm text-suave">
          <p>Não foi possível carregar a previsão.</p>
          <button type="button" className="mt-2 underline" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : !data?.disponivel || data.preco_previsto == null ? (
        <p className="mt-3 text-sm text-suave">
          {data?.motivo === "sem_modelo_ativo"
            ? "A previsão para este horizonte ainda não está disponível."
            : "Aguardando uma previsão atualizada para este item."}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-suave">Preço médio estimado</p>
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="font-mono text-2xl">{formatarPreco(data.preco_previsto)}</p>
            <Variacao valor={data.variacao_prevista} />
          </div>
          {data.janela_inicio && data.janela_fim && (
            <p className="text-sm text-suave">
              Média prevista entre {formatarData(data.janela_inicio)} e {formatarData(data.janela_fim)}.
            </p>
          )}
          {data.data_base && data.preco_base != null && (
            <p className="text-xs text-suave">
              Variação em relação a {formatarPreco(data.preco_base)} em {formatarData(data.data_base)}.
            </p>
          )}
          {data.desatualizada && (
            <p role="status" className="rounded-md border border-borda p-3 text-sm">
              Previsão desatualizada. Aguarde a atualização dos dados e da estimativa.
            </p>
          )}
          {data.historico_curto && (
            <p className="rounded-md border border-borda p-3 text-sm">
              Histórico curto: há poucos dados para avaliar esta estimativa.
            </p>
          )}
          {intervalo ? (
            <div className="border-t border-borda pt-3">
              <p className="text-xs text-suave">Intervalo de previsão / 80%</p>
              <p className="mt-1 font-mono text-sm">
                {formatarPreco(intervalo.inferior)} – {formatarPreco(intervalo.superior)}
              </p>
              <p className="mt-2 text-xs text-apagado">
                Faixa estimada para a média futura. O preço pode ficar fora dela.
              </p>
            </div>
          ) : (
            <p className="text-xs text-apagado">Intervalo indisponível para esta versão do modelo.</p>
          )}
          {data.incerteza_elevada && (
            <p role="status" className="rounded-md border border-borda p-3 text-sm">
              <span className="text-destaque">Incerteza elevada</span>
              <span className="mt-1 block text-xs text-suave">
                A faixa é ampla ou o histórico é curto. Considere essa incerteza ao avaliar a estimativa.
              </span>
            </p>
          )}
          <details className="text-xs text-apagado">
            <summary className="cursor-pointer">Sobre esta previsão</summary>
            <p className="mt-2 break-all">Versão: {data.modelo_versao}</p>
            {data.cobertura_teste != null && (
              <p className="mt-2">
                Cobertura observada no teste: {(data.cobertura_teste * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%.
                {" "}80% é o nível estimado; a cobertura futura pode variar.
              </p>
            )}
            {data.gerada_em && <p>Gerada em {formatarInstante(data.gerada_em)}.</p>}
          </details>
        </div>
      )}
    </Painel>
  );
}
