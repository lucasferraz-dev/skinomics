import { useEffect, useState } from "react";

import { IconeTelaCheia } from "../IconesAnimados";
import { classeBotaoRedondo } from "./ModoTv";

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
      <IconeTelaCheia cheia={cheia} />
    </button>
  );
}
