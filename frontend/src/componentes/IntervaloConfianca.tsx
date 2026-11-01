import type { PrevisaoItem } from "../api/itens";
import { formatarPreco } from "../lib/formato";
import { intervaloValido } from "../lib/grafico";

/** Informação permanente: não depende de tooltip, expansão ou interação com o gráfico. */
export function IntervaloConfianca({ previsao, carregando = false, erro = false, compacto = false }: {
  previsao?: PrevisaoItem;
  carregando?: boolean;
  erro?: boolean;
  compacto?: boolean;
}) {
  const intervalo = !carregando && !erro ? intervaloValido(previsao) : null;
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
                80%
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
        <p className="mt-3 text-xs leading-relaxed text-suave">
          Faixa estimada com nível nominal de 80%. O preço médio futuro pode ficar fora desses limites.
        </p>
      )}
    </section>
  );
}
