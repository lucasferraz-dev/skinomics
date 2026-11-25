import { useEffect, useState } from "react";

import { t } from "../lib/idioma";
import { formatarData } from "../lib/formato";
import { type MotivoSemSinal, type NivelSinal, NIVEIS, type Sinal, TAXA_STEAM } from "../lib/sinal";
import { Painel, Rotulo, Variacao } from "./Basicos";

const ROTULO: Record<NivelSinal, () => string> = {
  baixa_forte: () => t("Baixa forte", "Strong bear"),
  baixa: () => t("Baixa", "Bear"),
  neutro: () => t("Neutro", "Neutral"),
  alta: () => t("Alta", "Bull"),
  alta_forte: () => t("Alta forte", "Strong bull"),
};

const EXPLICACAO: Record<NivelSinal, () => string> = {
  alta_forte: () => t("Mesmo no limite de baixo da faixa, o preço previsto fica acima do de hoje.", "Even at the low end of the range, the forecast stays above today's price."),
  alta: () => t("O centro da previsão está acima do preço de hoje, mas a faixa ainda inclui queda.", "The forecast's center is above today's price, but the range still includes a drop."),
  neutro: () => t("A previsão fica praticamente no preço de hoje.", "The forecast sits at about today's price."),
  baixa: () => t("O centro da previsão está abaixo do preço de hoje, mas a faixa ainda inclui alta.", "The forecast's center is below today's price, but the range still includes a rise."),
  baixa_forte: () => t("Mesmo no limite de cima da faixa, o preço previsto fica abaixo do de hoje.", "Even at the high end of the range, the forecast stays below today's price."),
};

const SEM_LEITURA: Record<MotivoSemSinal, () => string> = {
  sem_previsao: () => t("Ainda não há previsão com faixa para este horizonte.", "There's no forecast with a range for this horizon yet."),
  piso: () => t("O item está no menor preço do mercado. Dali não cai, mas um centavo a mais não paga a taxa da Steam.", "The item sits at the market's lowest price. It can't fall, but one more cent won't pay Steam's fee."),
  pouco_volume: () => t("Pouca venda na semana: o preço de item pouco negociado engana.", "Few sales this week: a thinly traded price is misleading."),
  incerteza_alta: () => t("A faixa da previsão está larga demais para uma leitura.", "The forecast range is too wide for a reading."),
};

// Cor de cada nível, nas cores do tema: coral para queda, verde-limão para alta.
const COR: Record<NivelSinal, { cor: string; opacidade: number }> = {
  baixa_forte: { cor: "var(--color-queda)", opacidade: 1 },
  baixa: { cor: "var(--color-queda)", opacidade: 0.55 },
  neutro: { cor: "var(--color-suave)", opacidade: 0.6 },
  alta: { cor: "var(--color-destaque)", opacidade: 0.55 },
  alta_forte: { cor: "var(--color-destaque)", opacidade: 1 },
};

export const rotuloDoNivel = (nivel: NivelSinal) => ROTULO[nivel]();

/** Cabeça de touro em traço, no estilo dos ícones do site. */
export function IconeTouro({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.5 8.5C4.5 8.5 2.5 6.5 2.5 3.5c1.6 1.7 3.2 2 5 2h9c1.8 0 3.4-.3 5-2 0 3-2 5-5 5" />
      <path d="M7.5 7.5v5c0 4 2.2 8 4.5 8s4.5-4 4.5-8v-5" />
      <path d="M10 17.2h.01M14 17.2h.01M9.6 11.5h.01M14.4 11.5h.01" strokeWidth="2.4" />
    </svg>
  );
}

/** Cabeça de urso em traço. */
export function IconeUrso({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.3 7.1A2.6 2.6 0 1 1 4.6 10M16.7 7.1A2.6 2.6 0 1 0 19.4 10" />
      <path d="M12 6c-4.2 0-7 3.2-7 7.3S8 20 12 20s7-2.6 7-6.7S16.2 6 12 6z" />
      <path d="M10 15.6c1.2 1 2.8 1 4 0M9.4 11.8h.01M14.6 11.8h.01" />
      <path d="M12 13.6h.01" strokeWidth="2.6" />
    </svg>
  );
}

const ponto = (graus: number, raio: number) => {
  const a = (graus * Math.PI) / 180;
  return `${(100 + raio * Math.cos(a)).toFixed(2)} ${(100 - raio * Math.sin(a)).toFixed(2)}`;
};

/**
 * Medidor da leitura do modelo: um semicírculo do urso ao touro em cinco faixas, com o ponteiro na
 * leitura atual. O ponteiro entra balançando quando a leitura chega ou muda (outro horizonte).
 */
export function MedidorSinal({ sinal, horizonte, dataBase, carregando }: { sinal: Sinal; horizonte: number; dataBase?: string | null; carregando: boolean }) {
  const leitura = sinal.tipo === "leitura" ? sinal : null;
  const [ponteiro, setPonteiro] = useState(0);
  useEffect(() => {
    const quadro = requestAnimationFrame(() => setPonteiro(leitura?.ponteiro ?? 0));
    return () => cancelAnimationFrame(quadro);
  }, [leitura?.ponteiro]);

  const ativo = leitura?.nivel;
  const corAtiva = ativo ? COR[ativo].cor : "var(--color-apagado)";

  return (
    <Painel data-tour="item-sinal" className="rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <Rotulo destaque>{t("Leitura do modelo", "Model reading")}</Rotulo>
        <span className="font-mono text-[11px] text-apagado">{t(`em ${horizonte} dias`, `in ${horizonte} days`)}</span>
      </div>

      <div className={`relative mx-auto mt-3 w-full max-w-[16rem] transition-opacity ${leitura?.desatualizado ? "opacity-70" : ""}`}>
        <svg viewBox="0 0 200 112" className="block w-full overflow-visible" role="img" aria-label={ativo ? rotuloDoNivel(ativo) : t("Sem leitura", "No reading")}>
          {NIVEIS.map((nivel, i) => {
            const inicio = 180 - i * 36 - 1.5;
            const fim = 180 - (i + 1) * 36 + 1.5;
            return (
              <path
                key={nivel}
                d={`M${ponto(inicio, 80)} A80 80 0 0 1 ${ponto(fim, 80)}`}
                fill="none"
                stroke={COR[nivel].cor}
                strokeOpacity={nivel === ativo ? 1 : leitura ? 0.16 : 0.1}
                strokeWidth={nivel === ativo ? 15 : 11}
                className="transition-[stroke-opacity,stroke-width] duration-500"
              />
            );
          })}
          {/* Marcas finas por dentro do arco, como num mostrador */}
          {Array.from({ length: 11 }, (_, i) => (
            <path key={i} d={`M${ponto(180 - i * 18, 64)} L${ponto(180 - i * 18, i % 2 ? 61 : 58)}`} stroke="var(--color-borda)" strokeWidth="1.2" />
          ))}
          {/* Ponteiro: gira em volta do centro, passa um pouco do ponto e volta */}
          <g
            style={{
              transform: `rotate(${ponteiro * 90}deg)`,
              transformOrigin: "100px 100px",
              transition: "transform 1100ms cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <path d="M100 100 L100 32" stroke={leitura ? "var(--color-texto)" : "var(--color-apagado)"} strokeWidth="2.6" strokeLinecap="round" strokeDasharray={leitura ? undefined : "3 4"} />
            <circle cx="100" cy="30" r="3.2" fill={corAtiva} />
          </g>
          <circle cx="100" cy="100" r="7" fill="var(--color-painel)" stroke="var(--color-texto)" strokeWidth="2" />
        </svg>
        <div className="-mt-1 flex items-center justify-between font-rotulo text-[11px] font-semibold tracking-[0.06em]">
          <span className="flex items-center gap-1 text-queda">
            <IconeUrso />
            {t("Urso", "Bear")}
          </span>
          <span className="flex items-center gap-1 text-destaque">
            {t("Touro", "Bull")}
            <IconeTouro />
          </span>
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-2xl leading-tight titulo" style={{ color: corAtiva }}>
          {carregando ? t("Lendo…", "Reading…") : ativo ? rotuloDoNivel(ativo) : t("Sem leitura", "No reading")}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-suave">
          {carregando ? " " : leitura ? EXPLICACAO[leitura.nivel]() : sinal.tipo === "sem" ? SEM_LEITURA[sinal.motivo]() : ""}
        </p>
      </div>

      {leitura && (
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-borda pt-3 text-center">
          {(
            [
              [t("Pior caso", "Worst case"), leitura.piso],
              [t("Centro", "Center"), leitura.margem],
              [t("Melhor caso", "Best case"), leitura.teto],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-[10px] text-apagado">{rotulo}</dt>
              <dd className="mt-0.5 text-xs">
                <Variacao valor={valor} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-apagado">
        {leitura?.desatualizado && dataBase
          ? t(`Leitura de ${formatarData(dataBase)}, aguardando previsão nova. `, `Reading from ${formatarData(dataBase)}, awaiting a new forecast. `)
          : ""}
        {t(
          `É o que o modelo lê na faixa de 80%, não uma recomendação de investimento. A Steam fica com parte de cada venda: para lucrar, a alta precisa passar de uns ${Math.round(TAXA_STEAM * 100)}%.`,
          `It's what the model reads from the 80% range, not investment advice. Steam keeps part of every sale: to profit, the rise must beat about ${Math.round(TAXA_STEAM * 100)}%.`,
        )}
      </p>
    </Painel>
  );
}

/** Selo pequeno da leitura, para os cards. Nos níveis fortes, preenchido; sem leitura, não aparece. */
export function SeloSinal({ sinal }: { sinal: Sinal }) {
  if (sinal.tipo !== "leitura") return null;
  const { nivel } = sinal;
  const classe =
    nivel === "alta_forte"
      ? "border-destaque bg-destaque text-fundo"
      : nivel === "baixa_forte"
        ? "border-queda bg-queda text-fundo"
        : nivel === "alta"
          ? "border-destaque/40 text-destaque"
          : nivel === "baixa"
            ? "border-queda/40 text-queda"
            : "border-borda text-suave";
  const titulo = `${t("Leitura do modelo em 7 dias", "7-day model reading")}: ${rotuloDoNivel(nivel)}${sinal.desatualizado ? t(" (previsão desatualizada)", " (outdated forecast)") : ""}`;
  return (
    <span title={titulo} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${classe} ${sinal.desatualizado ? "opacity-70" : ""}`}>
      {nivel.startsWith("alta") ? <IconeTouro tamanho={13} /> : nivel.startsWith("baixa") ? <IconeUrso tamanho={13} /> : null}
      {rotuloDoNivel(nivel)}
    </span>
  );
}
