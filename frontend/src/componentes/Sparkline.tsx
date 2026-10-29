/** Mini gráfico da tabela. SVG puro: uma biblioteca de gráficos por linha pesaria à toa. */
export function Sparkline({
  valores,
  largura = 112,
  altura = 32,
  titulo,
}: {
  valores: number[];
  largura?: number;
  altura?: number;
  /** Texto do tooltip (e do leitor de tela); sem ele, o gráfico é só decorativo. */
  titulo?: string;
}) {
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
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      {titulo && <title>{titulo}</title>}
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
