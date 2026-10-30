import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";

import { Rotulo } from "./Basicos";
import { MenuConta } from "./Conta";
import { Logo } from "./Logo";

type ItemMenu = { rotulo: string; icone: ReactNode; para?: string };

const icone = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const MENU: ItemMenu[] = [
  { rotulo: "Visão geral", icone: icone("M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z") },
  { rotulo: "Explorar itens", icone: icone("M3 17l6-6 4 4 8-8M15 7h6v6"), para: "/itens" },
  { rotulo: "Minha lista", icone: icone("M6 3h12v18l-6-4-6 4z"), para: "/minha-lista" },
  { rotulo: "Alertas", icone: icone("M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4") },
];

function LinkMenu({ item }: { item: ItemMenu }) {
  const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
  if (!item.para) {
    // Telas dos próximos incrementos: aparecem no menu, mas ainda não navegam.
    return (
      <span className={`${base} cursor-not-allowed text-apagado`} title="Em breve">
        {item.icone}
        {item.rotulo}
      </span>
    );
  }
  return (
    <NavLink
      to={item.para}
      className={({ isActive }) =>
        `${base} ${isActive ? "border border-destaque/25 bg-destaque-fundo text-destaque" : "text-suave hover:bg-painel-alto hover:text-texto"}`
      }
    >
      {item.icone}
      {item.rotulo}
    </NavLink>
  );
}

export function Terminal() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b border-borda px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          {/* No celular não cabe ao lado da conta; o jogo já aparece nos rótulos das telas. */}
          <span className="hidden text-apagado sm:inline">/</span>
          <span className="hidden text-sm text-suave sm:inline">Team Fortress 2</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded border border-borda px-2 py-1 font-mono text-[11px] text-suave">USD</span>
          <MenuConta />
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="border-b border-borda p-3 md:w-56 md:shrink-0 md:border-r md:border-b-0 md:p-4">
          <div className="mb-3 hidden px-3 md:block">
            <Rotulo>Área de análise</Rotulo>
          </div>
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {MENU.map((item) => (
              <li key={item.rotulo} className="shrink-0">
                <LinkMenu item={item} />
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
