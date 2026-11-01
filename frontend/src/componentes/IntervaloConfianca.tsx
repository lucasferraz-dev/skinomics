import type { PrevisaoItem } from "../api/itens";
import { formatarPreco } from "../lib/formato";
import { intervaloValido } from "../lib/grafico";

const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** Informação permanente: não depende de tooltip, expansão ou interação com o gráfico. */
export function IntervaloConfianca({ previsao, carregando = false, erro = false, compacto = false }: {
  previsao?: PrevisaoItem;
  carregando?: boolean;
  erro?: boolean;
  compacto?: boolean;
}) {
  const intervalo = !carregando && !erro ? intervaloValido(previsao) : null;
  const confianca = intervalo && previsao?.nivel_confianca != null
    ? percentual.format(previsao.nivel_confianca) : null;
  const cobertura = previsao?.cobertura_teste;
  const mensagem = carregando
    ? "Carregando os limites do intervalo…"
    : erro
      ? "Não foi possível carregar o intervalo. Tente novamente."
      : previsao?.disponivel
        ? "Intervalo indisponível para esta versão do modelo."
        : "O intervalo será exibido quando houver uma previsão disponível para este horizonte.";

  return (
    <section
      aria-label="Intervalo de confiança da previsão"
      aria-busy={carregando}
      className="rounded-lg border border-destaque/30 bg-painel-alto p-3"
    >
      <div className={compacto ? "flex flex-wrap items-center justify-between gap-x-6 gap-y-3" : "space-y-3"}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-texto">Intervalo de confiança</h2>
            {intervalo && (
              <span className="rounded border border-destaque/30 bg-destaque-fundo px-2 py-0.5 font-mono text-xs text-destaque">
                {confianca}
              </span>
            )}
          </div>
          {intervalo && <p className="mt-1 text-xs text-suave">Preço médio previsto / {previsao!.horizonte} dias</p>}
        </div>
        {intervalo ? (
          <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
            <div>
              <dt className="text-xs text-suave">Limite inferior</dt>
              <dd className="mt-1 break-words font-mono text-lg text-texto">{formatarPreco(intervalo.inferior)}</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Limite superior</dt>
              <dd className="mt-1 break-words font-mono text-lg text-texto">{formatarPreco(intervalo.superior)}</dd>
            </div>
          </dl>
        ) : <p className="mt-2 text-sm text-suave" role="status">{mensagem}</p>}
      </div>
      {intervalo && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-borda pt-3">
            <div>
              <dt className="text-xs text-suave">Confiança nominal</dt>
              <dd className="mt-1 font-mono text-lg text-texto">{confianca}</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Cobertura no teste</dt>
              <dd className="mt-1 font-mono text-lg text-texto">
                {cobertura != null ? percentual.format(cobertura) : "Não avaliada"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-suave">
            {cobertura != null
              ? `No teste do modelo de ${previsao!.horizonte} dias, ${percentual.format(cobertura)} dos preços médios reais ficaram dentro da faixa. Esse resultado reúne todos os itens.`
              : "A confiança nominal é o nível estimado para o intervalo. Esta versão não tem cobertura de teste informada."}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-suave">
            Esses percentuais não medem a certeza desta previsão individual. O preço médio futuro pode ficar fora dos limites.
          </p>
        </>
      )}
    </section>
  );
}
