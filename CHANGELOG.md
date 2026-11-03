# Changelog

## [Não lançado]

### Adicionado

- Coletor do mercado da Steam (`app.coleta.steam`): requisições espaçadas e parada no primeiro
  HTTP 429, sem novas tentativas que estenderiam o bloqueio do IP.
- `app.coleta.historico_steam`: regrava a série diária completa de cada item ativo a partir do
  `pricehistory` (cookie em `SKINOMICS_STEAM_LOGIN_SECURE`), no mesmo formato do CSV: média do
  dia ponderada pelo volume e dias sem venda preenchidos. Confere a moeda da conta (`--moeda`)
  e aceita uma lista de itens (`--itens`), criando no catálogo os que ainda não existem e
  buscando na página de anúncios o ícone dos que estão sem imagem.
- `app.coleta.catalogo_steam`: acrescenta ao catálogo os itens populares de TF2 acima de um
  preço mínimo, pela busca do mercado, sem login.

### Corrigido

- A série histórica estava em BRL (moeda da conta usada na coleta), embora documentada como USD.

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
