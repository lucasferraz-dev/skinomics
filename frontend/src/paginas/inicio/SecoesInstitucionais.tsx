import type { ReactNode } from "react";
import { Link } from "react-router";

import { type ItemResumo, useHistorico, useItens } from "../../api/itens";
import { IconeItem, Rotulo, Variacao } from "../../componentes/Basicos";
import { Sparkline } from "../../componentes/Sparkline";
import { diasAntes, formatarPreco } from "../../lib/formato";
import { useItemVitrine } from "./dados";
import { CabecalhoSecao, Container } from "./ui";

const PASSOS = [
  {
    titulo: "Encontre o item",
    texto: "Busque pelo nome entre os itens que a base acompanha.",
    rodape: "Busca por nome",
  },
  {
    titulo: "Veja histórico e previsão",
    texto: "O gráfico mostra o preço de cada dia e a previsão para 7, 15 ou 30 dias, com a faixa de 80%.",
    rodape: "Um modelo por horizonte",
  },
  {
    titulo: "Acompanhe e compare",
    texto: "Salve itens na sua lista ou veja o ranking de oportunidades, com o risco de cada uma.",
    rodape: "Minha lista e Oportunidades",
  },
];

/** Seção 4 */
export function FluxoSimples() {
  return (
    <section id="como-funciona" className="scroll-mt-16 border-t border-borda py-20 sm:py-28">
      <Container className="space-y-12">
        <CabecalhoSecao
          rotulo="Como funciona"
          titulo="Do item à previsão, em três passos."
          texto="Tudo parte dos preços públicos do Mercado da Comunidade Steam."
        />
        <ol className="grid gap-10 md:grid-cols-3">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="space-y-4">
              <span className="block border-b border-borda pb-3 font-mono text-sm text-destaque">Passo {i + 1}</span>
              <h3 className="text-xl">{passo.titulo}</h3>
              <p className="text-sm text-suave">{passo.texto}</p>
              <Rotulo>{passo.rodape}</Rotulo>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function Cartao({ titulo, texto, children, className = "" }: { titulo: string; texto: string; children: ReactNode; className?: string }) {
  return (
    <div data-poleiro className={`space-y-5 rounded-2xl border border-borda bg-painel p-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-xl">{titulo}</h3>
        <p className="text-sm text-suave">{texto}</p>
      </div>
      {children}
    </div>
  );
}

function Chips({ opcoes, ativa }: { opcoes: { rotulo: string; para?: string }[]; ativa: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map(({ rotulo, para }) => {
        const classe = `rounded-md border px-3 py-1.5 font-mono text-xs ${
          rotulo === ativa ? "border-destaque/25 bg-destaque-fundo text-destaque" : "border-borda text-apagado"
        }`;
        return para ? (
          <Link key={rotulo} to={para} className={`${classe} hover:text-texto`}>
            {rotulo}
          </Link>
        ) : (
          <span key={rotulo} className={classe}>
            {rotulo}
          </span>
        );
      })}
    </div>
  );
}

function LinhaRadar({ item }: { item: ItemResumo }) {
  const inicio = item.data_preco ? diasAntes(item.data_preco, 30) : undefined;
  const { data } = useHistorico(item.id, inicio, item.data_preco !== null);
  return (
    <Link to={`/itens/${item.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-painel-alto">
      <IconeItem url={item.icon_url} nome={item.nome} tamanho={32} />
      <span className="min-w-0 flex-1 truncate text-sm">{item.nome}</span>
      <Sparkline valores={data?.map((ponto) => ponto.preco) ?? []} largura={80} altura={24} />
      <span className="w-24 text-right">
        <span className="block font-mono text-sm">{item.preco_atual != null ? formatarPreco(item.preco_atual) : "—"}</span>
        <span className="text-[11px]">
          <Variacao valor={item.variacao_7d} />
        </span>
      </span>
    </Link>
  );
}

/** Seção 5 */
export function DecidaComContexto() {
  const { item: vitrine } = useItemVitrine(30);
  const { data } = useItens({ ordenar: "volume_7d", direcao: "desc", por_pagina: 2 });
  const detalhe = (parametro: string) => (vitrine ? `/itens/${vitrine.id}?${parametro}` : undefined);

  return (
    <section className="border-t border-borda py-20 sm:py-28">
      <Container className="space-y-12">
        <CabecalhoSecao
          rotulo="Ferramentas"
          titulo={
            <>
              Acompanhe, compare
              <br />e leia a previsão.
            </>
          }
          texto="Para quem coleciona, negocia ou quer saber quanto valem os próprios itens."
        />
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Cartao
            titulo="Minha lista"
            texto="Salve os itens que você acompanha e veja quanto cada um variou desde que entrou na lista."
          >
            <div className="rounded-xl border border-borda bg-fundo/40 p-3">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-sm">Minha lista de acompanhamento</span>
                <span className="rounded bg-painel-alto px-2 py-0.5 font-rotulo text-xs font-semibold text-suave">Exemplo</span>
              </div>
              {data?.itens.map((item) => <LinhaRadar key={item.id} item={item} />)}
            </div>
            <Rotulo>Exige login com a Steam</Rotulo>
          </Cartao>

          <div className="grid gap-4">
            <Cartao
              titulo="Período do gráfico"
              texto="Veja de 7 dias a 1 ano de histórico para separar uma oscilação de uma tendência."
            >
              <Chips
                ativa="30 dias"
                opcoes={[
                  { rotulo: "7 dias", para: detalhe("periodo=7d") },
                  { rotulo: "30 dias", para: detalhe("periodo=30d") },
                  { rotulo: "90 dias", para: detalhe("periodo=90d") },
                  { rotulo: "1 ano", para: detalhe("periodo=1a") },
                ]}
              />
            </Cartao>
            <Cartao
              titulo="Horizonte da previsão"
              texto="Cada horizonte tem um modelo próprio e uma faixa onde o preço deve ficar em 80% dos casos."
            >
              <Chips
                ativa="7 dias"
                opcoes={[
                  { rotulo: "7 dias", para: detalhe("horizonte=7") },
                  { rotulo: "15 dias", para: detalhe("horizonte=15") },
                  { rotulo: "30 dias", para: detalhe("horizonte=30") },
                ]}
              />
            </Cartao>
          </div>
        </div>
      </Container>
    </section>
  );
}

const COMPROMISSOS = [
  {
    titulo: "De onde vêm os dados",
    texto:
      "Do histórico diário do Mercado da Comunidade Steam: preço e volume de cada item, alguns desde 2012. Nada é inventado ou ajustado à mão.",
  },
  {
    titulo: "Quão bom é o modelo",
    texto:
      "No teste com os últimos 180 dias, o modelo de 7 dias errou em média 8,6% e acertou o preço, com tolerância de 15%, em 89,7% das previsões. Cada versão treinada fica registrada com seus números.",
  },
  {
    titulo: "O que não fazemos",
    texto:
      "Não compramos nem vendemos itens, não guardamos dinheiro e não damos recomendação de investimento. Previsão é estimativa; a decisão é sua.",
  },
];

/** Transparência: de onde vêm os números e os limites do produto. */
export function Transparencia() {
  return (
    <section id="transparencia" className="scroll-mt-16 border-t border-borda py-20 sm:py-28">
      <Container className="space-y-12">
        <CabecalhoSecao
          rotulo="Transparência"
          titulo="De onde vêm os números."
          texto="A origem dos dados, a qualidade do modelo e o que a plataforma não faz."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {COMPROMISSOS.map(({ titulo, texto }) => (
            <div key={titulo} data-poleiro className="space-y-3 rounded-2xl border border-borda bg-painel p-6">
              <h3 className="text-lg">{titulo}</h3>
              <p className="text-sm text-suave">{texto}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

const PERGUNTAS = [
  {
    pergunta: "Preciso de uma conta Steam?",
    resposta:
      "Para ver preços, históricos e previsões, não. O login com a Steam libera a Minha lista, onde você salva os itens que acompanha.",
  },
  {
    pergunta: "Com que frequência os preços são atualizados?",
    resposta:
      "A base guarda um preço por dia para cada item. A coleta automática diária está em construção; até lá, cada tela mostra a data do último preço.",
  },
  {
    pergunta: "As previsões são garantidas?",
    resposta:
      "Não. São estimativas com uma faixa de incerteza, e o mercado pode sair do esperado — numa atualização do jogo ou num movimento de manipulação, por exemplo.",
  },
  {
    pergunta: "Quais jogos são cobertos?",
    resposta: "Hoje, itens de Team Fortress 2. Outros jogos da Steam vão entrar.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-borda py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Rotulo destaque>FAQ</Rotulo>
          <h2 data-poleiro="texto" className="text-4xl titulo sm:text-5xl">Perguntas frequentes</h2>
        </div>
        <div className="divide-y divide-borda border-y border-borda">
          {PERGUNTAS.map(({ pergunta, resposta }) => (
            <details key={pergunta} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg">
                {pergunta}
                <span className="font-mono text-destaque transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-suave">{resposta}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
