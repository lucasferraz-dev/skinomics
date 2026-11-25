import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import { type CondicaoAlerta, quantoFalta, useAlertas, useCriarAlerta } from "../../api/alertas";
import { useUsuario } from "../../api/auth";
import type { ItemResumo } from "../../api/itens";
import { t } from "../../lib/idioma";
import { formatarPreco, formatarVariacao } from "../../lib/formato";
import { Rotulo } from "../Basicos";

export function IconeSino({ tamanho = 15, cheio = false }: { tamanho?: number; cheio?: boolean }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill={cheio ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" />
    </svg>
  );
}

const ATALHOS: Record<CondicaoAlerta, number[]> = { abaixo: [-0.05, -0.1, -0.2], acima: [0.05, 0.1, 0.2] };

/** Aceita "1,80", "1.80" e "US$ 1,80". */
function lerPreco(texto: string): number | null {
  const numero = Number(texto.replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

const arredondar = (valor: number) => Math.max(0.01, Math.round(valor * 100) / 100);
const paraCampo = (valor: number) => valor.toFixed(2).replace(".", ",");

/**
 * Formulário do alerta: abaixo de (para comprar) ou acima de (para vender), com atalhos em % do
 * preço de hoje e, quando há previsão, o limite da faixa de 80%. Recusa na hora um alvo que o preço
 * de hoje já atingiu, que a API também recusaria.
 */
export function FormAlerta({ item, faixa, aoCriar }: {
  item: ItemResumo;
  faixa?: { inferior: number; superior: number };
  aoCriar?: () => void;
}) {
  const id = useId();
  const criar = useCriarAlerta();
  const hoje = item.preco_atual;
  const [condicao, setCondicao] = useState<CondicaoAlerta>("abaixo");
  const [texto, setTexto] = useState(hoje ? paraCampo(arredondar(hoje * 0.9)) : "");

  if (hoje === null) {
    return <p className="text-sm text-suave">{t("Este item ainda não tem preço coletado.", "This item has no collected price yet.")}</p>;
  }

  const alvo = lerPreco(texto);
  const falta = alvo === null ? null : quantoFalta({ condicao, preco_alvo: alvo }, hoje);
  const atingido = falta !== null && falta <= 0;
  const daFaixa = condicao === "abaixo" ? faixa?.inferior : faixa?.superior;
  const faixaServe = daFaixa !== undefined && (condicao === "abaixo" ? daFaixa < hoje : daFaixa > hoje);

  function trocar(nova: CondicaoAlerta) {
    setCondicao(nova);
    setTexto(paraCampo(arredondar(hoje! * (nova === "abaixo" ? 0.9 : 1.1))));
    criar.reset();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (alvo === null || atingido) return;
    criar.mutate({ item_id: item.id, condicao, preco_alvo: alvo }, { onSuccess: () => aoCriar?.() });
  }

  const atalho = "rounded-full border border-borda px-2.5 py-1 font-mono text-[11px] text-suave transition-colors hover:border-destaque/50 hover:text-texto";

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-borda bg-fundo p-1" role="group" aria-label={t("Condição do alerta", "Alert condition")}>
        {(["abaixo", "acima"] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            aria-pressed={condicao === opcao}
            onClick={() => trocar(opcao)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              condicao === opcao ? (opcao === "abaixo" ? "bg-destaque text-fundo" : "bg-texto text-fundo") : "text-suave hover:text-texto"
            }`}
          >
            {opcao === "abaixo" ? t("Cair até", "Drop to") : t("Subir até", "Rise to")}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor={id} className="block text-xs text-suave">
          {condicao === "abaixo"
            ? t("Me avise quando o preço ficar em ou abaixo de", "Notify me when the price is at or below")
            : t("Me avise quando o preço ficar em ou acima de", "Notify me when the price is at or above")}
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-borda bg-fundo px-3 focus-within:border-destaque/60">
          <span className="font-mono text-sm text-apagado">US$</span>
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              criar.reset();
            }}
            className="w-full bg-transparent py-2 font-mono text-lg outline-none"
          />
        </div>
        <p className={`font-mono text-[11px] ${atingido ? "text-queda" : "text-apagado"}`} aria-live="polite">
          {alvo === null
            ? t("Digite um preço.", "Type a price.")
            : atingido
              ? t(`Hoje já está em ${formatarPreco(hoje)}. Escolha um alvo que ainda não chegou.`, `It's already at ${formatarPreco(hoje)} today. Pick a target it hasn't reached.`)
              : t(
                  `${formatarVariacao(condicao === "abaixo" ? -falta! : falta!)} contra hoje (${formatarPreco(hoje)})`,
                  `${formatarVariacao(condicao === "abaixo" ? -falta! : falta!)} from today (${formatarPreco(hoje)})`,
                )}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ATALHOS[condicao].map((fracao) => (
          <button key={fracao} type="button" className={atalho} onClick={() => setTexto(paraCampo(arredondar(hoje * (1 + fracao))))}>
            {formatarVariacao(fracao)}
          </button>
        ))}
        {faixaServe && (
          <button type="button" className={atalho} onClick={() => setTexto(paraCampo(arredondar(daFaixa)))} title={t("Limite da faixa de 80% da previsão", "Edge of the forecast's 80% range")}>
            {t("Faixa da previsão", "Forecast range")}
          </button>
        )}
      </div>

      {criar.isError && (
        <p role="alert" className="text-xs text-queda">
          {criar.error.message.startsWith("POST") ? t("Não deu certo. Tente de novo.", "That didn't work. Try again.") : criar.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={alvo === null || atingido || criar.isPending}
        className="w-full rounded-lg bg-destaque px-4 py-2.5 text-sm font-medium text-fundo transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {criar.isPending ? t("Criando…", "Creating…") : t("Criar alerta", "Create alert")}
      </button>
    </form>
  );
}

const base = "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm whitespace-nowrap transition-colors";

/** Botão "Criar alerta" do detalhe do item, ao lado de Acompanhar. Abre o formulário num balão. */
export function BotaoCriarAlerta({ item, faixa }: { item: ItemResumo; faixa?: { inferior: number; superior: number } }) {
  const { data: usuario, isPending } = useUsuario();
  const alertas = useAlertas();
  const [aberto, setAberto] = useState(false);
  const [criado, setCriado] = useState(false);
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

  if (isPending) return null;
  if (!usuario) {
    return (
      <Link to="/entrar" className={`${base} border-borda text-suave hover:border-suave hover:text-texto`}>
        <IconeSino />
        {t("Criar alerta", "Create alert")}
      </Link>
    );
  }

  const doItem = (alertas.data ?? []).filter((alerta) => alerta.item.id === item.id && alerta.estado === "aguardando").length;

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => {
          setAberto(!aberto);
          setCriado(false);
        }}
        className={`${base} ${doItem ? "border-destaque/30 bg-destaque-fundo text-destaque" : "border-borda text-suave hover:border-suave hover:text-texto"}`}
      >
        <IconeSino cheio={doItem > 0} />
        {doItem ? t(`${doItem} ${doItem === 1 ? "alerta" : "alertas"}`, `${doItem} ${doItem === 1 ? "alert" : "alerts"}`) : t("Criar alerta", "Create alert")}
      </button>
      {aberto && (
        <div className="absolute top-full left-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-borda bg-painel shadow-[0_18px_50px_rgba(0,0,0,0.6)] starting:translate-y-1 starting:opacity-0 transition-[opacity,translate] duration-200">
          {/* Faixa de cima no formato dos terminais do site. */}
          <div className="flex h-10 items-center justify-between border-b border-borda px-4">
            <Rotulo destaque>{t("Novo alerta", "New alert")}</Rotulo>
            <span className="text-destaque"><IconeSino cheio /></span>
          </div>
          <div className="p-4">
          {criado ? (
            <div className="space-y-3 text-center">
              <p className="text-sm">{t("Alerta criado.", "Alert created.")}</p>
              <p className="text-xs text-suave">
                {t("Quando o preço chegar lá, o sino do topo fica verde.", "When the price gets there, the bell up top turns green.")}
              </p>
              <div className="flex justify-center gap-4 text-sm">
                <button type="button" className="text-suave hover:text-texto" onClick={() => setCriado(false)}>
                  {t("Criar outro", "Create another")}
                </button>
                <Link to="/alertas" className="text-destaque hover:underline">{t("Ver alertas →", "See alerts →")}</Link>
              </div>
            </div>
          ) : (
            <FormAlerta item={item} faixa={faixa} aoCriar={() => setCriado(true)} />
          )}
          </div>
        </div>
      )}
    </div>
  );
}
