import { Link } from "react-router";

import { type ItemResumo, useHistorico, usePrevisao } from "../api/itens";
import { Medalha, type TipoMedalha } from "../paginas/inicio/Medalha";
import { diasAntes, formatarInteiro, formatarPreco } from "../lib/formato";
import { jogoDoItem } from "../lib/jogos";
import { sinalDoModelo } from "../lib/sinal";
import { Rotulo, Variacao } from "./Basicos";
import { ChaveirosDoItem } from "./chaveiro/Chaveiro";
import { IconeTema } from "./chaveiro/IconeTema";
import { categoriaDoItem } from "./chaveiro/temas";
import { SeloSinal } from "./SinalModelo";
import { Sparkline } from "./Sparkline";

/**
 * Card de item no estilo dos terminais da landing: faixa com a categoria, a imagem numa vitrine com o
 * brilho roxo do hero, preço, variação da semana e o gráfico de 30 dias. Os chaveiros mini pendem da
 * faixa do topo para dentro da vitrine (os normais cairiam no card da linha de baixo).
 */
export function CardItem({ item, medalha }: { item: ItemResumo; medalha?: TipoMedalha }) {
  const inicio = item.data_preco ? diasAntes(item.data_preco, 30) : undefined;
  const { data: pontos } = useHistorico(item.id, inicio, item.data_preco !== null);
  const categoria = categoriaDoItem(item);
  const { data: previsao } = usePrevisao(item.id, 7);

  return (
    // Os chaveiros ficam fora do link: arrastar um deles não pode abrir o item ao soltar.
    <div className="group relative flex min-w-0 transition-transform duration-300 hover:-translate-y-1">
      <Link
        to={`/itens/${item.id}`}
        className="relative flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-borda bg-painel transition-[border-color,box-shadow] duration-300 group-hover:border-destaque/40 group-hover:shadow-[0_18px_40px_-24px_rgba(198,243,107,0.5)]"
      >
        <div className="flex h-10 items-center justify-between gap-2 border-b border-borda px-4">
          <span className="flex min-w-0 items-center gap-2">
            {categoria && <IconeTema tema={categoria} />}
            <span className="truncate">
              <Rotulo>{categoria?.nome ?? item.tipo ?? jogoDoItem(item.appid)?.nome ?? "Item"}</Rotulo>
            </span>
          </span>
          <span className="font-mono text-sm text-apagado transition-colors group-hover:text-destaque" aria-hidden>
            ↗
          </span>
        </div>
  
        <div className="relative h-36 overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,#1b2119,var(--color-painel)_70%)]">
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/15 blur-2xl transition-[background-color] duration-500 group-hover:bg-violet-500/25"
          />
          {item.icon_url ? (
            <img
              src={`${item.icon_url}/192fx192f`}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute inset-0 m-auto h-28 w-auto -rotate-6 object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-mono text-2xl text-apagado">
              {item.nome.slice(0, 2).toUpperCase()}
            </span>
          )}
          {medalha && <Medalha tipo={medalha} tamanho="pequena" className="absolute top-3 left-3 -rotate-[8deg]" />}
        </div>
  
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="truncate text-sm" title={item.nome}>
            {item.nome}
          </p>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-mono text-xl">{item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—"}</p>
              <p className="font-mono text-xs">
                <Variacao valor={item.variacao_7d} sufixo="7d" />
              </p>
            </div>
            <Sparkline valores={pontos?.map((ponto) => ponto.preco) ?? []} largura={92} altura={34} />
          </div>
          <div className="mt-auto flex min-h-[2.1rem] items-center justify-between gap-2 border-t border-borda pt-3">
            <p className="truncate font-mono text-[11px] text-apagado">
              {item.volume_7d !== null ? `${formatarInteiro(item.volume_7d)} vendas em 7 dias` : "Sem vendas registradas"}
            </p>
            <SeloSinal sinal={sinalDoModelo(previsao, item.volume_7d)} />
          </div>
        </div>
  
        {/* Reflexo que atravessa o card no hover, como nos adesivos da landing */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_38%,rgba(255,255,255,0.06)_47%,transparent_56%)] bg-[length:250%_100%] bg-[position:100%_0] transition-[background-position] duration-700 group-hover:bg-[position:0%_0]"
        />
      </Link>
      <ChaveirosDoItem item={item} tamanho="mini" direita="1rem" className="top-10!" />
    </div>
  );
}

/** Lugar de um card enquanto a lista carrega. */
export function CardItemCarregando() {
  return <div className="h-[19.5rem] animate-pulse rounded-2xl border border-borda bg-painel" />;
}
