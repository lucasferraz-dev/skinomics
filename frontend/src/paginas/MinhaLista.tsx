import type { ReactNode } from "react";
import { Link } from "react-router";

import { useUsuario } from "../api/auth";
import { type ItemAcompanhado, useAlternarAcompanhamento, useMinhaLista } from "../api/minhaLista";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { formatarInstante, formatarPreco } from "../lib/formato";

export function MinhaLista() {
  const { data: usuario, isPending } = useUsuario();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Rotulo destaque>Acompanhamento / Team Fortress 2</Rotulo>
          <h1 className="text-3xl titulo sm:text-4xl">Minha lista</h1>
        </div>
        <p className="max-w-sm text-sm text-suave">
          Os itens que você está de olho, com quanto cada um mudou desde que entrou na lista.
        </p>
      </header>

      {isPending ? <Carregando /> : usuario ? <Tabela /> : <ConviteParaEntrar />}
    </div>
  );
}

function Tabela() {
  const { data: itens, isPending, isError } = useMinhaLista();

  if (isPending) return <Painel><Carregando texto="Carregando sua lista…" /></Painel>;
  if (isError) return <Painel><MensagemErro titulo="Não foi possível carregar sua lista." /></Painel>;
  if (itens.length === 0) {
    return (
      <Vazio
        titulo="Sua lista está vazia."
        texto={'Abra um item e use "Acompanhar" para ver aqui como o preço dele anda desde então.'}
        acao={<Link to="/itens" className="text-sm text-destaque hover:underline">Explorar itens →</Link>}
      />
    );
  }

  return (
    <Painel>
      <div className="border-b border-borda p-3 font-mono text-xs text-suave sm:p-4">
        {itens.length} {itens.length === 1 ? "item" : "itens"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="whitespace-nowrap">
            <tr className="border-b border-borda">
              {["Item", "Preço", "Desde a inclusão", "Var. 7d", "Na lista desde", ""].map((titulo, i) => (
                <th key={titulo} className={`px-4 py-3 ${i > 0 && i < 4 ? "text-right" : ""}`}>
                  {titulo && <Rotulo>{titulo}</Rotulo>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <Linha key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}

function Linha({ item }: { item: ItemAcompanhado }) {
  const alternar = useAlternarAcompanhamento();

  return (
    <tr className="relative border-b border-borda/60 transition-colors last:border-0 hover:bg-painel-alto">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <IconeItem url={item.icon_url} nome={item.nome} />
          <div className="min-w-0">
            <Link to={`/itens/${item.id}`} className="block truncate text-sm after:absolute after:inset-0">
              {item.nome}
            </Link>
            <span className="text-xs text-apagado">{item.tipo ?? "Team Fortress 2"}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">
        {item.preco_atual !== null ? formatarPreco(item.preco_atual) : <span className="text-apagado">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <Variacao valor={item.variacao_desde_inclusao} />
        {item.preco_inclusao !== null && (
          <span className="block font-mono text-[11px] text-apagado">de {formatarPreco(item.preco_inclusao)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <Variacao valor={item.variacao_7d} />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-suave">{formatarInstante(item.incluido_em)}</td>
      <td className="pr-4 text-right">
        {/* relative z-10: fica acima do link que cobre a linha inteira. */}
        <button
          type="button"
          onClick={() => alternar.mutate({ itemId: item.id, acompanhar: false })}
          disabled={alternar.isPending}
          className="relative z-10 rounded-md px-2 py-1 text-xs text-apagado transition-colors hover:bg-fundo hover:text-queda disabled:opacity-50"
        >
          Remover
        </button>
      </td>
    </tr>
  );
}

function ConviteParaEntrar() {
  return (
    <Vazio
      titulo="Entre para montar sua lista."
      texto="A lista fica guardada na sua conta Steam: você vê os mesmos itens em qualquer aparelho."
      acao={
        <Link
          to="/entrar"
          className="inline-flex rounded-lg bg-destaque px-4 py-2.5 text-sm font-medium text-fundo transition-opacity hover:opacity-90"
        >
          Entrar com a Steam
        </Link>
      }
    />
  );
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao: ReactNode }) {
  return (
    <Painel className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-apagado)" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
      <p className="text-texto">{titulo}</p>
      <p className="max-w-sm text-sm text-suave">{texto}</p>
      <div className="mt-2">{acao}</div>
    </Painel>
  );
}
