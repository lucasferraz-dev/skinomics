import { t } from "../lib/idioma";
import { type ReactNode, useRef } from "react";
import { Link, NavLink } from "react-router";

import { Rotulo } from "./Basicos";
import { IconeMenu } from "./IconesAnimados";

type ItemMenu = { rotulo: string; icone: ReactNode; para?: string; atalho?: boolean };

const icone = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const MENU: ItemMenu[] = [
  { get rotulo() {
    return t("Visão geral", "Overview");
  }, icone: icone("M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"), para: "/itens", atalho: true },
  { get rotulo() {
    return t("Explorar itens", "Explore items");
  }, icone: icone("M3 17l6-6 4 4 8-8M15 7h6v6"), para: "/itens" },
  { get rotulo() {
    return t("Oportunidades", "Opportunities");
  }, icone: icone("M4 20V12h4v8M10 20V4h4v16M16 20V8h4v12"), para: "/oportunidades" },
  { get rotulo() {
    return t("Minha lista", "My list");
  }, icone: icone("M6 3h12v18l-6-4-6 4z"), para: "/minha-lista" },
  { get rotulo() {
    return t("Alertas", "Alerts");
  }, icone: icone("M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4") },
];

function LinkMenu({ item }: { item: ItemMenu }) {
  const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
  const inativo = "text-suave hover:bg-painel-alto hover:text-texto";
  if (!item.para) {
    return <span className={`${base} cursor-not-allowed text-apagado`} title={t("Em breve", "Coming soon")}>{item.icone}{item.rotulo}</span>;
  }
  // Visão geral é um retorno ao catálogo; só Explorar itens marca a seção atual.
  if (item.atalho) {
    return <Link to={item.para} className={`${base} ${inativo}`}>{item.icone}{item.rotulo}</Link>;
  }
  return (
    <NavLink to={item.para} className={({ isActive }) =>
      `${base} ${isActive ? "border border-destaque/25 bg-destaque-fundo text-destaque" : inativo}`
    }>
      {item.icone}{item.rotulo}
    </NavLink>
  );
}

function ItensMenu({ compacto = false }: { compacto?: boolean }) {
  return <ul className={compacto ? "space-y-1" : "flex gap-1 overflow-x-auto md:flex-col"}>
    {MENU.map((item) => <li key={item.rotulo} className="shrink-0"><LinkMenu item={item} /></li>)}
  </ul>;
}

export function MenuAnalise() {
  return (
    <nav aria-label={t("Área de análise", "Analysis")} className="border-b border-borda p-3 md:w-56 md:shrink-0 md:border-r md:border-b-0 md:p-4">
      <div className="mb-3 hidden px-3 md:block"><Rotulo>{t("Área de análise", "Analysis")}</Rotulo></div>
      <ItensMenu />
    </nav>
  );
}

/** Mesmo menu nos cabeçalhos da página inicial e do login. */
export function AcessoAnalise({ hamburguer = false, redondo = false }: { hamburguer?: boolean; redondo?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={menu} className="relative shrink-0" onKeyDown={(evento) => {
      if (evento.key === "Escape" && menu.current) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label={t("Menu Área de análise", "Analysis menu")} title={t("Área de análise", "Analysis")} className={redondo
        ? "grid size-8 cursor-pointer list-none place-items-center rounded-full border border-borda bg-painel/60 text-destaque transition-colors duration-300 hover:border-destaque/60 [&::-webkit-details-marker]:hidden"
        : `cursor-pointer whitespace-nowrap rounded-lg border border-borda text-xs text-suave transition-colors hover:border-suave hover:text-texto sm:text-sm ${hamburguer ? "list-none p-2.5 [&::-webkit-details-marker]:hidden" : "px-3 py-2"}`}>
        {redondo ? <IconeMenu /> : hamburguer ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg> : t("Área de análise", "Analysis")}
      </summary>
      <nav aria-label={t("Área de análise", "Analysis")} className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-borda bg-painel p-2 shadow-xl" onClick={() => {
        if (menu.current) menu.current.open = false;
      }}>
        <ItensMenu compacto />
      </nav>
    </details>
  );
}
