// Medalha que diz por que um item está em destaque (maior alta, maior queda, mais negociado...).
// A grande, com fita e faixa escrita, vai sobre a imagem da vitrine; a pequena, só o disco, vai no
// ícone dos terminais de destaque. Cores dentro da paleta do site.

export type TipoMedalha = "alta" | "queda" | "volume" | "margem" | "aleatorio";

const MEDALHAS: Record<TipoMedalha, { texto: string; cor: string; icone: string }> = {
  alta: { texto: "Maior alta", cor: "#c6f36b", icone: "M12 17V7M7.5 11.5 12 7l4.5 4.5" },
  queda: { texto: "Maior queda", cor: "#f2876b", icone: "M12 7v10M7.5 12.5 12 17l4.5-4.5" },
  volume: { texto: "Mais negociado", cor: "#e9ece7", icone: "M7 17v-3M10.3 17v-6M13.7 17V8M17 17v-8" },
  margem: {
    texto: "Maior margem",
    cor: "#c6f36b",
    icone: "M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  },
  aleatorio: { texto: "Sorteado", cor: "#8b928c", icone: "M7.5 7.5h9v9h-9zM10 10h.01M14 14h.01M12 12h.01" },
};

export function Medalha({
  tipo,
  tamanho = "grande",
  className = "",
}: {
  tipo: TipoMedalha;
  tamanho?: "grande" | "pequena";
  className?: string;
}) {
  const { texto, cor, icone } = MEDALHAS[tipo];
  const grande = tamanho === "grande";

  const disco = (
    <svg
      viewBox={grande ? "0 0 56 70" : "2 0 52 52"}
      width={grande ? 64 : 26}
      height={grande ? 80 : 26}
      className="overflow-visible drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]"
      aria-hidden
    >
      {/* Fitas penduradas, com o corte em V na ponta */}
      {grande && (
        <g stroke="#0b0d0c" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M18 34 11 66l6-4 5 5 5-31Z" fill={cor} fillOpacity="0.85" />
          <path d="M38 34l7 32-6-4-5 5-5-31Z" fill={cor} fillOpacity="0.6" />
        </g>
      )}
      {/* Disco: aro escuro com contorno na cor, miolo na cor e o ícone do motivo */}
      <circle cx="28" cy="26" r="23" fill="#0b0d0c" stroke={cor} strokeWidth="2.5" />
      <circle cx="28" cy="26" r="17.5" fill={cor} />
      <circle cx="28" cy="26" r="17.5" fill="none" stroke="#0b0d0c" strokeOpacity="0.25" strokeDasharray="1.5 2.5" />
      <path
        d={icone}
        transform="translate(28 26) scale(1.25) translate(-12 -12)"
        fill="none"
        stroke="#0b0d0c"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Brilho do metal */}
      <path d="M14 18a16 16 0 0 1 12-9" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );

  if (!grande) {
    return (
      <span className={`inline-block ${className}`} title={texto}>
        {disco}
      </span>
    );
  }

  return (
    <span
      className={`flex flex-col items-center transition duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] starting:scale-50 starting:-rotate-45 starting:opacity-0 hover:rotate-6 ${className}`}
      title={texto}
    >
      {disco}
      {/* Faixa escrita, presa sobre as fitas */}
      <span
        className="relative z-10 -mt-6 rounded-sm px-2 py-0.5 font-rotulo text-[10px] font-bold tracking-[0.06em] whitespace-nowrap text-[#0b0d0c] shadow-[0_3px_6px_rgba(0,0,0,0.5)]"
        style={{ background: cor }}
      >
        {texto}
      </span>
    </span>
  );
}
