# CLAUDE.md — Skinomics

Contexto do projeto para assistentes de IA. Fontes: plano de gestão "EAP-2" (TE1–TE5, PDF fora do repo),
[docs/](docs/) e o código. Idioma do projeto: **português (pt-BR)** — código, comentários, commits e docs.

> **Última atualização: 05/11/2026**, feita pelo Lucas e pelo Claude. Este arquivo é a passagem de bastão
> para a próxima IA ou o próximo dev: a §2 diz o que já está pronto e a §3 o que falta. Ao retomar,
> confira no git (`git log origin/main`) e nas issues o que mudou depois desta data.

## 1. O que é

**Skinomics** — plataforma web de previsão de preços de itens do mercado da Steam, para investidores.
Coleta e guarda o histórico de preços, gera previsões com ML, aponta oportunidades de compra/venda e
oferece busca, detalhe do item com previsão, watchlist e ranking.

Projeto acadêmico (PUCPR, disciplina do Prof. Evandro Zatti, que é o patrocinador). Modelo de processo:
**incremental, 4 incrementos**. **Go-Live: 13/11/2026.** O repositório é pessoal do Lucas
(`github.com/lucasferraz-dev/skinomics`).

**Decisões tomadas:**
- **Só TF2** (appid 440). CS2 foi testado e o modelo foi pior. Filtros de float/desgaste da EAP
  viram filtros de TF2 (tipo de item, qualidade, coleção).
- O Lucas e o Claude implementaram quase todo o sistema (back-end, dados, ML e front-end); o Ricardo
  fez boa parte do pacote `ml/` (LightGBM, intervalos, registro de modelos, ranking).
- Escopo das estórias foi **cortado** nas issues do GitHub (cada issue tem "Mantém" e "Fica de fora");
  a issue é a referência do que entregar, não a EAP completa.

**Fora do escopo:** trading/intermediação, app mobile nativo (é web responsivo), outros marketplaces,
pagamentos/carteira/custódia, jogos fora da Steam, recomendação formal de investimento.

## 2. Estado atual (05/11/2026)

**No ar:** front na **Vercel** (`https://skinomics.ferrazdeveloper.com`, root `frontend/`,
`frontend/vercel.json` repassa `/api/*` para a API), API no **Render Free** (Docker, root `backend/`,
`https://skinomics-api.onrender.com`, health `/health` e `/health/ready`), banco **Neon Free** (PostgreSQL).
O Render Free dorme após 15 min sem acesso — a primeira requisição demora. Detalhes, publicação de
modelos e diagnóstico entre ambientes: [docs/deploy.md](docs/deploy.md).

**Pronto (issues fechadas):**

| Issue | Estória | Onde está |
|---|---|---|
| #11 US001 | Login com a Steam (OpenID + sessão por cookie) | `backend/app/auth/`, `api/auth.py`, `paginas/Entrar.tsx` |
| #13 US016 | Log de execuções e falhas de coleta | `app/coleta/execucao.py`, `execucoes.py`; tabelas `execucao_coleta`, `falha_coleta` |
| #15 US004 | Busca pelo nome | `GET /itens?busca=`, `paginas/ExplorarItens.tsx` |
| #17 US006 | Ficha do item com histórico real | `paginas/DetalheItem.tsx`, `GraficoHistorico.tsx` |
| #18 US011 | Watchlist ("Minha lista") com variação desde a inclusão | `api/minha_lista.py`, `paginas/MinhaLista.tsx` |
| #19 US018 / #20 US019 | Registro, comparação, promoção e reversão de versões de modelo | `ml/registry.py`, `ml/publish.py` |
| #21 US007 / #22 US008 | Previsão em 7, 15 e 30 dias com intervalo de 80% | `ml/predict.py`, `ml/intervals.py`, `PrevisaoPreco.tsx` |
| #23 US013 | Ranking de oportunidades (margem + risco) | `api/oportunidades.py`, `servicos/risco_oportunidade.py`, `paginas/Oportunidades.tsx`, [docs/oportunidades.md](docs/oportunidades.md) |
| #25 US020 | Desconectar a conta | fechada pelo Ricardo; **conferir** se a remoção dos dados do usuário existe de fato (no back-end só há logout em `api/auth.py`) |

**Coletor (módulo 16) — pronto, mas roda à mão:**
- `python -m app.coleta.historico_steam --arquivo app/coleta/itens_tf2.txt` regrava a série diária de
  cada item a partir do `pricehistory` da Steam (exige o cookie `SKINOMICS_STEAM_LOGIN_SECURE`).
  Confere a moeda da conta (`--moeda`); a série é em **USD** (já houve bug de gravar em BRL).
- `app/coleta/itens_tf2.txt` é a lista versionada dos itens acompanhados (43 hoje).
- `app.coleta.catalogo_steam` acrescenta itens populares acima de um preço mínimo.
- `app.coleta.execucoes` mostra as últimas execuções, a taxa sem falha (meta de 95%) e itens que falham
  repetidamente. Para ao primeiro HTTP 429 (não insiste, para não estender o bloqueio do IP).

**ML em produção:** pacote [ml/](ml/) (treino, inferência, registro, worker). Treino é **manual**;
`python -m ml.worker` atualiza previsões após coletas e na virada do dia, mas **não está rodando em lugar
nenhum na nuvem** hoje. Passo a passo: [docs/ml-integracao.md](docs/ml-integracao.md).

## 3. O que falta (issues abertas e pendências)

| Issue | Estória | Situação |
|---|---|---|
| **#12 US015** | Agendar a coleta diária | **Não feito.** Não há cron. Proposta: workflow agendado no GitHub Actions (`.github/workflows/`, `on: schedule`) rodando `historico_steam --arquivo ...` contra o Neon, com `SKINOMICS_DATABASE_URL` e o cookie da Steam em *secrets*. O Render Free não tem cron. Depois da coleta, rodar `ml.predict` (ou o worker) no mesmo job para atualizar as previsões. |
| **#14 US017** | Cobertura da base histórica | **Não feito.** O escopo cortado pede só uma **consulta SQL** (itens por quantidade de dias de histórico, itens abaixo do mínimo para treino — o ML usa `MIN_HISTORY = 30`), sem tela. Backup é manual. Dá para fazer como módulo `app.coleta.cobertura` no estilo de `execucoes.py`. |
| **#16 US005** | Filtrar por atributos | **Metade.** A API já aceita `tipo`, `preco_min`, `preco_max`, `ordenar`, `direcao` (`schemas/item.py`, `consultas/itens.py`); **falta a UI** em `ExplorarItens.tsx` (hoje só tem a busca por nome). Líder: Pedro. |
| **#24 US012** | Alerta por preço absoluto | **Não feito.** Escopo: regra "preço abaixo de X", motor periódico sem disparo duplicado, notificação só por e-mail. Precisa de tabela nova (migração Alembic), rotas, tela e o motor (pode ir no mesmo job agendado da #12). Líder: Riscala. A branch local `feat/alertas` está vazia. |

Outras pendências conhecidas:
- **Buraco no histórico** depois de 15/10/2026 (fim do CSV piloto) até a coleta rodar de novo — rodar o
  `historico_steam` resolve, porque o `pricehistory` devolve a série inteira.
- **Meta de ≥ 1.000 itens** está longe (43). Ampliar `itens_tf2.txt` / usar `catalogo_steam`, respeitando
  o rate limit (429).
- Fora do escopo cortado, mas na EAP: onboarding (5), painel do mercado (6), comparação (10),
  inventário (11), movimentos atípicos (15), conta/preferências (19). Não começar antes de fechar as 4 acima.
- Retreino periódico do modelo não existe (é manual).
- Sugestões do professor para o ML, ainda não testadas: features de eventos do TF2 (Scream Fortress,
  Smissmas, promoções da Steam) e janela de treino deslizante / peso maior para dados recentes, avaliadas
  no walk-forward de 4 semestres. Mês como feature já foi testado e piorou.

## 4. Equipe e papéis

| Integrante | Papel | Área |
|---|---|---|
| Riscala Miguel Fadel Neto | Gerente do projeto | Gestão, arquitetura, integração; líder de alertas e desconexão |
| Pedro Senes Velloso Ribeiro | Front-end | React/TypeScript, UX, Figma (fez as 16 telas); líder dos filtros |
| Ricardo Lucas Kucek (`Ricardo-LK`) | Engenheiro de ML | Modelos, análise de dados, testes; fez boa parte de `ml/` |
| Lucas Ferraz dos Santos (`lucasferraz-dev`) | Dados + back-end | Coletores, PostgreSQL, FastAPI, Docker, OpenID, deploy |

## 5. Stack

React + TypeScript + Vite + Tailwind (front) · Python 3 + FastAPI + SQLAlchemy + Alembic (API) ·
PostgreSQL · Docker · pandas + scikit-learn + LightGBM (ML) · uv · ruff · pytest · GitHub Actions (CI) ·
Steam OpenID · Vercel + Render + Neon.

## 6. Estrutura do repositório

```
backend/            API FastAPI (uv, ruff, pytest)
  app/api/          rotas: auth, health, itens, minha_lista, oportunidades
  app/consultas/    consultas SQL usadas pelas rotas
  app/coleta/       coletores da Steam, importação do CSV, log de execuções, itens_tf2.txt
  app/models/       modelos SQLAlchemy  ·  alembic/versions/ = migrações (esquema do banco)
  app/schemas/      Pydantic (contrato da API)  ·  app/servicos/ = regras (risco da oportunidade)
  tests/            testes (usam o banco skinomics_test, criado sozinho)
frontend/           React/TS; src/paginas/, src/componentes/, src/api/ (esquema.d.ts gerado do OpenAPI
                    com `npm run api:tipos`)
ml/                 pacote de ML: train, predict, intervals, registry, publish, worker, sarima, tests/
ml/notebooks/       protótipo original do modelo (previsao_precos.ipynb)
ml/data/            CSVs (fora do git; tf2_historico.csv tem 51 MB e é compartilhado à parte)
ml/artifacts/       modelos treinados (fora do git)
scripts/            check_deployment.py (diagnóstico do deploy)
docs/               architecture.md, deploy.md, ml-integracao.md, oportunidades.md
.github/            templates de issue/PR, CONTRIBUTING, workflows de CI (backend, frontend, ml)
docker-compose.yml  PostgreSQL local (porta 55432) + API (porta 8080)
CHANGELOG.md        mantido a cada PR, na seção [Não lançado]
```

Branches: `main` é a de produção (Vercel publica dela) e o alvo dos PRs; cada assunto em `feat/...`,
`fix/...`, `chore/...` ou `docs/...`. Branches locais antigas já mergeadas podem ser apagadas.

## 7. Como rodar

```bash
docker compose up -d db                        # PostgreSQL em localhost:55432
cd backend && uv sync && uv run alembic upgrade head
uv run pytest                                  # testes
uv run uvicorn app.main:app --reload           # API em localhost:8000
uv run python -m app.coleta.importar_csv ../ml/data/tf2_historico.csv   # carrega o histórico piloto
cd ../frontend && npm install && npm run dev
```

Config em `backend/.env` (copiar de `.env.example`): `SKINOMICS_DATABASE_URL`
(`postgresql+psycopg://...`), `SKINOMICS_SITE_URL`, `SKINOMICS_STEAM_LOGIN_SECURE` (coleta),
`SKINOMICS_MODEL_DIR` (ML). Nunca commitar `.env` nem credenciais; nunca pôr segredo em variável `VITE_*`.
Depois de mudar um modelo em `app/models/`: `uv run alembic revision --autogenerate -m "..."` e revisar.

## 8. Machine Learning

Protótipo em [ml/notebooks/previsao_precos.ipynb](ml/notebooks/previsao_precos.ipynb); o código de produção
está em [ml/](ml/) (o treino foi extraído do notebook e ganhou LightGBM e SARIMA para experimento).

**Dados:** `tf2_historico.csv`, ~90 mil linhas, 37 itens de TF2 (caixas, Key, ferramentas), 2012-12 →
2026-10-15, preços em USD. Tratamento: remove o dia parcial da coleta, duplicatas `(item, data)` e
preço ≤ 0; ignora os 30 primeiros dias de cada item (`MIN_HISTORY`) e tudo antes de 2016-01-01.

**Alvo:** log-retorno da média do preço numa janela em torno de `t + horizonte` (no protótipo, `t+5..t+9`
para 7 dias). Hoje há modelos de **7, 15 e 30 dias**, cada um com intervalo de **80%** calibrado.

**Features (35)**, todas relativas ao preço atual: retornos 1/3/7/14/30 d, distância de médias móveis e
EMAs, volatilidade, min/máx, z-score, distância de ATH/ATL, volume, `is_filled` e contexto de mercado
(retorno mediano do dia, retorno da Key). Removidas **de propósito** porque pioravam a validação: mês,
dia do ano, dia da semana, idade e nome do item (o modelo decorava sazonalidade antiga).

**Resultado do protótipo (teste 2026-04-09..2026-10-05, horizonte 7):** HGB + EMA10 com MAE 0,0742,
MAPE 8,11%, direção 72,8%, ganho de 21,1% sobre o ingênuo → atende a meta (MAPE ≤ 15% e melhor que o
ingênuo). Pontos fracos: Secret Saxton e Mann Co. Store Package; perde do ingênuo na Key e em poucos itens.

**Validação:** split temporal (teste = últimos 180 dias, intervalo entre treino e teste) + walk-forward
de 4 semestres. A escolha do modelo usa o CV; o teste não escolhe vencedor.

**Cuidados:** retorno previsto alto em item de volume baixíssimo geralmente quer dizer "o preço de hoje é
um pico e vai voltar". Itens com histórico curto não são confiáveis.

## 9. Objetivos mensuráveis (critérios de sucesso)

- Histórico de **≥ 1.000 itens**, coleta diária com **≥ 95%** de execuções sem falha.
- Modelo com **MAPE ≤ 15%** no teste, **superando o baseline ingênuo** — atingido.
- Identificar oportunidade pelo ranking em **< 2 min**.
- Usabilidade **≥ 4,0/5** com ≥ 5 usuários reais (Go-Live).

## 10. EAP — módulos de produto (referência)

| Cód. | Módulo | Inc. | Situação |
|---|---|---|---|
| 4 | Autenticação com a Steam | 1 | feito |
| 5 | Onboarding de preferências | 2 | não feito (fora do corte) |
| 6 | Painel do mercado | 2 | parcial (página inicial com dados) |
| 7 | Busca e filtros | 2 | busca feita; filtros só na API (#16) |
| 8 | Detalhe do item | 2 | feito |
| 9 | Previsão de preço | 3 | feito (7/15/30 d + intervalo) |
| 10 | Comparação de itens | 3 | não feito |
| 11 | Inventário do usuário | 4 | não feito |
| 12 | Itens acompanhados | 2 | feito |
| 13 | Alertas de preço | 4 | não feito (#24) |
| 14 | Ranking de oportunidades | 3 | feito |
| 15 | Movimentos atípicos | 3 | não feito |
| 16 | Coletores de dados | 1 | feito, falta agendar (#12) |
| 17 | Base histórica | 1 | esquema e log feitos; falta cobertura (#14) |
| 18 | Gestão de modelos de ML | 3 | feito (registro, promoção, reversão); retreino manual |
| 19 | Conta e preferências | 4 | só desconectar (#25, conferir) |

Fluxos ponta a ponta a testar: **coleta → base → modelo → tela** e **previsão → oportunidade → alerta**.

## 11. Convenções de trabalho

- **Quem commita é o humano.** A IA sugere nome de branch, mensagem de commit (Conventional Commits em
  pt-BR, ex.: `feat: ...`, `fix(ml): ...`) e texto do PR, mas não faz commit, push nem abre PR sozinha.
- **Partes pequenas, um PR por assunto.** Ao fim de cada parte, explicar o que foi feito, como e como rodar.
- Descrição de PR **sempre no template** [.github/pull_request_template.md](.github/pull_request_template.md),
  com o checklist marcado com honestidade. Atualizar o `CHANGELOG.md` no mesmo PR.
- Código legível e modular, sem comentários óbvios; comentário só para explicar o porquê.
- CI roda ruff e pytest (back e ML) e `npm test` + build do front; tudo precisa passar antes do merge.
- Revisão por outro integrante quando a mudança afetar contratos de API, dados, segurança ou modelo.
- Manter um modelo baseline em produção até o definitivo ser validado.
- Coleta da Steam: respeitar rate limit, espaçar requisições, parar no 429, coletor isolado em módulo
  próprio e com log de falhas.
- Split de séries temporais **sempre por data**, nunca aleatório.

**Visual do front:** tema escuro com verde-limão (clima do jogo Deadlock, da Valve), seguindo o Figma do
Pedro. Títulos em **Archivo** larga (utility `titulo`), rótulos em **Cinzel** (`font-rotulo`), números em
**IBM Plex Mono**. **Evitar cara de "site gerado por IA":** nada de rótulo em mono caixa-alta com letras
espaçadas e quadradinho verde, nada de Space Grotesk/JetBrains Mono, nada de landing genérica. Mudança
visual de gosto: mostrar opções lado a lado antes de aplicar.
