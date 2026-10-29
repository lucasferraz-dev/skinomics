import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  type TooltipValueType,
  XAxis,
  YAxis,
} from "recharts";

import type { PontoHistorico } from "../api/itens";
import { formatarData, formatarDiaMes, formatarInteiro, formatarPreco } from "../lib/formato";

const EIXO = { fill: "var(--color-apagado)", fontSize: 11, fontFamily: "var(--font-mono)" };

function Dica({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const ponto = payload?.[0]?.payload as PontoHistorico | undefined;
  if (!active || !ponto) return null;
  return (
    <div className="rounded-lg border border-borda bg-painel-alto px-3 py-2 shadow-xl">
      <p className="font-mono text-[11px] text-suave">{formatarData(ponto.data)}</p>
      <p className="mt-1 font-mono text-sm">{formatarPreco(ponto.preco)}</p>
      <p className="font-mono text-[11px] text-apagado">
        {ponto.preenchido ? "sem negociação no dia" : `${formatarInteiro(ponto.volume)} vendidos`}
      </p>
    </div>
  );
}

export function GraficoHistorico({ pontos, altura = 320 }: { pontos: PontoHistorico[]; altura?: number }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={pontos} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-borda)" />
        <XAxis
          dataKey="data"
          tickFormatter={formatarDiaMes}
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
        <Tooltip content={Dica} cursor={{ stroke: "var(--color-suave)", strokeDasharray: "3 3" }} />
        <Line
          type="linear"
          dataKey="preco"
          stroke="var(--color-destaque)"
          strokeWidth={1.75}
          dot={false}
          activeDot={{ r: 3, fill: "var(--color-destaque)", strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
