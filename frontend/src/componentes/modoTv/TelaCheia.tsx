import { useEffect, useState } from "react";

import { classeBotaoRedondo, icone } from "./ModoTv";

const EXPANDIR = "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5";
const RECOLHER = "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5";

/** Liga e desliga a tela cheia do navegador. Some onde a API não existe (ex.: Safari do iPhone). */
export function BotaoTelaCheia() {
  const [cheia, setCheia] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);

  useEffect(() => {
    const atualizar = () => setCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", atualizar);
    return () => document.removeEventListener("fullscreenchange", atualizar);
  }, []);

  if (typeof document === "undefined" || !document.documentElement.requestFullscreen) return null;

  const alternar = () => {
    const pedido = cheia ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    pedido.catch(() => {
      /* o navegador recusou (ex.: sem gesto do usuário): nada a fazer */
    });
  };

  return (
    <button
      type="button"
      data-tour="tela-cheia"
      onClick={alternar}
      aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}
      title={cheia ? "Sair da tela cheia" : "Tela cheia"}
      className={`hidden sm:grid ${classeBotaoRedondo}`}
    >
      {icone(cheia ? RECOLHER : EXPANDIR)}
    </button>
  );
}
