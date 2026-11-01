import { usePrevisao } from "../api/itens";
import { formatarData, formatarInstante, formatarPreco } from "../lib/formato";
import { Carregando, Painel, Rotulo, Variacao } from "./Basicos";

export function PrevisaoPreco({ itemId }: { itemId: number }) {
  const { data, isPending, isError, refetch } = usePrevisao(itemId);

  return (
    <Painel className="p-5">
      <Rotulo>Cenário / 7 dias</Rotulo>
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
          <p className="text-xs text-apagado">Estimativa pontual; intervalo de previsão ainda indisponível.</p>
          <details className="text-xs text-apagado">
            <summary className="cursor-pointer">Sobre esta previsão</summary>
            <p className="mt-2 break-all">Versão: {data.modelo_versao}</p>
            {data.gerada_em && <p>Gerada em {formatarInstante(data.gerada_em)}.</p>}
          </details>
        </div>
      )}
    </Painel>
  );
}
