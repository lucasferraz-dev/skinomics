import type { TemaChaveiro } from "./temas";

/** O ícone de um tema de chaveiro (categoria, evento, qualidade) solto, para chips e selos. */
export function IconeTema({ tema, tamanho = 14, cor }: { tema: TemaChaveiro; tamanho?: number; cor?: string }) {
  if (tema.texto) {
    return (
      <span className="font-mono text-[10px] font-medium" style={{ color: cor ?? tema.cor }}>
        {tema.texto}
      </span>
    );
  }
  return (
    <svg width={tamanho} height={tamanho} viewBox="-11 -11 22 22" aria-hidden className="shrink-0">
      <path d={tema.icone} fill="none" stroke={cor ?? tema.cor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
