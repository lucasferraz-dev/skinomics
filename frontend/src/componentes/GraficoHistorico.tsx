import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  type TooltipValueType,
  XAxis,
  YAxis,
} from "recharts";

import type { PontoHistorico, PrevisaoItem } from "../api/itens";
import { formatarData, formatarDiaMes, formatarInteiro, formatarPreco } from "../lib/formato";
import { type PontoGrafico, prepararGrafico } from "../lib/grafico";

const EIXO = { fill: "var(--color-apagado)", fontSize: 11, fontFamily: "var(--font-mono)" };

function Dica({ active, payload, previsao }: TooltipContentProps<TooltipValueType, string | number> & {
  previsao?: PrevisaoItem;
}) {
  const ponto = payload?.[0]?.payload as PontoGrafico | undefined;
  if (!active || !ponto) return null;
  const futuro = ponto.preco === null && ponto.precoPrevisto != null;
  return (
    <div className="max-w-60 rounded-lg border border-borda bg-painel-alto px-3 py-2 shadow-xl">
      <p className="font-mono text-[11px] text-suave">{formatarData(ponto.data)}</p>
      <p className="mt-1 font-mono text-sm">{formatarPreco(futuro ? ponto.precoPrevisto! : ponto.preco!)}</p>
      {futuro ? (
        <>
          <p className="mt-1 font-mono text-[11px] text-destaque">Média prevista</p>
          {previsao?.janela_inicio && previsao.janela_fim && (
            <p className="mt-1 text-xs text-suave">
              De {formatarData(previsao.janela_inicio)} a {formatarData(previsao.janela_fim)}.
            </p>
          )}
          {previsao?.desatualizada && <p className="mt-1 text-xs text-suave">Previsão desatualizada.</p>}
        </>
      ) : (
        <p className="font-mono text-[11px] text-apagado">
          {ponto.preenchido ? "sem negociação no dia" : `${formatarInteiro(ponto.volume ?? 0)} vendidos`}
        </p>
      )}
    </div>
  );
}

export function GraficoHistorico({ pontos, previsao, altura = 320 }: {
  pontos: PontoHistorico[];
  previsao?: PrevisaoItem;
  altura?: number;
}) {
  const { dados, futuro } = prepararGrafico(pontos, previsao);
  const dataDoEixo = (instante: number) => formatarDiaMes(new Date(instante).toISOString().slice(0, 10));

  return (
    <div>
      {futuro && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-suave" aria-label="Legenda do gráfico">
          <span className="inline-flex items-center gap-2">
            <span className="w-5 border-t-2 border-destaque" aria-hidden="true" />Histórico
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-5 border-t-2 border-dashed border-destaque" aria-hidden="true" />Previsão
          </span>
          {futuro.previsao.desatualizada && <span className="text-apagado">Previsão desatualizada</span>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={dados} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-borda)" />
          <XAxis
            dataKey="instante"
            type="number"
            scale="time"
            domain={["dataMin", futuro?.fim ?? "dataMax"]}
            tickFormatter={dataDoEixo}
            tick={EIXO}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
            tickMargin={10}
          />
          <YAxis
            orientation="right"
            domain={["auto", "auto"]}
            tickFormatter={(valor: number) => formatarPreco(valor).replace("US$", "").trim()}
            tick={EIXO}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          {futuro && futuro.inicio !== futuro.fim && (
            <ReferenceArea
              x1={futuro.inicio}
              x2={futuro.fim}
              fill="var(--color-destaque)"
              fillOpacity={0.06}
              strokeOpacity={0}
            />
          )}
          {futuro && (
            <ReferenceLine
              x={futuro.base}
              stroke="var(--color-suave)"
              strokeOpacity={0.5}
              strokeDasharray="3 5"
            />
          )}
          <Tooltip
            content={(props) => <Dica {...props} previsao={futuro?.previsao} />}
            cursor={{ stroke: "var(--color-suave)", strokeDasharray: "3 3" }}
          />
          <Line
            type="linear"
            dataKey="preco"
            stroke="var(--color-destaque)"
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-destaque)", strokeWidth: 0 }}
            isAnimationActive={false}
          />
          {futuro && (
            <Line
              className="linha-previsao"
              type="linear"
              dataKey="precoPrevisto"
              stroke="var(--color-destaque)"
              strokeWidth={1.75}
              strokeDasharray="6 5"
              dot={({ cx, cy, payload }) => payload.preco === null ? (
                <circle
                  key="previsao" className="ponto-previsao" cx={cx} cy={cy} r={4}
                  fill="var(--color-painel)" stroke="var(--color-destaque)" strokeWidth={2}
                />
              ) : <g key={payload.data} />}
              activeDot={{ r: 5, fill: "var(--color-painel)", stroke: "var(--color-destaque)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {futuro && (
        <p className="mt-3 text-xs leading-relaxed text-suave">
          {futuro.inicio === futuro.fim
            ? `Ponto previsto para ${formatarData(futuro.previsao.data_alvo!)}.`
            : `O ponto representa a média prevista entre ${formatarData(futuro.previsao.janela_inicio!)} e ${formatarData(futuro.previsao.janela_fim!)}; a área sombreada marca essa janela.`}
          {" "}O tracejado liga o preço-base à estimativa, sem prever os preços de cada dia.
        </p>
      )}
      {!futuro && previsao?.disponivel && (
        <p className="mt-3 text-xs text-suave">Aguardando uma previsão alinhada ao histórico exibido.</p>
      )}
    </div>
  );
}
