import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { type Alerta, useAvisos, useMarcarVistos } from "../../api/alertas";
import { useUsuario } from "../../api/auth";
import { t } from "../../lib/idioma";
import { formatarDiaMes, formatarPreco } from "../../lib/formato";
import { IconeItem } from "../Basicos";
import { classeBotaoRedondo } from "../modoTv/ModoTv";
import { IconeSino } from "./CriarAlerta";

/**
 * Sino do header, como o da Steam: fica verde, com o número, quando algum alerta disparou e a
 * pessoa ainda não viu. Abrir mostra os avisos e já os marca como vistos.
 */
export function SinoAlertas() {
  const { data: usuario } = useUsuario();
  const { data: avisos = [] } = useAvisos();
  const marcarVistos = useMarcarVistos();
  const [aberto, setAberto] = useState(false);
  // O que estava no sino na hora de abrir: marcar como visto esvazia a consulta, mas o painel continua mostrando.
  const [mostrando, setMostrando] = useState<Alerta[]>([]);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) setAberto(false);
    };
    const tecla = (evento: KeyboardEvent) => evento.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  if (!usuario) return null;
  const novos = avisos.length;

  function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setMostrando(avisos);
    setAberto(true);
    if (novos) marcarVistos.mutate();
  }

  const rotulo = novos
    ? t(`Alertas: ${novos} ${novos === 1 ? "disparou" : "dispararam"}`, `Alerts: ${novos} triggered`)
    : t("Alertas", "Alerts");

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-label={rotulo}
        title={rotulo}
        className={novos ? "relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-destaque text-fundo shadow-[0_0_18px_rgba(198,243,107,0.45)] transition hover:brightness-110" : classeBotaoRedondo}
      >
        <span className={novos ? "inline-block origin-top motion-safe:animate-[balancar_1.2s_ease-in-out_2]" : "inline-block"}>
          <IconeSino tamanho={16} cheio={novos > 0} />
        </span>
        {novos > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full border-2 border-fundo bg-texto px-1 font-mono text-[10px] leading-none text-fundo">
            {novos > 9 ? "9+" : novos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute top-full right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-borda bg-painel shadow-[0_18px_50px_rgba(0,0,0,0.6)] transition-[opacity,translate] duration-200 starting:-translate-y-1 starting:opacity-0">
          <div className="flex items-center justify-between border-b border-borda px-4 py-3">
            <span className="text-sm">{t("Alertas", "Alerts")}</span>
            <span className="font-mono text-[11px] text-apagado">
              {mostrando.length ? t(`${mostrando.length} ${mostrando.length === 1 ? "novo" : "novos"}`, `${mostrando.length} new`) : ""}
            </span>
          </div>
          {mostrando.length ? (
            <ul className="max-h-80 divide-y divide-borda/60 overflow-y-auto">
              {mostrando.map((alerta) => (
                <li key={alerta.id}>
                  <Link
                    to={`/itens/${alerta.item.id}`}
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-painel-alto"
                  >
                    <IconeItem url={alerta.item.icon_url} nome={alerta.item.nome} tamanho={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{alerta.item.nome}</p>
                      <p className="text-xs text-suave">
                        {alerta.condicao === "abaixo" ? t("Caiu para ", "Dropped to ") : t("Subiu para ", "Rose to ")}
                        <span className={`font-mono ${alerta.condicao === "abaixo" ? "text-destaque" : "text-texto"}`}>
                          {alerta.preco_disparo !== null ? formatarPreco(alerta.preco_disparo) : "—"}
                        </span>
                        <span className="text-apagado">{t(` (alvo ${formatarPreco(alerta.preco_alvo)})`, ` (target ${formatarPreco(alerta.preco_alvo)})`)}</span>
                      </p>
                    </div>
                    {alerta.data_preco_disparo && (
                      <span className="shrink-0 font-mono text-[10px] text-apagado">{formatarDiaMes(alerta.data_preco_disparo)}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-suave">
              {t("Nenhum aviso novo. Os alertas são conferidos depois da coleta diária.", "No new alerts. Alerts are checked after the daily price collection.")}
            </p>
          )}
          <Link
            to="/alertas"
            onClick={() => setAberto(false)}
            className="block border-t border-borda px-4 py-3 text-center text-sm text-destaque transition-colors hover:bg-painel-alto"
          >
            {t("Ver todos os alertas →", "See all alerts →")}
          </Link>
        </div>
      )}
    </div>
  );
}
