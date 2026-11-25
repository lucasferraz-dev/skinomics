import { type FormEvent, type ReactNode, useState } from "react";
import { Link } from "react-router";

import { type Alerta, quantoFalta, useAlertas, useAtualizarAlerta, useRemoverAlerta } from "../api/alertas";
import { useUsuario } from "../api/auth";
import { type ItemResumo, useItens } from "../api/itens";
import { FormAlerta, IconeSino } from "../componentes/alertas/CriarAlerta";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo } from "../componentes/Basicos";
import { categoriaDoItem } from "../componentes/chaveiro/temas";
import { analiseDosAlertas } from "../componentes/mascote/analise";
import { MascotesFixos } from "../componentes/mascote/MascotesFixos";
import { t, useIdioma } from "../lib/idioma";
import { formatarDiaMes, formatarInstante, formatarPreco, formatarVariacao } from "../lib/formato";
import { ADESIVOS, CardIndicador, type Indicador } from "./inicio/CardIndicador";
import { Medalha } from "./inicio/Medalha";
import { CabecalhoSecao } from "./inicio/ui";

const LIMITE_ALERTAS = 50;
const semSinal = (fracao: number) => formatarVariacao(Math.abs(fracao)).replace(/^[+-]/, "");

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
        {alertas && alertas.length > 0 && <Numeros alertas={alertas} />}
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
      ) : (
        <>
          <section data-tv={t("Novo alerta", "New alert")} className="space-y-6">
            <Titulo rotulo={t("Escolha o item e o preço", "Pick the item and the price")} titulo={t("Novo alerta", "New alert")} />
            <NovoAlerta />
          </section>

          {consulta.isPending ? (
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
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {vigiando.map((alerta) => <CardVigiando key={alerta.id} alerta={alerta} />)}
                  </div>
                </section>
              )}
            </>
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

/** Adesivos com os números dos alertas, os mesmos da landing, do item e das oportunidades. */
function Numeros({ alertas }: { alertas: Alerta[] }) {
  const vigiando = alertas.filter((alerta) => alerta.estado === "aguardando");
  const pausados = alertas.filter((alerta) => alerta.estado === "pausado").length;
  const disparados = alertas.filter((alerta) => alerta.estado === "disparado");
  const novos = disparados.filter((alerta) => !alerta.visto).length;
  const maisPerto = vigiando
    .map((alerta) => ({ alerta, falta: quantoFalta(alerta, alerta.item.preco_atual) }))
    .filter((par): par is { alerta: Alerta; falta: number } => par.falta !== null)
    .sort((a, b) => a.falta - b.falta)[0];

  const indicadores: Indicador[] = [
    {
      rotulo: t("Vigiando", "Watching"),
      valor: String(vigiando.length),
      detalhe: t("conferidos todo dia", "checked every day"),
      icone: "horizonte",
      verso: { rotulo: t("Pausados", "Paused"), valor: String(pausados) },
    },
    {
      rotulo: t("Disparados", "Triggered"),
      valor: String(disparados.length),
      detalhe: t("chegaram no preço", "hit the price"),
      icone: "oportunidade",
      verso: { rotulo: t("Novos no sino", "New on the bell"), valor: String(novos) },
    },
    {
      rotulo: t("Mais perto", "Closest"),
      valor: maisPerto ? semSinal(maisPerto.falta) : "—",
      detalhe: maisPerto ? maisPerto.alerta.item.nome : t("nenhum vigiando", "none watching"),
      icone: "variacao",
      verso: { rotulo: t("Alvo", "Target"), valor: maisPerto ? formatarPreco(maisPerto.alerta.preco_alvo) : "—" },
    },
    {
      rotulo: t("Na conta", "On your account"),
      valor: `${alertas.length} / ${LIMITE_ALERTAS}`,
      detalhe: t("alertas criados", "alerts created"),
      icone: "itens",
      verso: { rotulo: t("Limite por conta", "Per-account limit"), valor: String(LIMITE_ALERTAS) },
    },
  ];

  return (
    // overflow-x-clip: a camada da aba dobrada dos adesivos é maior que eles e não pode alargar a página.
    <div className="grid grid-cols-1 gap-3 overflow-x-clip py-1 sm:grid-cols-2 lg:grid-cols-4">
      {indicadores.map((indicador, i) => (
        <CardIndicador key={indicador.rotulo} {...indicador} adesivo={ADESIVOS[i % ADESIVOS.length]!} />
      ))}
    </div>
  );
}

/** O item numa vitrine, como no hero do detalhe: fundo escuro com brilho roxo e a imagem inclinada. */
function Vitrine({ item, proporcao = "aspect-[16/10]", children }: { item: Pick<ItemResumo, "icon_url" | "nome">; proporcao?: string; children?: ReactNode }) {
  return (
    <div className={`relative select-none overflow-hidden bg-[radial-gradient(ellipse_at_60%_40%,#1b2119,var(--color-fundo)_70%)] ${proporcao}`}>
      <div className="absolute top-1/4 left-1/2 size-40 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
      {item.icon_url ? (
        <img
          src={`${item.icon_url}/256fx256f`}
          alt=""
          draggable={false}
          className="absolute top-1/2 left-1/2 w-[42%] -translate-x-1/2 -translate-y-1/2 -rotate-12 drop-shadow-[0_18px_30px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-6"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-mono text-4xl text-apagado">{item.nome.slice(0, 2).toUpperCase()}</span>
      )}
      {children}
    </div>
  );
}

/** Card no formato dos terminais da landing: faixa de cima com o rótulo, conteúdo e rodapé. */
function Terminal({ rotulo, canto, destaque = false, apagado = false, children }: {
  rotulo: ReactNode;
  canto?: ReactNode;
  destaque?: boolean;
  apagado?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-poleiro
      className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-painel transition-[border-color,opacity] ${
        destaque ? "border-destaque/50 shadow-[0_0_30px_rgba(198,243,107,0.12)]" : "border-borda hover:border-destaque/30"
      } ${apagado ? "opacity-60 hover:opacity-100" : ""}`}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-borda px-4">
        <span className="min-w-0 truncate">{rotulo}</span>
        {canto}
      </div>
      {children}
    </div>
  );
}

/** Criar alerta sem sair da página: a busca à esquerda, o item escolhido numa vitrine com o formulário à direita. */
function NovoAlerta() {
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<ItemResumo | null>(null);
  const [criado, setCriado] = useState<string | null>(null);
  // Sem busca, os mais negociados: são os que mais gente quer vigiar.
  const { data, isFetching } = useItens(
    busca.trim() ? { busca: busca.trim(), por_pagina: 8 } : { ordenar: "volume_7d", direcao: "desc", por_pagina: 8 },
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Terminal rotulo={<Rotulo destaque>{busca.trim() ? t("Resultado da busca", "Search results") : t("Mais negociados", "Most traded")}</Rotulo>}>
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2 rounded-lg border border-borda bg-fundo px-3 focus-within:border-destaque/60">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-apagado)" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
              <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
            </svg>
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder={t("Buscar item pelo nome…", "Search an item by name…")}
              aria-label={t("Buscar item", "Search item")}
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-apagado"
            />
          </div>
          <ul className={`grid gap-2 sm:grid-cols-2 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
            {(data?.itens ?? []).map((item) => {
              const ativo = escolhido?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => {
                      setEscolhido(item);
                      setCriado(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      ativo ? "border-destaque/60 bg-destaque-fundo" : "border-borda/60 bg-fundo/40 hover:border-destaque/30"
                    }`}
                  >
                    <IconeItem url={item.icon_url} nome={item.nome} tamanho={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.nome}</span>
                      <span className="font-mono text-[11px] text-apagado">{item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—"}</span>
                    </span>
                    {ativo && <span className="text-destaque" aria-hidden>●</span>}
                  </button>
                </li>
              );
            })}
            {data && data.itens.length === 0 && (
              <li className="py-6 text-center text-sm text-suave sm:col-span-2">{t("Nenhum item com esse nome.", "No item with that name.")}</li>
            )}
          </ul>
        </div>
      </Terminal>

      <Terminal
        destaque={Boolean(escolhido) && !criado}
        rotulo={<Rotulo destaque>{escolhido ? t("Preço-alvo", "Target price") : t("Nenhum item escolhido", "No item picked")}</Rotulo>}
        canto={<span className="text-destaque"><IconeSino tamanho={15} cheio={Boolean(escolhido)} /></span>}
      >
        {escolhido ? (
          <>
            <Vitrine item={escolhido} proporcao="aspect-[16/9]">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-painel via-painel/70 to-transparent px-4 pt-10 pb-3">
                <p className="truncate text-sm">{escolhido.nome}</p>
                <p className="font-mono text-xs text-suave">
                  {t("hoje", "today")} {escolhido.preco_atual !== null ? formatarPreco(escolhido.preco_atual) : "—"}
                </p>
              </div>
            </Vitrine>
            <div className="p-4">
              {criado ? (
                <div className="space-y-3 py-4 text-center">
                  <p className="text-sm">{t(`Alerta criado para ${criado}.`, `Alert created for ${criado}.`)}</p>
                  <p className="text-xs text-suave">{t("Ele já aparece em Vigiando, logo abaixo.", "It already shows under Watching, below.")}</p>
                  <button type="button" onClick={() => setCriado(null)} className="text-sm text-destaque hover:underline">
                    {t("Criar outro", "Create another")}
                  </button>
                </div>
              ) : (
                <FormAlerta key={escolhido.id} item={escolhido} aoCriar={() => setCriado(escolhido.nome)} />
              )}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full border border-borda text-apagado">
              <IconeSino tamanho={20} />
            </span>
            <p className="max-w-56 text-sm text-suave">{t("Escolha um item ao lado para definir o preço-alvo.", "Pick an item to set the target price.")}</p>
          </div>
        )}
      </Terminal>
    </div>
  );
}

/** Quanto do caminho entre o preço da criação e o alvo o preço de hoje já andou (0 a 1). */
function progresso(alerta: Alerta): number | null {
  const hoje = alerta.item.preco_atual;
  const inicio = alerta.preco_criacao;
  if (hoje === null || inicio === null || inicio === alerta.preco_alvo) return null;
  return Math.min(1, Math.max(0, (inicio - hoje) / (inicio - alerta.preco_alvo)));
}

/** Um alerta vigiando, num terminal: a condição em cima, o preço de hoje e o caminho até o alvo. */
function CardVigiando({ alerta }: { alerta: Alerta }) {
  const atualizar = useAtualizarAlerta();
  const remover = useRemoverAlerta();
  const [editando, setEditando] = useState(false);
  const pausado = alerta.estado === "pausado";
  const caindo = alerta.condicao === "abaixo";
  const falta = quantoFalta(alerta, alerta.item.preco_atual);
  const andado = progresso(alerta);
  const cor = caindo ? "var(--color-destaque)" : "var(--color-texto)";
  const categoria = categoriaDoItem(alerta.item);

  return (
    <Terminal
      apagado={pausado}
      rotulo={
        <Rotulo destaque={!pausado}>
          {pausado ? t("Pausado", "Paused") : caindo ? t(`Cair até ${formatarPreco(alerta.preco_alvo)}`, `Drop to ${formatarPreco(alerta.preco_alvo)}`) : t(`Subir até ${formatarPreco(alerta.preco_alvo)}`, `Rise to ${formatarPreco(alerta.preco_alvo)}`)}
        </Rotulo>
      }
      canto={
        <span className={`font-mono text-sm ${caindo ? "text-destaque" : "text-texto"}`} aria-hidden>
          {caindo ? "↘" : "↗"}
        </span>
      }
    >
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconeItem url={alerta.item.icon_url} nome={alerta.item.nome} tamanho={40} />
          <div className="min-w-0">
            <Link to={`/itens/${alerta.item.id}`} className="block truncate text-sm hover:text-destaque">{alerta.item.nome}</Link>
            <p className="truncate text-xs text-apagado">{categoria?.nome ?? alerta.item.tipo ?? " "}</p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-apagado">{t("Hoje", "Today")}</p>
            <p className="font-mono text-2xl leading-none">{alerta.item.preco_atual !== null ? formatarPreco(alerta.item.preco_atual) : "—"}</p>
          </div>
          <p className={`text-right font-mono text-xs ${falta !== null && falta <= 0 ? "text-destaque" : "text-suave"}`}>
            {falta === null
              ? ""
              : falta <= 0
                ? t("no alvo: dispara na próxima checagem", "at target: triggers on the next check")
                : t(`faltam ${semSinal(falta)}`, `${semSinal(falta)} to go`)}
          </p>
        </div>

        <div className="space-y-1.5">
          <div
            className="relative h-2 rounded-full bg-painel-alto"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={andado === null ? undefined : Math.round(andado * 100)}
            aria-label={t("Caminho até o alvo", "Way to the target")}
          >
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(andado ?? 0) * 100}%`, background: cor }} />
            {/* O alvo, como a bandeirinha no fim da pista. */}
            <span className="absolute top-1/2 right-0 size-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 bg-painel" style={{ borderColor: cor }} aria-hidden />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-apagado">
            <span>{alerta.preco_criacao !== null ? t(`criado em ${formatarPreco(alerta.preco_criacao)}`, `set at ${formatarPreco(alerta.preco_criacao)}`) : ""}</span>
            <span>{t(`alvo ${formatarPreco(alerta.preco_alvo)}`, `target ${formatarPreco(alerta.preco_alvo)}`)}</span>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-borda pt-3">
          {editando ? (
            <EditorAlvo alerta={alerta} aoFechar={() => setEditando(false)} />
          ) : (
            <>
              <Acao onClick={() => setEditando(true)}>{t("Trocar alvo", "Change target")}</Acao>
              <Acao onClick={() => atualizar.mutate({ id: alerta.id, ativo: pausado })} disabled={atualizar.isPending}>
                {pausado ? t("Retomar", "Resume") : t("Pausar", "Pause")}
              </Acao>
              <Acao onClick={() => remover.mutate(alerta.id)} disabled={remover.isPending} perigo>
                {t("Apagar", "Delete")}
              </Acao>
            </>
          )}
        </div>
      </div>
    </Terminal>
  );
}

/** Um alerta disparado: o item na vitrine com a medalha do movimento e o preço que disparou em destaque. */
function CardDisparado({ alerta }: { alerta: Alerta }) {
  const remover = useRemoverAlerta();
  const [editando, setEditando] = useState(false);
  const caiu = alerta.condicao === "abaixo";

  return (
    <Terminal
      destaque={!alerta.visto}
      rotulo={
        <Rotulo destaque>
          {alerta.data_preco_disparo ? t(`Disparou com o preço de ${formatarDiaMes(alerta.data_preco_disparo)}`, `Triggered by the ${formatarDiaMes(alerta.data_preco_disparo)} price`) : t("Disparou", "Triggered")}
        </Rotulo>
      }
      canto={!alerta.visto ? <span className="rounded-full bg-destaque px-2 py-0.5 text-[10px] font-medium text-fundo">{t("novo", "new")}</span> : undefined}
    >
      <Link to={`/itens/${alerta.item.id}`} aria-label={alerta.item.nome}>
        <Vitrine item={alerta.item}>
          <Medalha tipo={caiu ? "queda" : "alta"} tamanho="pequena" className="absolute top-3 left-3 z-10" />
        </Vitrine>
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <Link to={`/itens/${alerta.item.id}`} className="block truncate text-sm hover:text-destaque">{alerta.item.nome}</Link>
          <p className="mt-3 text-xs text-suave">{caiu ? t("Caiu para", "Dropped to") : t("Subiu para", "Rose to")}</p>
          <p className={`font-mono text-4xl leading-none ${caiu ? "text-destaque" : "text-texto"}`}>
            {alerta.preco_disparo !== null ? formatarPreco(alerta.preco_disparo) : "—"}
          </p>
          <p className="mt-2 font-mono text-[11px] text-apagado">
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
    </Terminal>
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
      <span className="grid size-12 place-items-center rounded-full border border-borda text-apagado"><IconeSino tamanho={22} /></span>
      <p className="text-texto">{titulo}</p>
      <p className="max-w-sm text-sm text-suave">{texto}</p>
      <div className="mt-2">{acao}</div>
    </Painel>
  );
}
