# CLAUDE.md — Skinomics

Contexto do projeto para o Claude. Fontes: plano de gestão "EAP-2" (TE1–TE5, PDF fora do repo),
[docs/architecture.md](docs/architecture.md) e o notebook de ML em [ml/notebooks/previsao_precos.ipynb](ml/notebooks/previsao_precos.ipynb).
Idioma do projeto: **português (pt-BR)** — código, comentários, commits e docs.

## 1. O que é

**Skinomics** — plataforma web de previsão de preços de itens do mercado da Steam, para investidores.
Coleta e guarda o histórico de preços, gera previsões com ML, aponta anomalias e oportunidades de
compra/venda, e oferece painéis, busca com filtros, watchlist, inventário e alertas.

Projeto acadêmico (PUCPR, disciplina do Prof. Evandro Zatti, que é o patrocinador). Modelo de processo:
**incremental, 4 incrementos**. S1 começou em 24/08/2026; 12 semanas de 10 h/integrante.

**Decisões tomadas (28/10/2026):**
- **Só TF2** (appid 440). CS2 foi testado e o modelo foi pior. Filtros de float/desgaste da EAP
  viram filtros de TF2 (tipo de item, qualidade, coleção).
- O Lucas e o Claude implementam **o sistema inteiro** (back-end, dados, ML e front-end).
- Prazo real: Go-Live em 13/11/2026 e o código começou em 28/10, então priorizar o fluxo principal
  (dados → previsão → ranking → telas) antes dos módulos secundários.

**Fora do escopo:** trading/intermediação dentro da plataforma, app mobile nativo (é web responsivo),
outros marketplaces, pagamentos/carteira/custódia, jogos fora da Steam, recomendação formal de investimento.

## 2. Equipe e papéis

| Integrante | Papel | Área |
|---|---|---|
| Riscala Miguel Fadel Neto | Gerente do projeto | Gestão, arquitetura, integração |
| Pedro Senes Velloso Ribeiro | Front-end | React/TypeScript, UX, Figma (fez as 16 telas) |
| Ricardo Lucas Kucek | Engenheiro de ML | Modelos, análise de dados, testes (pytest) |
| Lucas Ferraz dos Santos | Dados + back-end | Coletores, PostgreSQL, FastAPI, Docker, OpenID |

Lucas (o usuário deste repo) é **R ou R/A** em: coletores (16), base histórica (17), autenticação Steam (4),
inventário (11), alertas (13), CI/ambiente (2.3), monitoramento (2.5), ambiente inicial (1.4), e
co-R em construir painel (6.2), busca (7.2), detalhe (8.2), watchlist (12.2), anomalias (15.2), ML (18.2).

## 3. Stack

React + TypeScript · Python + FastAPI · PostgreSQL (séries temporais) · Docker · pandas + scikit-learn ·
pytest · GitHub + Actions (CI/CD) · Steam OpenID · proxies para coleta · nuvem (app, banco, agendador).

## 4. Estrutura do repositório

```
backend/          API FastAPI (uv, ruff, pytest); app/ = código, tests/ = testes unitários;
                  o esquema do banco fica aqui, em migrações Alembic
frontend/         React/TS (vazio ainda)
ml/notebooks/     protótipo do modelo (previsao_precos.ipynb)
ml/data/          CSVs de entrada/saída — fora do git (tf2_historico.csv tem 51 MB)
tests/            testes ponta a ponta (vazio ainda)
docs/             architecture.md
.github/          templates de issue/PR, CONTRIBUTING, CODE_OF_CONDUCT, workflows de CI
docker-compose.yml  PostgreSQL local
```

Branches: `main` (principal, alvo de PR) e `develop` (trabalho).

## 5. Incrementos e marcos

| Marco | Entrega | Data |
|---|---|---|
| M0 | Termo de abertura + plano de incrementos | 04/09/2026 |
| M1 | **Inc. 1 – Fundação de Dados**: coletores, banco histórico, agendamento, autenticação Steam, telas de acompanhamento da base | 25/09/2026 |
| M2 | **Inc. 2 – Consulta e Navegação**: onboarding, painel do mercado, busca/filtros, detalhe do item, itens acompanhados | 23/10/2026 |
| M3 | **Inc. 3 – Inteligência**: base de treino, features, treino/avaliação, previsão, comparação, ranking, movimentos atípicos | 06/11/2026 |
| M4 | **Inc. 4 – Conclusão**: inventário, alertas, conta/preferências (com exportação), documentação | 06/11/2026 |
| M5 | Testes de aceitação, estabilização e **Go-Live** | **13/11/2026** |

Caminho crítico: 1.1→1.3 → 3.x → 16.1 → 17.x → 18.x → 9.1/9.2 → 14.x → 2.6 → Fim.
Quase críticas: 2.2 e 13. Reserva de cronograma: 11 h.

Obs.: `docs/architecture.md` põe a autenticação Steam no Inc. 2; a EAP (fonte oficial) põe no **Inc. 1**.

## 6. Objetivos mensuráveis (critérios de sucesso)

- Histórico de **≥ 1.000 itens**, coleta diária com **≥ 95%** de execuções sem falha (M1).
- Modelo com **MAPE ≤ 15%** no teste, **superando o baseline ingênuo** (M3).
- Identificar oportunidade pelo ranking em **< 2 min** (M3).
- Usabilidade **≥ 4,0/5** com ≥ 5 usuários reais (Go-Live).
- 4 incrementos + Go-Live até 13/11/2026; orçamento ≤ **R$ 31.900** (R$ 24k são horas equivalentes, não desembolso).

## 7. EAP — módulos de produto (nível 1)

Cada módulo segue o ciclo **analisar e projetar → construir → testar e validar**.
Esforço total da linha de base: **480 h** (elementos 20 e 21 já incluídos).

| Cód. | Módulo | Tela | Inc. | Horas | Pontos-chave |
|---|---|---|---|---|---|
| 4 | Autenticação com a Steam | 01 | 1 | 20 | OpenID, sessão/expiração, consentimento, falha do provedor |
| 5 | Onboarding de preferências | 02 | 2 | 16 | jogos, faixa de preço, objetivo (revenda/coleção); vira filtro padrão |
| 6 | Painel do mercado | 03 | 2 | 28 | volume do dia, índice de preços, variação %, destaques do modelo, cache |
| 7 | Busca e filtros | 04 | 2 | 30 | raridade, desgaste, float, faixa de preço; ordenação e paginação |
| 8 | Detalhe do item | 05 | 2 | 32 | histórico real + faixa prevista com IC, janela temporal, ações rápidas |
| 9 | Previsão de preço | 06 | 3 | 36 | horizontes 7–30 dias, intervalo de confiança, fatores explicativos, cache/recálculo |
| 10 | Comparação de itens | 07 | 3 | 20 | 2 a 4 itens; liquidez, volatilidade, retorno previsto; compartilhável |
| 11 | Inventário do usuário | 08 | 4 | 26 | importação Steam, valor total, lucro/perda em aberto, inventário privado/vazio |
| 12 | Itens acompanhados | 09 | 2 | 18 | watchlist, variação desde a inclusão, nota do modelo |
| 13 | Alertas de preço | 10 | 4 | 24 | regra de preço absoluto e de variação prevista, motor periódico, sem duplicidade |
| 14 | Ranking de oportunidades | 11 | 3 | 28 | preço atual < previsto; margem estimada + risco (liquidez/volatilidade) |
| 15 | Movimentos atípicos | 12 | 3 | 26 | anomalia de preço/volume; causa provável (manipulação, update, sazonal); alimenta ranking e alertas |
| 16 | Coletores de dados | 13 | 1 | 34 | catálogo, preço+volume, agendador, log de execução/falha, reprocessamento, proxies, retry |
| 17 | Base histórica | 14 | 1 | 30 | esquema de séries, normalização/dedup, outliers, lacunas, cobertura, backup |
| 18 | Gestão de modelos de ML | 15 | 3 | 40 | split treino/val/teste, baseline, modelo final, versionamento, promoção/reversão, retreino |
| 19 | Conta e preferências | 16 | 4 | 18 | moeda, idioma, canais de notificação, exportar dados, desconectar Steam |

Elementos de gestão: 1 Iniciação, 2 Planejamento da Integração (CI/CD, contratos de API, testes de
regressão/integração, logs, docs), 3 Estimativa de Escopo, 20 Cronograma, 21 Recursos.

Fluxos ponta a ponta a testar: **coleta → base → modelo → tela** e **previsão → oportunidade → alerta**.

## 8. Machine Learning (protótipo atual)

Arquivo: [ml/notebooks/previsao_precos.ipynb](ml/notebooks/previsao_precos.ipynb) — roda a partir de
`ml/notebooks/` (lê e grava em `../data/`). Saída: `ml/data/previsao_7d.csv`.

**Dados — `tf2_historico.csv`:** ~90 mil linhas, **37 itens de TF2** (appid 440; caixas, Key, ferramentas),
2012-12 → 2026-10-15, 61 colunas, preços em USD. Colunas-base usadas: `observation_date`,
`market_hash_name`, `price`, `volume`, `is_filled`, `days_since_first_obs`, `scrape_timestamp_utc`.
O CSV já traz features prontas (lags, MAs, alvos), mas o notebook **recalcula tudo** e não as usa.
⚠️ Muito abaixo da meta de 1.000 itens; é um conjunto piloto.

**Tratamento:**
- Remove o dia da coleta (parcial), duplicatas `(item, data)` e preço ≤ 0.
- Ignora os primeiros 30 dias de cada item (`MIN_HISTORY`) e tudo antes de 2016-01-01.
- **Alvo** = média do preço em `t+5..t+9` (horizonte 7, meia-janela 2), modelado como
  **log-retorno** `log(alvo / preço_atual)` — comparável entre itens de 0,15 e 10,8.
- No treino o alvo é cortado em ±0,7.

**Features (35)**, todas relativas ao preço atual: retornos 1/3/7/14/30 d; distância de MA 3–60,
mediana 7/30, EMA 5/10/30; volatilidade 7/30; min/máx da janela; z-score 30; distância de ATH/ATL;
log-volume, médias e tendência; `is_filled`; **contexto de mercado** (retorno mediano do dia,
retorno da Key, retorno relativo ao mercado).
Removidas **de propósito** (pioravam a validação): mês, dia do ano, dia da semana, idade e nome do
item — o modelo decorava sazonalidade antiga e quebrava na mudança de regime do fim de 2025.

**Modelos:**
- *Ingênuo* — retorno 0 (preço não muda).
- *EMA 10* — "volta para a EMA de 10 dias"; baseline forte (reversão à média).
- *HGB* — `HistGradientBoostingRegressor`, `loss="absolute_error"`, lr 0,03, `max_leaf_nodes=7`,
  `min_samples_leaf=200`, até 600 iterações com early stopping.
- **Final: HGB + EMA** — `0,5 × HGB + 0,5 × EMA10` (classe `EMABlend`).

**Validação:** split temporal (teste = últimos 180 dias, intervalo de 9 dias entre treino e teste) +
**walk-forward com 4 semestres** antes do teste. Ganho médio de MAE sobre o ingênuo no CV: 27,8% (final).

**Resultados no teste (2026-04-09 .. 2026-10-05):**

| Modelo | MAE | MAPE | R² retorno | Direção | Ganho vs ingênuo |
|---|---|---|---|---|---|
| Ingênuo | 0,0939 | 11,07% | — | — | 0% |
| EMA 10 | 0,0828 | 9,31% | 0,33 | 72,0% | 11,9% |
| HGB | 0,0756 | 7,87% | 0,25 | 72,4% | 19,5% |
| **HGB + EMA** | **0,0742** | **8,11%** | **0,36** | **72,8%** | **21,1%** |

→ Atende a meta do TE1 (MAPE ≤ 15% e melhor que o ingênuo). Ganha do ingênuo em 32 de 36 itens.
Pontos fracos: Secret Saxton (MAPE ~91%) e Mann Co. Store Package (~30%); perde do ingênuo na Key,
Description Tag, Bone-Chilling Bonanza e Terrifying Trove Case.

**Cuidados ao interpretar previsões:** retornos previstos altos em itens de baixíssimo volume
geralmente significam "o preço de hoje é um pico e vai voltar", não tendência. Itens com
`historico_curto=True` (ex.: Haunted Hoard Case) não são confiáveis.

**Falta para cumprir a EAP (módulos 9 e 18):** horizontes até 30 dias, intervalo de confiança,
fatores explicativos por previsão (hoje só há importância por permutação global), versionamento e
promoção de modelos, retreino periódico, e mover o código do notebook para `ml/` como serviço de inferência.

## 9. Convenções de trabalho

- Revisão por outro integrante sempre que a mudança afetar contratos de integração, dados,
  segurança ou modelo preditivo.
- Manter um modelo baseline em produção até o definitivo ser validado.
- Coleta da Steam: respeitar rate limit, distribuir requisições ao longo do dia, proxies, retry,
  coletor isolado em módulo próprio e com monitoramento de falhas.
- Split de dados de séries temporais **sempre por data**, nunca aleatório.
