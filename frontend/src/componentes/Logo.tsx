import { Link } from "react-router";

export function MarcaLogo({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={(tamanho * 18) / 22} viewBox="0 0 22 18" aria-hidden>
      <path d="M1 17V6l7 7V1l7 9 6-8v15" fill="none" stroke="var(--color-destaque)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

/** Marca + nome, levando para a página inicial. `grande` é a versão do header da landing. */
export function Logo({ texto = "skinomics", grande = false }: { texto?: string; grande?: boolean }) {
  return (
    <Link to="/" className={`flex items-center font-semibold tracking-tight ${grande ? "gap-3 text-2xl" : "gap-2.5"}`}>
      <MarcaLogo tamanho={grande ? 34 : 22} />
      {texto}
    </Link>
  );
}
