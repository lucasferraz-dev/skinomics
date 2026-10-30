import { Link, useParams, useSearchParams } from "react-router";

import { ErroApi } from "../api/cliente";
import { type ItemResumo, type PontoHistorico, useHistorico, useItem } from "../api/itens";
import { Carregando, IconeItem, MensagemErro, Painel, Rotulo, Variacao } from "../componentes/Basicos";
import { BotaoAcompanhar } from "../componentes/BotaoAcompanhar";
import { GraficoHistorico } from "../componentes/GraficoHistorico";
import { diasAntes, formatarData, formatarInteiro, formatarPreco } from "../lib/formato";

const PERIODOS = { "7d": 7, "30d": 30, "90d": 90, "1a": 365, tudo: null } as const;
type Periodo = keyof typeof PERIODOS;

export function DetalheItem() {
  const id = Number(useParams().id);
  const { data: item, isPending, error } = useItem(id);

  if (isPending) return <Carregando />;
  if (error) {
    const naoExiste = error instanceof ErroApi && error.status === 404;
    return (
      <MensagemErro
        titulo={naoExiste ? "Item não encontrado." : "Não foi possível carregar o item."}
        detalhe={naoExiste ? "Ele pode ter saído do catálogo." : "Confira se a API está no ar."}
      />
    );
  }
  return <Conteudo item={item} />;
}

function Conteudo({ item }: { item: ItemResumo }) {
  const [parametros, setParametros] = useSearchParams();
  const periodo: Periodo = (parametros.get("periodo") as Periodo | null) ?? "30d";
  const dias = PERIODOS[periodo] ?? null;
  // A janela conta a partir do último preço do item, como a variação da API.
  const inicio = item.data_preco && dias ? diasAntes(item.data_preco, dias) : undefined;
  const historico = useHistorico(item.id, inicio, item.data_preco !== null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/itens" className="font-mono text-xs text-suave hover:text-texto">
        ← Explorar itens
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <IconeItem url={item.icon_url} nome={item.nome} tamanho={56} />
          <div className="min-w-0">
            {/* Quebra em vez de cortar: no celular, o nome cortado escondia qual item era. */}
            <h1 className="text-2xl leading-tight text-balance titulo sm:text-3xl">{item.nome}</h1>
            <Rotulo>TF2 / {item.tipo ?? "Item"}</Rotulo>
          </div>
        </div>
        <BotaoAcompanhar itemId={item.id} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Painel className="p-4 sm:p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-3xl">
                {item.preco_atual !== null ? formatarPreco(item.preco_atual) : "—"}
              </span>
              <Variacao valor={item.variacao_7d} sufixo="7d" />
            </div>
            <div className="flex gap-1" role="group" aria-label="Período do gráfico">
              {(Object.keys(PERIODOS) as Periodo[]).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  aria-pressed={opcao === periodo}
                  onClick={() => setParametros({ periodo: opcao }, { replace: true })}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                    opcao === periodo ? "bg-painel-alto text-texto ring-1 ring-borda" : "text-apagado hover:text-texto"
                  }`}
                >
                  {opcao}
                </button>
              ))}
            </div>
          </div>

          {item.data_preco === null ? (
            <MensagemErro titulo="Este item ainda não tem preços coletados." />
          ) : historico.isPending ? (
            <div className="h-80"><Carregando texto="Carregando histórico…" /></div>
          ) : historico.isError ? (
            <MensagemErro titulo="Não foi possível carregar o histórico." />
          ) : (
            <GraficoHistorico pontos={historico.data} />
          )}
        </Painel>

        <aside className="space-y-4">
          <Painel className="p-5">
            <Rotulo>Cenário / 7 dias</Rotulo>
            <p className="mt-3 text-lg">Previsão em breve</p>
            <p className="mt-2 text-sm text-suave">
              A faixa de preço estimada pelo modelo aparece aqui quando ele entrar em produção.
            </p>
          </Painel>
          {historico.data && historico.data.length > 0 && <ResumoPeriodo pontos={historico.data} />}
        </aside>
      </div>

      <p className="rounded-lg border border-borda bg-painel px-4 py-3 text-xs text-suave">
        Preços em dólar (US$) do Mercado da Comunidade Steam, um ponto por dia. Dias sem negociação repetem o
        último preço.
      </p>
    </div>
  );
}

function ResumoPeriodo({ pontos }: { pontos: PontoHistorico[] }) {
  const precos = pontos.map((ponto) => ponto.preco);
  const primeiro = pontos[0]!;
  const ultimo = pontos.at(-1)!;
  const volumeTotal = pontos.reduce((soma, ponto) => soma + ponto.volume, 0);

  const linhas: [string, React.ReactNode][] = [
    ["Variação", <Variacao valor={ultimo.preco / primeiro.preco - 1} />],
    ["Mínimo", formatarPreco(Math.min(...precos))],
    ["Máximo", formatarPreco(Math.max(...precos))],
    ["Volume médio / dia", formatarInteiro(Math.round(volumeTotal / pontos.length))],
  ];

  return (
    <Painel className="p-5">
      <Rotulo>No período</Rotulo>
      <p className="mt-1 font-mono text-[11px] text-apagado">
        {formatarData(primeiro.data)} – {formatarData(ultimo.data)}
      </p>
      <dl className="mt-4 space-y-2.5 text-sm">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between gap-4">
            <dt className="text-suave">{rotulo}</dt>
            <dd className="font-mono">{valor}</dd>
          </div>
        ))}
      </dl>
    </Painel>
  );
}
