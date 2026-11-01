import type { PrevisaoItem } from "../api/itens";
import { intervaloValido } from "../lib/grafico";

const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function ConfiancaPrevisao({ previsao, carregando = false, erro = false }: {
  previsao?: PrevisaoItem;
  carregando?: boolean;
  erro?: boolean;
}) {
  const confianca = !carregando && !erro && intervaloValido(previsao)
    && previsao?.nivel_confianca != null ? percentual.format(previsao.nivel_confianca) : null;

  return (
    <section
      aria-label="Confiança da previsão"
      aria-busy={carregando}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destaque/30 bg-painel-alto px-3 py-2"
    >
      <span className="text-sm text-suave">Confiança nominal</span>
      <span className={`font-mono ${confianca ? "text-lg text-destaque" : "text-xs text-suave"}`}>
        {carregando ? "Carregando…" : confianca ?? "Indisponível"}
      </span>
    </section>
  );
}
