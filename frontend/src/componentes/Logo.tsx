import { Link } from "react-router";

export function MarcaLogo({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={(tamanho * 18) / 22} viewBox="0 0 22 18" aria-hidden>
      <path d="M1 17V6l7 7V1l7 9 6-8v15" fill="none" stroke="var(--color-destaque)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

/** Marca + nome, levando para a página inicial. */
export function Logo({ texto = "skinomics" }: { texto?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <MarcaLogo />
      {texto}
    </Link>
  );
}
