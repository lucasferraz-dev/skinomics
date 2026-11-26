import { type ReactNode, useRef } from "react";
import { Link } from "react-router";

import { useUsuario } from "../api/auth";
import { useHistorico } from "../api/itens";
import { type ItemAcompanhado, useAlternarAcompanhamento, useMinhaLista } from "../api/minhaLista";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { ChaveirosDoItem } from "../componentes/chaveiro/Chaveiro";
import { categoriaDoItem } from "../componentes/chaveiro/temas";
import { analiseDaMinhaLista } from "../componentes/mascote/analise";
import { MascotesFixos } from "../componentes/mascote/MascotesFixos";
import { t, useIdioma } from "../lib/idioma";
import { diasAntes, formatarDiaMes, formatarPreco, formatarVariacao } from "../lib/formato";
import { jogoDoItem } from "../lib/jogos";
import { Tendencia } from "./ExplorarItens";
import { CabecalhoSecao } from "./inicio/ui";

export function MinhaLista() {
  useIdioma();
  const { data: usuario, isPending: carregandoUsuario } = useUsuario();
  const consulta = useMinhaLista();
  const itens = consulta.data;
  const falas = analiseDaMinhaLista({ logado: Boolean(usuario), itens });

  // Quem mais subiu e quem mais caiu desde que entrou na lista (só itens com as duas pontas do preço).
  const comVariacao = (itens ?? [])
    .filter((item): item is ItemAcompanhado & { variacao_desde_inclusao: number } => item.variacao_desde_inclusao !== null)
    .sort((a, b) => b.variacao_desde_inclusao - a.variacao_desde_inclusao);
  const melhor = comVariacao[0];
  const pior = comVariacao.length > 1 ? comVariacao.at(-1) : undefined;

  return (
    // pb: o fim da página não fica escondido atrás dos mascotes de plantão no canto.
    <div className="mx-auto max-w-6xl space-y-14 pb-44">
      <section data-tv={t("Minha lista", "My list")}>
        <CabecalhoSecao
          nivel={1}
          rotulo={t("Acompanhamento", "Following")}
          titulo={t("Minha lista", "My list")}
          texto={t(
            "Os itens que você está de olho, com quanto cada um mudou desde que entrou na lista. Para pôr um item aqui, abra ele e use Acompanhar.",
            "The items you're keeping an eye on, with how much each one changed since it joined the list. To add one, open it and use Follow.",
          )}
        />
      </section>

      {carregandoUsuario ? (
        <Carregando />
      ) : !usuario ? (
        <Vazio
          titulo={t("Entre para montar sua lista.", "Sign in to build your list.")}
          texto={t("A lista fica guardada na sua conta Steam: você vê os mesmos itens em qualquer aparelho.", "The list is saved to your Steam account: you see the same items on any device.")}
          acao={
            <Link to="/entrar" className="inline-flex rounded-lg bg-destaque px-4 py-2.5 text-sm font-medium text-fundo transition-opacity hover:opacity-90">
              {t("Entrar com a Steam", "Sign in with Steam")}
            </Link>
          }
        />
      ) : consulta.isPending ? (
        <Painel className="rounded-2xl"><Carregando texto={t("Carregando sua lista…", "Loading your list…")} /></Painel>
      ) : consulta.isError ? (
        <Painel className="rounded-2xl"><MensagemErro titulo={t("Não foi possível carregar sua lista.", "Couldn't load your list.")} /></Painel>
      ) : itens!.length === 0 ? (
        <Vazio
          titulo={t("Sua lista está vazia.", "Your list is empty.")}
          texto={t('Abra um item e use "Acompanhar" para ver aqui como o preço dele anda desde então.', 'Open an item and use "Follow" to see here how its price moves from then on.')}
          acao={<Link to="/itens" className="text-sm text-destaque hover:underline">{t("Explorar itens →", "Explore items →")}</Link>}
        />
      ) : (
        <>
          {melhor && (
            <section data-tv={t("Desde que entraram", "Since they joined")} className="space-y-6">
              <Titulo rotulo={t("Desde que entraram na lista", "Since they joined the list")} titulo={pior ? t("Quem foi melhor e pior", "Best and worst") : t("Seu item", "Your item")} />
              {/* md:pb: espaço para os chaveiros que pendem embaixo das vitrines. */}
              <div data-tour="lista-destaques" className="grid gap-4 md:grid-cols-2 md:pb-24">
                <Destaque item={melhor} rotulo={pior ? t("Mais subiu", "Rose the most") : t("Desde que entrou", "Since it joined")} />
                {pior && <Destaque item={pior} rotulo={t("Mais caiu", "Fell the most")} />}
              </div>
            </section>
          )}

          <section data-tv={t("Todos os itens", "All items")} className="space-y-6">
            <Titulo
              rotulo={t("De olho", "Watching")}
              titulo={t("Todos os itens", "All items")}
              extra={t(`${itens!.length} ${itens!.length === 1 ? "item" : "itens"}`, `${itens!.length} ${itens!.length === 1 ? "item" : "items"}`)}
            />
            <Tabela itens={itens!} />
          </section>
        </>
      )}

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

/** O item na vitrine, com a variação desde que entrou na lista em número grande e os chaveiros embaixo. */
function Destaque({ item, rotulo }: { item: ItemAcompanhado & { variacao_desde_inclusao: number }; rotulo: string }) {
  const card = useRef<HTMLAnchorElement>(null);
  const subiu = item.variacao_desde_inclusao >= 0;

  return (
    // Os chaveiros ficam fora do link: arrastar um deles não pode abrir o item ao soltar.
    <div className="relative min-w-0">
      <Link
        ref={card}
        to={`/itens/${item.id}`}
        data-poleiro
        className="group grid min-w-0 overflow-hidden rounded-2xl border border-borda bg-painel transition-colors hover:border-destaque/50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="relative aspect-[16/10] select-none overflow-hidden bg-[radial-gradient(ellipse_at_60%_40%,#1b2119,var(--color-fundo)_70%)] sm:aspect-auto sm:min-h-56">
          <div className="absolute top-1/4 left-1/2 size-40 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
          {item.icon_url ? (
            <img
              src={`${item.icon_url}/256fx256f`}
              alt=""
              draggable={false}
              className="absolute top-1/2 left-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2 -rotate-12 drop-shadow-[0_18px_30px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-6"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-mono text-4xl text-apagado">{item.nome.slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 border-t border-borda p-5 sm:border-t-0 sm:border-l">
          <Rotulo destaque>{rotulo}</Rotulo>
          <p className="line-clamp-2 text-base leading-snug group-hover:text-destaque">{item.nome}</p>
          <p className={`font-mono text-5xl leading-none ${subiu ? "text-destaque" : "text-queda"}`}>{formatarVariacao(item.variacao_desde_inclusao)}</p>
          <div className="mt-auto space-y-1 border-t border-borda pt-3 font-mono text-xs text-suave">
            <p>
              {item.preco_inclusao !== null && formatarPreco(item.preco_inclusao)}
              <span className="px-2 text-apagado" aria-hidden>→</span>
              <span className="text-texto">{item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—"}</span>
            </p>
            <p className="text-apagado">{t(`na lista desde ${formatarDiaMes(item.incluido_em)}`, `on the list since ${formatarDiaMes(item.incluido_em)}`)}</p>
          </div>
        </div>
      </Link>
      <ChaveirosDoItem item={item} parede={card} direita="1.5rem" className="hidden md:block" />
    </div>
  );
}

function Tabela({ itens }: { itens: ItemAcompanhado[] }) {
  // A barra de "desde que entrou" usa a mesma escala para a lista toda, para dar para comparar.
  const escala = Math.max(0.05, ...itens.map((item) => Math.abs(item.variacao_desde_inclusao ?? 0)));

  return (
    <Painel data-tour="lista-tabela" className="overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[860px] text-left">
        <thead className="whitespace-nowrap">
          <tr className="border-b border-borda">
            <th className="px-4 py-3"><Rotulo>{t("Item", "Item")}</Rotulo></th>
            <th className="px-4 py-3 text-right"><Rotulo>{t("Hoje", "Today")}</Rotulo></th>
            <th className="px-4 py-3"><Rotulo>{t("Desde que entrou", "Since it joined")}</Rotulo></th>
            <th className="px-4 py-3 text-right"><Rotulo>{t("Var. 7d", "7d change")}</Rotulo></th>
            <th className="px-4 py-3"><Rotulo>{t("Tendência 30d", "30d trend")}</Rotulo></th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <Linha key={item.id} item={item} escala={escala} />
          ))}
        </tbody>
      </table>
    </Painel>
  );
}

function Linha({ item, escala }: { item: ItemAcompanhado; escala: number }) {
  const alternar = useAlternarAcompanhamento();
  const inicio = item.data_preco ? diasAntes(item.data_preco, 30) : undefined;
  const historico = useHistorico(item.id, inicio, item.data_preco !== null);

  return (
    // A linha inteira é clicável: o link do nome se estende sobre ela (after:absolute).
    <tr className="relative border-b border-borda/60 transition-colors last:border-0 hover:bg-painel-alto">
      <td className="relative px-4 py-3">
        <ChaveirosDoItem item={item} tamanho="mini" direita="0.75rem" className="hidden sm:block" />
        <div className="flex items-center gap-3 sm:pr-24">
          <IconeItem url={item.icon_url} nome={item.nome} />
          <div className="min-w-0">
            <Link to={`/itens/${item.id}`} className="block truncate text-sm after:absolute after:inset-0">
              {item.nome}
            </Link>
            <span className="text-xs text-apagado">{categoriaDoItem(item)?.nome ?? item.tipo ?? jogoDoItem(item.appid)?.nome}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">
        {item.preco_atual !== null ? formatarPreco(item.preco_atual) : <span className="text-apagado">—</span>}
      </td>
      <td className="px-4 py-3">
        <BarraDesde valor={item.variacao_desde_inclusao} escala={escala} />
        <span className="mt-1 block font-mono text-[10px] text-apagado">
          {item.preco_inclusao !== null && t(`de ${formatarPreco(item.preco_inclusao)}, `, `from ${formatarPreco(item.preco_inclusao)}, `)}
          {formatarDiaMes(item.incluido_em)}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <Variacao valor={item.variacao_7d} />
      </td>
      <td className="px-4 py-3">
        <Tendencia pontos={historico.data} />
      </td>
      <td className="pr-4 text-right">
        {/* relative z-10: fica acima do link que cobre a linha inteira. */}
        <button
          type="button"
          onClick={() => alternar.mutate({ itemId: item.id, acompanhar: false })}
          disabled={alternar.isPending}
          className="relative z-10 rounded-md px-2 py-1 text-xs text-apagado transition-colors hover:bg-fundo hover:text-queda disabled:opacity-50"
        >
          {t("Remover", "Remove")}
        </button>
      </td>
    </tr>
  );
}

/** Barra que sai do zero, para a direita (verde) quando subiu e para a esquerda (coral) quando caiu. */
function BarraDesde({ valor, escala }: { valor: number | null; escala: number }) {
  if (valor === null) return <span className="font-mono text-sm text-apagado">—</span>;
  const metade = Math.min(1, Math.abs(valor) / escala) * 50;
  const subiu = valor >= 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 w-24 shrink-0 rounded-full bg-painel-alto" aria-hidden>
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-borda" />
        <span
          className={`absolute inset-y-0 rounded-full ${subiu ? "left-1/2 bg-destaque" : "right-1/2 bg-queda"}`}
          style={{ width: `${metade}%` }}
        />
      </div>
      <span className="text-sm"><Variacao valor={valor} /></span>
    </div>
  );
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao: ReactNode }) {
  return (
    <Painel data-tour="lista-vazia" className="flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-apagado)" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
      <p className="text-texto">{titulo}</p>
      <p className="max-w-sm text-sm text-suave">{texto}</p>
      <div className="mt-2">{acao}</div>
    </Painel>
  );
}
