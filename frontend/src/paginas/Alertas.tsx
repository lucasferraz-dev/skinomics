import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "react-router";

import { type Alerta, quantoFalta, useAlertas, useAtualizarAlerta, useRemoverAlerta } from "../api/alertas";
import { useUsuario } from "../api/auth";
import { type ItemResumo, useItens } from "../api/itens";
import { FormAlerta, IconeSino } from "../componentes/alertas/CriarAlerta";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo } from "../componentes/Basicos";
import { analiseDosAlertas } from "../componentes/mascote/analise";
import { MascotesFixos } from "../componentes/mascote/MascotesFixos";
import { t, useIdioma } from "../lib/idioma";
import { formatarDiaMes, formatarInstante, formatarPreco, formatarVariacao } from "../lib/formato";
import { CabecalhoSecao } from "./inicio/ui";

export function Alertas() {
  useIdioma();
  const { data: usuario, isPending: carregandoUsuario } = useUsuario();
  const consulta = useAlertas();
  const alertas = consulta.data;
  const falas = analiseDosAlertas({ logado: Boolean(usuario), alertas });

  const disparados = (alertas ?? []).filter((alerta) => alerta.estado === "disparado");
  const vigiando = (alertas ?? []).filter((alerta) => alerta.estado !== "disparado");

  return (
    // pb: o fim da página não fica escondido atrás dos mascotes de plantão no canto.
    <div className="mx-auto max-w-6xl space-y-14 pb-44">
      <section data-tv={t("Alertas", "Alerts")} className="space-y-8">
        <CabecalhoSecao
          nivel={1}
          rotulo={t("Vigia de preço", "Price watch")}
          titulo={t("Alertas", "Alerts")}
          texto={t(
            "Escolha um preço-alvo e o Skinomics avisa no sino do topo quando o item chegar lá. Os alertas são conferidos uma vez por dia, logo depois da coleta de preços.",
            "Pick a target price and Skinomics lets you know on the bell up top when the item gets there. Alerts are checked once a day, right after prices are collected.",
          )}
        />
        {usuario && <NovoAlerta />}
      </section>

      {carregandoUsuario ? (
        <Carregando />
      ) : !usuario ? (
        <Vazio
          titulo={t("Entre para criar alertas.", "Sign in to create alerts.")}
          texto={t("Os alertas ficam guardados na sua conta Steam, e o aviso aparece no sino em qualquer aparelho.", "Alerts are saved to your Steam account, and the notice shows on the bell on any device.")}
          acao={
            <Link to="/entrar" className="inline-flex rounded-lg bg-destaque px-4 py-2.5 text-sm font-medium text-fundo transition-opacity hover:opacity-90">
              {t("Entrar com a Steam", "Sign in with Steam")}
            </Link>
          }
        />
      ) : consulta.isPending ? (
        <Painel className="rounded-2xl"><Carregando texto={t("Carregando seus alertas…", "Loading your alerts…")} /></Painel>
      ) : consulta.isError ? (
        <Painel className="rounded-2xl"><MensagemErro titulo={t("Não foi possível carregar seus alertas.", "Couldn't load your alerts.")} /></Painel>
      ) : alertas!.length === 0 ? (
        <Vazio
          titulo={t("Nenhum alerta ainda.", "No alerts yet.")}
          texto={t('Escolha um item acima, ou abra um item e use "Criar alerta" ao lado de Acompanhar.', 'Pick an item above, or open an item and use "Create alert" next to Follow.')}
          acao={<Link to="/itens" className="text-sm text-destaque hover:underline">{t("Explorar itens →", "Explore items →")}</Link>}
        />
      ) : (
        <>
          {disparados.length > 0 && (
            <section data-tv={t("Disparados", "Triggered")} className="space-y-6">
              <Titulo rotulo={t("Chegaram no preço", "Hit the price")} titulo={t("Disparados", "Triggered")} />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {disparados.map((alerta) => <CardDisparado key={alerta.id} alerta={alerta} />)}
              </div>
            </section>
          )}
          {vigiando.length > 0 && (
            <section data-tv={t("Vigiando", "Watching")} className="space-y-6">
              <Titulo
                rotulo={t("Conferidos todo dia", "Checked every day")}
                titulo={t("Vigiando", "Watching")}
                extra={t(`${vigiando.length} de ${alertas!.length}`, `${vigiando.length} of ${alertas!.length}`)}
              />
              <Painel className="overflow-hidden rounded-2xl">
                <ol className="divide-y divide-borda/60">
                  {vigiando.map((alerta) => <LinhaAlerta key={alerta.id} alerta={alerta} />)}
                </ol>
              </Painel>
            </section>
          )}
        </>
      )}

      <ComoFunciona />

      <MascotesFixos falas={falas} />
    </div>
  );
}

function Titulo({ rotulo, titulo, extra }: { rotulo: string; titulo: string; extra?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        <Rotulo destaque>{rotulo}</Rotulo>
        <h2 className="text-3xl leading-tight titulo sm:text-4xl">{titulo}</h2>
      </div>
      {extra && <span className="font-mono text-xs text-apagado">{extra}</span>}
    </div>
  );
}

/** Criar alerta sem sair da página: busca o item à esquerda e o formulário dele à direita. */
function NovoAlerta() {
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<ItemResumo | null>(null);
  const [criado, setCriado] = useState<string | null>(null);
  // Sem busca, os mais negociados: são os que mais gente quer vigiar.
  const { data, isFetching } = useItens(
    busca.trim() ? { busca: busca.trim(), por_pagina: 6 } : { ordenar: "volume_7d", direcao: "desc", por_pagina: 6 },
  );

  return (
    <Painel data-poleiro className="grid gap-6 rounded-2xl p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 sm:p-6">
      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-destaque"><IconeSino tamanho={16} /></span>
          <h2 className="text-lg">{t("Novo alerta", "New alert")}</h2>
        </div>
        <input
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder={t("Buscar item pelo nome…", "Search an item by name…")}
          aria-label={t("Buscar item", "Search item")}
          className="w-full rounded-lg border border-borda bg-fundo px-3 py-2 text-sm outline-none placeholder:text-apagado focus:border-destaque/60"
        />
        <ul className={`grid gap-1.5 sm:grid-cols-2 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {(data?.itens ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={escolhido?.id === item.id}
                onClick={() => {
                  setEscolhido(item);
                  setCriado(null);
                }}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  escolhido?.id === item.id ? "border-destaque/50 bg-destaque-fundo" : "border-transparent hover:border-borda hover:bg-painel-alto"
                }`}
              >
                <IconeItem url={item.icon_url} nome={item.nome} tamanho={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.nome}</span>
                  <span className="font-mono text-[11px] text-apagado">{item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—"}</span>
                </span>
              </button>
            </li>
          ))}
          {data && data.itens.length === 0 && (
            <li className="text-sm text-suave sm:col-span-2">{t("Nenhum item com esse nome.", "No item with that name.")}</li>
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-borda bg-painel-alto/40 p-4">
        {criado ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm">{t(`Alerta criado para ${criado}.`, `Alert created for ${criado}.`)}</p>
            <p className="text-xs text-suave">{t("Ele já aparece na lista abaixo.", "It already shows in the list below.")}</p>
            <button type="button" onClick={() => setCriado(null)} className="text-sm text-destaque hover:underline">
              {t("Criar outro", "Create another")}
            </button>
          </div>
        ) : escolhido ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <IconeItem url={escolhido.icon_url} nome={escolhido.nome} tamanho={36} />
              <p className="min-w-0 truncate text-sm">{escolhido.nome}</p>
            </div>
            <FormAlerta key={escolhido.id} item={escolhido} aoCriar={() => setCriado(escolhido.nome)} />
          </div>
        ) : (
          <p className="grid h-full place-items-center py-8 text-center text-sm text-suave">
            {t("Escolha um item ao lado para definir o preço-alvo.", "Pick an item to set the target price.")}
          </p>
        )}
      </div>
    </Painel>
  );
}

/** Quanto do caminho entre o preço da criação e o alvo o preço de hoje já andou (0 a 1). */
function progresso(alerta: Alerta): number | null {
  const hoje = alerta.item.preco_atual;
  const inicio = alerta.preco_criacao;
  if (hoje === null || inicio === null || inicio === alerta.preco_alvo) return null;
  const andado = (inicio - hoje) / (inicio - alerta.preco_alvo);
  return Math.min(1, Math.max(0, andado));
}

function LinhaAlerta({ alerta }: { alerta: Alerta }) {
  const atualizar = useAtualizarAlerta();
  const remover = useRemoverAlerta();
  const [editando, setEditando] = useState(false);
  const pausado = alerta.estado === "pausado";
  const falta = quantoFalta(alerta, alerta.item.preco_atual);
  const andado = progresso(alerta);
  const cor = alerta.condicao === "abaixo" ? "var(--color-destaque)" : "var(--color-texto)";

  return (
    <li className={`grid gap-4 px-4 py-4 transition-opacity md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center ${pausado ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 items-center gap-3">
        <IconeItem url={alerta.item.icon_url} nome={alerta.item.nome} />
        <div className="min-w-0">
          <Link to={`/itens/${alerta.item.id}`} className="block truncate text-sm hover:text-destaque">{alerta.item.nome}</Link>
          <p className="text-xs text-suave">
            {alerta.condicao === "abaixo" ? t("Cair até ", "Drop to ") : t("Subir até ", "Rise to ")}
            <span className="font-mono text-texto">{formatarPreco(alerta.preco_alvo)}</span>
            {pausado && <span className="text-apagado">{t(", pausado", ", paused")}</span>}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between gap-3 font-mono text-[11px]">
          <span className="text-suave">{t("hoje", "today")} {alerta.item.preco_atual !== null ? formatarPreco(alerta.item.preco_atual) : "—"}</span>
          <span className="text-apagado">
            {falta === null ? "" : falta <= 0 ? t("passou do alvo", "past the target") : t(`faltam ${formatarVariacao(falta).replace("+", "")}`, `${formatarVariacao(falta).replace("+", "")} to go`)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-painel-alto" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={andado === null ? undefined : Math.round(andado * 100)} aria-label={t("Caminho até o alvo", "Way to the target")}>
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(andado ?? 0) * 100}%`, background: cor }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 md:justify-end">
        {editando ? (
          <EditorAlvo alerta={alerta} aoFechar={() => setEditando(false)} />
        ) : (
          <>
            <Acao onClick={() => setEditando(true)}>{t("Alvo", "Target")}</Acao>
            <Acao onClick={() => atualizar.mutate({ id: alerta.id, ativo: pausado })} disabled={atualizar.isPending}>
              {pausado ? t("Retomar", "Resume") : t("Pausar", "Pause")}
            </Acao>
            <Acao onClick={() => remover.mutate(alerta.id)} disabled={remover.isPending} perigo>
              {t("Apagar", "Delete")}
            </Acao>
          </>
        )}
      </div>
    </li>
  );
}

function CardDisparado({ alerta }: { alerta: Alerta }) {
  const remover = useRemoverAlerta();
  const [editando, setEditando] = useState(false);
  const caiu = alerta.condicao === "abaixo";

  return (
    <div data-poleiro className={`flex flex-col gap-4 rounded-2xl border bg-painel p-5 ${alerta.visto ? "border-borda" : "border-destaque/50 shadow-[0_0_30px_rgba(198,243,107,0.12)]"}`}>
      <div className="flex items-center gap-3">
        <IconeItem url={alerta.item.icon_url} nome={alerta.item.nome} tamanho={44} />
        <div className="min-w-0 flex-1">
          <Link to={`/itens/${alerta.item.id}`} className="block truncate text-sm hover:text-destaque">{alerta.item.nome}</Link>
          <p className="font-mono text-[11px] text-apagado">
            {alerta.data_preco_disparo ? t(`preço de ${formatarDiaMes(alerta.data_preco_disparo)}`, `price from ${formatarDiaMes(alerta.data_preco_disparo)}`) : ""}
          </p>
        </div>
        {!alerta.visto && <span className="rounded-full bg-destaque px-2 py-0.5 text-[10px] font-medium text-fundo">{t("novo", "new")}</span>}
      </div>
      <div>
        <p className="text-xs text-suave">{caiu ? t("Caiu para", "Dropped to") : t("Subiu para", "Rose to")}</p>
        <p className={`font-mono text-3xl ${caiu ? "text-destaque" : "text-texto"}`}>{alerta.preco_disparo !== null ? formatarPreco(alerta.preco_disparo) : "—"}</p>
        <p className="mt-1 font-mono text-[11px] text-apagado">
          {t(`alvo ${formatarPreco(alerta.preco_alvo)}`, `target ${formatarPreco(alerta.preco_alvo)}`)}
          {alerta.item.preco_atual !== null && t(`, hoje ${formatarPreco(alerta.item.preco_atual)}`, `, today ${formatarPreco(alerta.item.preco_atual)}`)}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-borda pt-3">
        {editando ? (
          <EditorAlvo alerta={alerta} aoFechar={() => setEditando(false)} />
        ) : (
          <>
            <Acao onClick={() => setEditando(true)}>{t("Vigiar de novo", "Watch again")}</Acao>
            <Acao onClick={() => remover.mutate(alerta.id)} disabled={remover.isPending} perigo>{t("Apagar", "Delete")}</Acao>
            {alerta.disparado_em && <span className="ml-auto font-mono text-[10px] text-apagado">{formatarInstante(alerta.disparado_em)}</span>}
          </>
        )}
      </div>
    </div>
  );
}

/** Troca o alvo ali mesmo; num alerta disparado, isso o arma de novo. */
function EditorAlvo({ alerta, aoFechar }: { alerta: Alerta; aoFechar: () => void }) {
  const atualizar = useAtualizarAlerta();
  const [texto, setTexto] = useState(alerta.preco_alvo.toFixed(2).replace(".", ","));
  const numero = Number(texto.replace(/[^\d,.]/g, "").replace(",", "."));
  const valido = Number.isFinite(numero) && numero > 0;

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    atualizar.mutate({ id: alerta.id, preco_alvo: numero }, { onSuccess: aoFechar });
  }

  return (
    <form onSubmit={salvar} className="flex w-full flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-borda bg-fundo px-2 focus-within:border-destaque/60">
        <span className="font-mono text-xs text-apagado">US$</span>
        <input
          autoFocus
          inputMode="decimal"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            atualizar.reset();
          }}
          aria-label={t("Novo preço-alvo", "New target price")}
          className="w-20 bg-transparent py-1.5 font-mono text-sm outline-none"
        />
      </div>
      <Acao tipo="submit" disabled={!valido || atualizar.isPending}>{t("Salvar", "Save")}</Acao>
      <Acao onClick={aoFechar}>{t("Cancelar", "Cancel")}</Acao>
      {atualizar.isError && (
        <p role="alert" className="w-full text-xs text-queda">
          {atualizar.error.message.startsWith("PATCH") ? t("Não deu certo. Tente de novo.", "That didn't work. Try again.") : atualizar.error.message}
        </p>
      )}
    </form>
  );
}

function Acao({ children, onClick, disabled, perigo = false, tipo = "button" }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  perigo?: boolean;
  tipo?: "button" | "submit";
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
        perigo ? "text-apagado hover:bg-queda/10 hover:text-queda" : "text-suave hover:bg-painel-alto hover:text-texto"
      }`}
    >
      {children}
    </button>
  );
}

function ComoFunciona() {
  const cartoes = [
    {
      titulo: t("Uma vez por dia", "Once a day"),
      texto: t(
        "O Mercado da Steam dá um preço por dia para cada item. Os alertas são conferidos logo depois que esse preço entra, de madrugada.",
        "The Steam Market gives one price per day for each item. Alerts are checked right after that price comes in, overnight.",
      ),
    },
    {
      titulo: t("Avisa uma vez", "Notifies once"),
      texto: t(
        "Quando o preço chega no alvo, o alerta dispara, o sino do topo fica verde e ele para de vigiar. Para vigiar de novo, troque o alvo.",
        "When the price reaches the target, the alert triggers, the bell up top turns green and it stops watching. To watch again, change the target.",
      ),
    },
    {
      titulo: t("Só aqui no site", "Only here on the site"),
      texto: t(
        "Nada de e-mail. O aviso fica no sino e nesta página, na sua conta Steam, até você abrir.",
        "No e-mail. The notice stays on the bell and on this page, in your Steam account, until you open it.",
      ),
    },
  ];
  return (
    <section data-tv={t("Como funciona", "How it works")} className="space-y-8 pt-4">
      <CabecalhoSecao
        rotulo={t("Como funciona", "How it works")}
        titulo={t("Um vigia que não dorme.", "A watch that never sleeps.")}
        texto={t("Quando o alerta é conferido, quantas vezes ele avisa e onde o aviso aparece.", "When alerts are checked, how often they notify and where the notice shows up.")}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {cartoes.map(({ titulo, texto }) => (
          <div key={titulo} data-poleiro className="space-y-3 rounded-2xl border border-borda bg-painel p-6">
            <h3 className="text-lg">{titulo}</h3>
            <p className="text-sm leading-relaxed text-suave">{texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao: ReactNode }) {
  return (
    <Painel className="flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
      <span className="text-apagado"><IconeSino tamanho={28} /></span>
      <p className="text-texto">{titulo}</p>
      <p className="max-w-sm text-sm text-suave">{texto}</p>
      <div className="mt-2">{acao}</div>
    </Painel>
  );
}
