# Changelog

## [Não lançado]

### Adicionado

- Alertas de preço (US012, #24): "cair até" (para comprar) ou "subir até" (para vender) um
  preço-alvo, criados no detalhe do item (botão ao lado de Acompanhar, com atalhos de -5%, -10%,
  -20% e a faixa da previsão) ou na aba Alertas, que lista os disparados e os que estão vigiando,
  com a barra de quanto falta, pausar, retomar, trocar o alvo e apagar. A checagem roda depois de
  cada coleta diária (`app.servicos.alertas`) e cada alerta dispara uma vez só; o alvo que o preço
  de hoje já atingiu é recusado. O aviso fica só no site: o sino do header fica verde com o número
  de alertas disparados, como o da Steam, sem e-mail. API: `GET/POST /alertas`,
  `PATCH/DELETE /alertas/{id}`, `GET /alertas/avisos` e `POST /alertas/avisos/vistos`; tabela
  `alerta` (migração `5b3e0c7d9a41`). Muninn e Glaux comentam os alertas na aba.
- Coleta diária agendada no Windows (#12): `scripts/coleta_diaria.ps1` baixa só os itens
  pendentes, publica as previsões (`ml.worker --once`), grava log por dia e avisa por notificação
  quando o cookie da Steam vence ou algo falha; `scripts/agendar_coleta.ps1` registra a tarefa
  (3 min após o logon e às 3h, acordando o PC da suspensão).
- `historico_steam --pendentes`: só os itens cuja série ainda não chega a ontem, o que retoma uma
  coleta interrompida e não pede nada à Steam se o dia já foi coletado. `--variacao` sorteia até
  N segundos a mais entre os pedidos. Códigos de saída: 10 (429, tentar depois) e 11 (cookie
  vencido ou conta em outra moeda).
- Explorar itens no visual da landing (US005, #16): filtros por categoria (a mesma dos chaveiros),
  faixa de preço (`preco_min`/`preco_max` da API) e atalhos de ordenação, em chips; visão em grade
  (cards no estilo dos terminais) ou lista; destaques da semana no topo e medalhas nos itens em
  destaque. Chaveiros nos terminais, nos cards (mini, dentro da vitrine) e nas linhas da lista. Os
  filtros ficam na URL.
- Detalhe do item com hero de vitrine (imagem, brilho, medalha e chaveiros), selos de evento e
  qualidade, adesivos com preço, variação, previsão de 7 dias e vendas, link para o Mercado da Steam
  e a seção "Itens parecidos" (mesma categoria).
- Muninn e Glaux de plantão no canto da tela no Explorar e no detalhe do item (`MascotesFixos`),
  empoleirados num card "De plantão" no formato dos terminais, sem voar pela página, comentando os dados dela (`componentes/mascote/analise.ts`): no item, a Glaux lê
  a previsão com a faixa de confiança, o volume e o risco, e o Muninn as medalhas, a variação e o
  histórico; no Explorar, o resultado dos filtros. "Como usar" das duas páginas, apresentado pelos
  dois e aberto só quando pedido (na landing continua abrindo sozinho na primeira visita).

- Leitura do modelo no estilo touro e urso (`lib/sinal.ts`, `componentes/SinalModelo.tsx`): cinco
  níveis tirados da previsão e da faixa de 80% (alta forte quando até o pior caso fica acima do preço
  de hoje), sem leitura com pouco volume, faixa larga demais ou item no piso de US$ 0,03 (no teste,
  99,6% das "altas fortes" eram itens no piso, que não caem mas também não pagam a taxa da Steam).
  O medidor lembra que a alta precisa passar de uns 15% para cobrir a taxa. Medidor no detalhe do item, selo nos
  cards do Explorar, falas do Muninn e da Glaux sobre a leitura e passo no "Como usar". É uma leitura
  do modelo, não recomendação de investimento.

- Vercel Web Analytics no front (`@vercel/analytics`): visitas e páginas vistas, sem cookies, no
  painel do projeto na Vercel. O `vercel.json` deixa os caminhos `/_vercel/*` fora da regra que
  manda tudo para o `index.html`.

### Alterado

- Aba Alertas no visual do resto do site: "Novo alerta" em dois terminais (busca à esquerda, o item
  escolhido numa vitrine com o formulário à direita), os alertas vigiando em cards de terminal com
  a pista até o alvo e os disparados com o item na vitrine e a medalha do movimento. O balão
  "Criar alerta" do item ganhou a faixa de título dos terminais.
- Chaveiros nas abas Alertas e Oportunidades, como no Explorar e no item: os grandes pendem do item
  escolhido em "Novo alerta" e das vitrines do pódio; os mini ficam nos cards dos alertas e nas
  linhas do ranking. A API de oportunidades passou a mandar o `appid` do item, para o chaveiro do
  jogo sair certo quando o site tiver mais de um jogo.
- Oportunidades no visual do resto do site: cabeçalho e seletor de cenário como no Explorar,
  adesivos com os números do cenário, pódio com as três maiores margens em vitrines (o primeiro
  lugar leva a medalha "Maior margem"), o resto do ranking no estilo da lista do Explorar, selo de
  risco com medidor de três barras e os motivos ao clicar, e "Como ler o ranking" em cartões. Cada
  vitrine mostra a margem depois da taxa da Steam. Muninn e Glaux de plantão comentam o ranking
  (`analiseDasOportunidades`), e o modo TV passa pelo pódio, pelo ranking e pela explicação.
- O Terminal usa o mesmo header da landing (`componentes/Cabecalho.tsx`): alto, translúcido e fixo,
  com os mesmos botões.
- Modo TV em todas as páginas, não só na landing: no Explorar passa pelos destaques e pela lista;
  no detalhe do item, pelo item, pelos números, pelo gráfico com a previsão e pelos itens parecidos.
  Página sem seções marcadas é descida inteira, e trocar de página desliga o modo TV.
- Detalhe do item: o gráfico cresce até a altura da coluna da leitura do modelo, sem o vão que
  ficava embaixo dele, e o resumo "No período" virou uma faixa no rodapé do gráfico.
- Tutorial: ao rolar até uma parte, deixa espaço em cima para os mascotes e os balões deles (antes
  ficavam fora da tela em partes altas) e não erra a conta quando o header rolou para fora; o balão
  de explicação não cobre os mascotes de plantão.
- O balão de fala dos mascotes da landing passa para baixo deles quando ficaria atrás do header.
- `SKINOMICS_API_PROXY` no `frontend/.env.local` permite rodar o front sem Docker, apontando o
  proxy do Vite para a API publicada (`changeOrigin` ligado).
- Coletor do mercado da Steam (`app.coleta.steam`): requisições espaçadas e parada no primeiro
  HTTP 429, sem novas tentativas que estenderiam o bloqueio do IP.
- `app.coleta.historico_steam`: regrava a série diária completa de cada item ativo a partir do
  `pricehistory` (cookie em `SKINOMICS_STEAM_LOGIN_SECURE`), no mesmo formato do CSV: média do
  dia ponderada pelo volume e dias sem venda preenchidos. Confere a moeda da conta (`--moeda`)
  e aceita uma lista de itens (`--itens`), criando no catálogo os que ainda não existem e
  buscando na página de anúncios o ícone dos que estão sem imagem.
- `app.coleta.catalogo_steam`: acrescenta ao catálogo os itens populares de TF2 acima de um
  preço mínimo, pela busca do mercado, sem login.
- Lista versionada dos itens acompanhados (`app/coleta/itens_tf2.txt`) e opção `--arquivo` no
  `historico_steam`, que coleta a lista inteira sem passar pela busca do mercado.
- Log da coleta mais completo (US016): cada execução guarda quantos itens entraram no catálogo
  (`itens_novos`) e, na tabela `falha_coleta`, quais itens falharam e por quê.
- `app.coleta.execucoes`: mostra as últimas execuções, a taxa de coletas sem falha no período
  (meta de 95% do M1) e os itens que falham em mais de uma execução; `--execucao ID` lista as
  falhas de uma execução.
- `scripts/migrar_precos.py`: copia o catálogo e a série de preços do banco local para outro
  banco (ex.: o Neon de produção), preservando os IDs dos itens do destino; prévia por padrão.

### Corrigido

- A série histórica estava em BRL (moeda da conta usada na coleta), embora documentada como USD.
- `finalizada_em` das execuções de coleta guardava a hora do início da transação (`now()`), e
  toda execução aparecia com duração zero; agora é a hora real do fim.
- Coleta interrompida no meio (HTTP 429 no catálogo) ficava como sucesso; agora fica parcial.
- Coleta diária (`scripts/coleta_diaria.ps1`): a janela ficava preta até o fim, porque a saída do
  Python só ia para o log quando ele terminava. Agora cada item aparece na janela e no log na hora,
  com título e aviso para não fechar; o fim ganha uma linha "resultado:" em português simples; as
  notificações trazem o motivo da falha e avisam também quando deu certo; e o Windows não suspende
  no meio da coleta.

## [0.3.1] - 2026-11-02

### Corrigido

- Publicação dos modelos de 7, 15 e 30 dias com prévia, validação de intervalos de 80%,
  preparação dos lotes e promoção atômica; versões anteriores preservadas em caso de falha.
- Inferência pode preparar uma versão específica sem ativá-la (`--model-version`).
- Respostas da API e do proxy Vercel usam `no-store`; configurações de build explícitas.
- API informa sua versão no OpenAPI, oferece `/health/ready` para verificar o banco e
  respeita a variável `PORT` no container.
- Diagnóstico público compara proxy, modelos, datas, intervalos e rankings entre ambientes.
- Guia de deploy Vercel/Render esclarece publicação de dados e artefatos, cookies e workers.
- Teste de importação compara timestamps em UTC independentemente do fuso do PostgreSQL.
- Lint de ML usa os mesmos grupos de imports na raiz e em `ml/`; CI verifica sem alterar arquivos.

## [0.3.0] - 2026-11-01

### Adicionado

- US013 (#23): ranking de oportunidades por margem bruta positiva, com API paginada e
  página no menu do site para os horizontes de 7, 15 e 30 dias.
- Indicador de risco com motivos, baseado em liquidez, volatilidade e intervalo da previsão.
- Validação retrospectiva em amostra, com relatório local, testes de causalidade e integração.
- Estados explícitos para falta de modelo, previsões incompatíveis ou ausência de margem positiva.
- Menu Área de análise compartilhado em todas as páginas, incluindo início e login,
  com acesso a Oportunidades e retorno ao catálogo pela opção Visão geral; menu hambúrguer na landing page.
- US018 (#19): consulta de versões com `ml.registry list`, `show` e `compare`, em tabela ou JSON.
- Acerto de preço com tolerância explícita de 15% e contagem de observações nas métricas
  agregadas e por faixa, junto aos resultados dos candidatos e baselines.
- Identificação do conjunto de teste e avisos para comparações entre avaliações distintas.
- Testes de integração do cadastro automático, consulta e preservação das versões.

### Alterado

- Backend, frontend e ferramentas ML atualizados para 0.3.0; contrato OpenAPI regenerado.
- Proxy de desenvolvimento do frontend aceita `SKINOMICS_API_PROXY`, preservando a porta padrão.
- Ranking aceita dados históricos para testes, com aviso, data-base e janela originais;
  o risco usa o histórico anterior à data-base de cada previsão.
- Treinos com `--database` passam a cadastrar a versão automaticamente, sem ativá-la;
  `--no-register` permite executar experimentos locais. CSV mantém cadastro opcional.
- Falha no cadastro após o treino informa como registrar o artefato salvo sem retreinar.

## [0.2.0] - 2026-11-01

### Adicionado

- US007 (#21): seleção dos horizontes de 7, 15 e 30 dias, compartilhada pelo cartão e
  gráfico, com URL persistente e versões de modelo independentes.
- US008 (#22): intervalo nominal de 80%, calibração temporal separada, avaliação de
  cobertura e aviso “Incerteza elevada”. A faixa aparece no gráfico existente.
- Exibição simplificada da taxa de confiança nominal no cartão, com data-base, data-alvo
  e janela da média futura identificadas. Cobertura de teste permanece nos relatórios e API.
- Migração aditiva, contrato OpenAPI, testes de ML, API, gráfico e integração por horizonte.

### Alterado

- O treino mantém o modelo avaliado, sem retreino sobre calibração/teste.
- Modelos antigos mantêm previsão pontual e informam intervalo indisponível.
- A API aceita exatamente 7, 15 e 30 dias. A preparação operacional está em
  [docs/ml-integracao.md](docs/ml-integracao.md).
