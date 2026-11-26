import type { HorizontePrevisao, usePrevisao } from "../api/itens";
import { formatarData, formatarInstante, formatarPreco } from "../lib/formato";
import { t } from "../lib/idioma";
import { Carregando, Painel, Rotulo, Variacao } from "./Basicos";
import { ConfiancaPrevisao } from "./ConfiancaPrevisao";

export function PrevisaoPreco({ consulta, horizonte, aoMudarHorizonte }: {
  consulta: ReturnType<typeof usePrevisao>;
  horizonte: HorizontePrevisao;
  aoMudarHorizonte: (valor: HorizontePrevisao) => void;
}) {
  const { data, isPending, isError, refetch } = consulta;
  const disponivel = !isPending && !isError && data?.disponivel && data.preco_previsto != null;

  return (
    <Painel className="p-5">
      <Rotulo>{t(`Cenário / ${horizonte} dias`, `Scenario / ${horizonte} days`)}</Rotulo>
      <div className="mt-3 flex gap-1" role="group" aria-label={t("Horizonte da previsão", "Forecast horizon")}>
        {([7, 15, 30] as const).map((opcao) => (
          <button
            key={opcao} type="button" aria-pressed={opcao === horizonte}
            onClick={() => aoMudarHorizonte(opcao)}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
              opcao === horizonte ? "bg-painel-alto text-texto ring-1 ring-borda" : "text-apagado hover:text-texto"
            }`}
          >{t(`${opcao} dias`, `${opcao} days`)}</button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {isPending ? <Carregando texto={t("Carregando previsão…", "Loading forecast…")} /> : isError ? (
          <div role="alert" className="mt-3 text-sm text-suave">
            <p>{t("Não foi possível carregar a previsão.", "Couldn't load the forecast.")}</p>
            <button type="button" className="mt-2 underline" onClick={() => void refetch()}>
              {t("Tentar novamente", "Try again")}
            </button>
          </div>
        ) : !data?.disponivel || data.preco_previsto == null ? (
          <p className="mt-3 text-sm text-suave">
            {data?.motivo === "sem_modelo_ativo"
              ? t("A previsão para este horizonte ainda não está disponível.", "The forecast for this horizon isn't available yet.")
              : t("Aguardando uma previsão atualizada para este item.", "Waiting for an updated forecast for this item.")}
          </p>
        ) : (
          <>
            <p className="text-xs text-suave">{t("Preço médio estimado", "Estimated average price")}</p>
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="font-mono text-2xl">{formatarPreco(data.preco_previsto)}</p>
              <Variacao valor={data.variacao_prevista} />
            </div>
          </>
        )}
        <ConfiancaPrevisao previsao={data} carregando={isPending} erro={isError} />
        {disponivel && data && (
          <>
            {data.data_base && data.data_alvo && (
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-suave">{t("Data-base", "Base date")}</dt>
                  <dd className="mt-1 font-mono text-xs">{formatarData(data.data_base)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">{t(`Data-alvo (+${data.horizonte} dias)`, `Target date (+${data.horizonte} days)`)}</dt>
                  <dd className="mt-1 font-mono text-xs">{formatarData(data.data_alvo)}</dd>
                </div>
              </dl>
            )}
            {data.janela_inicio && data.janela_fim && (
              <p className="text-sm text-suave">
                {t(
                  `Média prevista entre ${formatarData(data.janela_inicio)} e ${formatarData(data.janela_fim)}.`,
                  `Predicted average between ${formatarData(data.janela_inicio)} and ${formatarData(data.janela_fim)}.`,
                )}
              </p>
            )}
            {data.data_base && data.preco_base != null && (
              <p className="text-xs text-suave">
                {t(
                  `Variação em relação ao preço-base de ${formatarPreco(data.preco_base)}.`,
                  `Change relative to the base price of ${formatarPreco(data.preco_base)}.`,
                )}
              </p>
            )}
            {data.desatualizada && (
              <p role="status" className="rounded-md border border-borda p-3 text-sm">
                {t(
                  "Previsão desatualizada. Aguarde a atualização dos dados e da estimativa.",
                  "Outdated forecast. Wait for the data and the estimate to update.",
                )}
              </p>
            )}
            {data.historico_curto && (
              <p className="rounded-md border border-borda p-3 text-sm">
                {t(
                  "Histórico curto: há poucos dados para avaliar esta estimativa.",
                  "Short history: there's little data to judge this estimate.",
                )}
              </p>
            )}
            {data.incerteza_elevada && (
              <p role="status" className="rounded-md border border-borda p-3 text-sm">
                <span className="text-destaque">{t("Incerteza elevada", "High uncertainty")}</span>
                <span className="mt-1 block text-xs text-suave">
                  {t(
                    "A faixa é ampla ou o histórico é curto. Considere essa incerteza ao avaliar a estimativa.",
                    "The range is wide or the history is short. Keep that uncertainty in mind when reading the estimate.",
                  )}
                </span>
              </p>
            )}
            <details className="text-xs text-apagado">
              <summary className="cursor-pointer">{t("Sobre esta previsão", "About this forecast")}</summary>
              <p className="mt-2 break-all">{t("Versão", "Version")}: {data.modelo_versao}</p>
              {data.gerada_em && <p>{t(`Gerada em ${formatarInstante(data.gerada_em)}.`, `Generated on ${formatarInstante(data.gerada_em)}.`)}</p>}
            </details>
          </>
        )}
      </div>
    </Painel>
  );
}
