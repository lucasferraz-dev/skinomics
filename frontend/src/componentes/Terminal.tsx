import { Outlet } from "react-router";

import { MenuConta } from "./Conta";
import { Logo } from "./Logo";
import { MenuAnalise } from "./MenuAnalise";

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
        <MenuAnalise />

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
