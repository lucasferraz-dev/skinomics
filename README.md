# Skinomics

Sistema web de análise e previsão de preços
de itens do mercado da Steam utilizando
Machine Learning.

## Objetivo

...

## Equipe

- Riscala Miguel Fadel Neto
- Pedro Senes Velloso Ribeiro
- Ricardo Lucas Kucek
- Lucas Ferraz dos Santos

## Arquitetura

...

## Tecnologias

...

## Roadmap

- [ ] Incremento 1 — Fundação de Dados
- [ ] Incremento 2 — Consulta e Navegação
- [ ] Incremento 3 — Inteligência
- [ ] Incremento 4 — Conclusão

## Como executar

Para só subir a API, basta o [Docker Desktop](https://www.docker.com/products/docker-desktop/):

```bash
docker compose up -d --build   # banco + API em http://localhost:8080 (aplica as migrações ao subir)
```

Para desenvolver no back-end, use também o [uv](https://docs.astral.sh/uv/) e suba só o banco:

```bash
# 1. Banco (PostgreSQL no Docker, exposto na porta 55432)
docker compose up -d db

# 2. Back-end
cd backend
uv sync                   # instala as dependências
uv run alembic upgrade head   # cria/atualiza as tabelas
uv run pytest             # testes (usam o banco skinomics_test, criado sozinho)
uv run uvicorn app.main:app --reload   # API em http://localhost:8000
```

A porta do banco é 55432, e não a padrão 5432, para não colidir com um PostgreSQL instalado
direto na máquina. Para mudar a conexão, copie `.env.example` para `backend/.env` e ajuste
`SKINOMICS_DATABASE_URL`.

Depois de alterar um modelo em `backend/app/models/`, gere a migração com
`uv run alembic revision --autogenerate -m "descrição"` e revise o arquivo gerado antes de commitar.

### Carregar o histórico de preços

O histórico piloto (`tf2_historico.csv`, fora do git) é compartilhado à parte. Coloque-o em
`ml/data/` e importe para o banco:

```bash
cd backend
uv run python -m app.coleta.importar_csv ../ml/data/tf2_historico.csv
```

Pode rodar de novo sem medo: dias que já estão no banco são atualizados, não duplicados.
O dia da coleta (preço ainda parcial) e linhas com preço ou volume inválido são descartados,
e cada importação fica registrada em `execucao_coleta` com o tipo `importacao`.

### Treinar os modelos de previsão

O código de `ml/notebooks/previsao_precos.ipynb` está disponível em `ml/models.py` e
`ml/train.py`. O módulo de ML tem ambiente próprio, gerenciado pelo uv:

```bash
cd ml
uv sync --locked
# Coloque o histórico em ml/data/tf2_historico.csv antes de treinar.
uv run python train.py

# Verificações locais
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Na raiz do repositório, também é possível executar
`uv run --project ml python -m ml.train`. Os caminhos padrão são relativos à pasta `ml/`,
independentemente da pasta de execução. Caminhos fornecidos na linha de comando são relativos
à pasta atual.

O treinamento recalcula as 35 features do notebook e prevê o **log-retorno do preço médio
entre t+5 e t+9**, por padrão. Compara ingênuo (retorno zero), EMA 10, HGB, HGB + EMA,
LightGBM e LightGBM + EMA. Os modelos de boosting usam corte de alvo em ±0,7; as misturas
usam peso 0,5 para a EMA. O LightGBM usa erro absoluto, árvores de 7 folhas e 600 iterações
([parâmetros oficiais](https://lightgbm.readthedocs.io/en/stable/pythonapi/lightgbm.LGBMRegressor.html)).

A escolha automática usa o ganho médio de MAE do log-retorno em quatro janelas temporais
de 180 dias. O teste fica nos últimos 180 dias e não participa da seleção. Cada divisão
respeita um intervalo de `horizon + target_half_window` dias para impedir que os alvos
do treino alcancem a validação ou o teste. Depois da avaliação, o vencedor é retreinado
com todos os dados rotulados para gerar as previsões mais recentes.

Configurações podem ser alteradas pela CLI (`--help` lista todas):

```bash
uv run python train.py --horizon 30 --target-half-window 2 --output-dir artifacts/30d
uv run python train.py --data data/outro_historico.csv --test-days 90 --cv-folds 3 --fold-days 90
```

O CSV precisa das colunas `observation_date`, `market_hash_name`, `price`, `volume`,
`is_filled`, `days_since_first_obs` e `scrape_timestamp_utc`. Dias parciais, duplicatas,
preços inválidos e volumes negativos são removidos. As features prontas do CSV são ignoradas.
O histórico deve cobrir treino, folds e teste; dados insuficientes geram uma mensagem para
ajustar as janelas. Itens recentes continuam nas previsões com `historico_curto=True`.

As saídas ficam em `ml/artifacts/` (fora do git), sem servidor de rastreamento:

- `price_model.joblib`: modelo final, ordem das features, configuração e versões das bibliotecas;
- `metadata.json`: metadados e limites temporais da execução;
- `cv_folds.csv` e `cv_summary.csv`: comparação dos modelos na validação;
- `test_metrics.csv` e `metrics_per_item.csv`: erros de preço/retorno e comparação com as baselines;
- `previsao_7d.csv` (ou o horizonte configurado): previsão mais recente por item.

Para inferência, carregue o artefato a partir da raiz do repositório, usando o ambiente de ML.
`artifact["model"].predict(features[artifact["features"]])` retorna log-retornos;
o preço previsto é `preco_atual * exp(log_retorno)`. O modelo espera features calculadas
por `ml.train.build_features`, a partir do histórico limpo e ordenado por item/data.
Os relatórios de teste avaliam o ajuste anterior ao retreino final; o artefato salvo já
inclui os dados rotulados do teste no retreino.

Para usar o notebook com o mesmo ambiente:

```bash
uv sync --locked --group notebook
uv run --group notebook jupyter lab notebooks/previsao_precos.ipynb
```

### Front-end

Precisa do [Node.js](https://nodejs.org/) 24 e da API no ar (`docker compose up -d`):

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (as chamadas para /api vão para a API na 8080)
```

Quando a API mudar um contrato, regenere os tipos com `npm run api:tipos` (com a API no ar):
o TypeScript passa a apontar no front-end tudo o que precisa acompanhar a mudança.

## Documentação

...
