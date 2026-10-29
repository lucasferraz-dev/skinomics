/** Mini gráfico da tabela. SVG puro: uma biblioteca de gráficos por linha pesaria à toa. */
export function Sparkline({ valores, largura = 112, altura = 32 }: { valores: number[]; largura?: number; altura?: number }) {
  if (valores.length < 2) {
    return <span className="font-mono text-xs text-apagado">—</span>;
  }

  const minimo = Math.min(...valores);
  const amplitude = Math.max(...valores) - minimo || 1;
  const margem = 2;
  const pontos = valores
    .map((valor, i) => {
      const x = (i / (valores.length - 1)) * largura;
      const y = margem + (1 - (valor - minimo) / amplitude) * (altura - margem * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const subiu = valores.at(-1)! >= valores[0]!;

  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} aria-hidden>
      <polyline
        points={pontos}
        fill="none"
        stroke={subiu ? "var(--color-destaque)" : "var(--color-queda)"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
