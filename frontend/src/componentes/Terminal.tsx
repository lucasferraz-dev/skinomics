import { Outlet } from "react-router";

import { useIdioma } from "../lib/idioma";
import { Cabecalho } from "./Cabecalho";
import { MenuAnalise } from "./MenuAnalise";

export function Terminal() {
  // Os botões do header (idioma, tutorial) têm textos traduzidos.
  useIdioma();
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho />

      <div className="flex flex-1 flex-col md:flex-row">
        <MenuAnalise />

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
