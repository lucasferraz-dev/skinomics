import { t, trocarIdioma, useIdioma } from "../lib/idioma";
import { IconeGlobo } from "./IconesAnimados";
import { classeBotaoRedondo } from "./modoTv/ModoTv";

/** Globo com a sigla do idioma atual; um clique troca entre português e inglês. */
export function BotaoIdioma() {
  const idioma = useIdioma();
  const rotulo = t("Mudar para inglês", "Switch to Portuguese");
  return (
    <button
      type="button"
      data-tour="idioma"
      onClick={() => trocarIdioma(idioma === "pt" ? "en" : "pt")}
      aria-label={rotulo}
      title={rotulo}
      className={`relative ${classeBotaoRedondo}`}
    >
      <IconeGlobo />
      <span className="absolute -right-1.5 -bottom-1 rounded-full bg-destaque px-1 font-mono text-[8px] leading-3 font-bold text-fundo">
        {idioma.toUpperCase()}
      </span>
    </button>
  );
}
