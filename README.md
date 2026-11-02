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

Para publicar as previsões na aplicação, veja o [guia de integração do ML](docs/ml-integracao.md):
treino a partir do PostgreSQL, versões, ativação/reversão, atualização após coleta e API.

O módulo ML **0.3.0** cadastra cada treino com `--database` automaticamente. Os comandos
`python -m ml.registry list`, `show` e `compare` consultam as versões e seus erros/acertos
por faixa de preço, com resultados das baselines e saída opcional `--json`.
Veja os critérios e exemplos no [guia de comparação de versões](docs/ml-integracao.md#consultar-e-comparar-versões--us018-19).

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
de 180 dias. O teste fica nos últimos 180 dias e não participa da seleção. Os 90 dias
anteriores, separados por embargo, calibram um intervalo nominal de 80%. Cada divisão
respeita um intervalo de `horizon + target_half_window` dias para impedir que os alvos
do treino alcancem a calibração, validação ou teste. O artefato preserva o modelo avaliado;
não há retreino sobre a calibração ou o teste, pois isso invalidaria os resíduos usados na faixa.
Na página do item, os horizontes de 7, 15 e 30 dias usam versões independentes. O tracejado
liga o histórico à média futura e a faixa de 80% indica sua incerteza, no visual existente.
Veja [calibração, publicação e limitações](docs/ml-integracao.md).

Configurações podem ser alteradas pela CLI (`--help` lista todas):

```bash
uv run python train.py --horizon 30 --target-half-window 2 --output-dir artifacts/30d
uv run python train.py --data data/outro_historico.csv --test-days 90 --cv-folds 3 --fold-days 90
```

O CSV precisa das colunas `observation_date`, `market_hash_name`, `price`, `volume`,
`is_filled`, `days_since_first_obs` e `scrape_timestamp_utc`. Dias parciais, duplicatas,
preços inválidos e volumes negativos são removidos. As features prontas do CSV são ignoradas.
O histórico deve cobrir treino, folds, calibração e teste; dados insuficientes geram uma mensagem para
ajustar as janelas. Itens recentes continuam nas previsões com `historico_curto=True`.

Cada treino cria uma pasta exclusiva `ml/artifacts/<version_id>/` (fora do git), sem
sobrescrever as versões anteriores e sem servidor de rastreamento:

- `price_model.joblib`: modelo final, ordem das features, configuração e versões das bibliotecas;
- `metadata.json`: metadados e limites temporais da execução;
- `cv_folds.csv` e `cv_summary.csv`: comparação dos modelos na validação;
- `test_metrics.csv` e `metrics_per_item.csv`: erros de preço/retorno e comparação com as baselines;
- `metrics_per_price_range.csv`: métricas por modelo e faixa de preço-base em USD;
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

### Aceleração por GPU (LightGBM)

O argumento `--device` controla o backend dos modelos LightGBM e LightGBM + EMA.
O padrão é `cpu`; HGB, ARIMA, SARIMA e o processamento de dados continuam na CPU.

O projeto fixa o LightGBM em **4.6.0**, cujo pacote oficial para Windows inclui os
backends CPU e GPU/OpenCL. Essa versão foi validada com uma NVIDIA GeForce RTX 5060;
o pacote 4.7.0 anteriormente instalado não incluía suporte a GPU. O mesmo ambiente
permite escolher CPU ou GPU, sem recompilar a biblioteca no Windows.

```bash
# Na raiz do repositório: instalar a versão registrada no lockfile
uv sync --project ml --locked

# CPU continua sendo o padrão, inclusive em máquinas com GPU
uv run --project ml python -m ml.train

# Na raiz do repositório: OpenCL, incluindo Windows
uv run --project ml python -m ml.train --device gpu

# Também funciona no experimento
uv run --project ml python -m ml.train --sarima-experiment --device gpu

# Seleção explícita em máquinas com várias plataformas/dispositivos OpenCL
uv run --project ml python -m ml.train --device gpu --gpu-platform-id 0 --gpu-device-id 0

# Backend CUDA em Linux, com instalação compatível do LightGBM
uv run --project ml python -m ml.train --device cuda --gpu-device-id 0
```

Para `--device gpu`, é necessário um dispositivo OpenCL e o driver correspondente
instalado; CPU não exige GPU nem esses drivers. No Windows, `gpu` é a opção suportada;
o pacote fixado dispensa instalar o CUDA Toolkit para usar OpenCL. `cuda` requer uma
compilação específica em Linux. Consulte as
[instruções da versão 4.6.0](https://github.com/microsoft/LightGBM/blob/v4.6.0/python-package/README.rst#installation)
e o [guia de compilação](https://lightgbm.readthedocs.io/en/stable/Installation-Guide.html#build-gpu-version).
O argumento não instala drivers nem recompila a biblioteca. O script verifica o backend com
um ajuste pequeno antes do CV e interrompe com uma mensagem de diagnóstico se ele falhar,
sem trocar silenciosamente para CPU. Os IDs padrão `-1` deixam a seleção ao LightGBM.

O backend e os IDs são registrados nos metadados. Os parâmetros de determinismo e layout
exclusivos de CPU são mantidos somente em `--device cpu`; resultados em GPU podem apresentar
diferenças numéricas. `--n-jobs` controla threads de CPU do LightGBM, não a quantidade de GPUs.
A configuração de árvores e bins permanece igual, permitindo comparar CPU e GPU com o
mesmo modelo; o ganho de tempo depende do volume de dados e do hardware.

### Experimentos ARIMA/SARIMA

O benchmark opcional compara três configurações estatísticas com os seis modelos do treino
normal. Execute a partir da raiz:

```bash
uv sync --project ml --locked
uv run --project ml python -m ml.train --sarima-experiment
```

A grade usa `statsmodels.SARIMAX`, sem regressores externos:

| Nome | `(p,d,q)` | `(P,D,Q,s)` |
|---|---|---|
| `arima_111` | `(1,1,1)` | sem sazonalidade |
| `sarima_111_100` | `(1,1,1)` | `(1,0,0,7)` |
| `sarima_011_011` | `(0,1,1)` | `(0,1,1,7)` |

O período sazonal padrão é semanal (`--sarima-period 7`), independente do horizonte.
Cada configuração ajusta um modelo por item nos últimos 730 dias do treino, com pelo menos
90 observações válidas e dois ciclos sazonais. `--sarima-history-days`,
`--sarima-min-observations` e `--sarima-maxiter` controlam esses limites.

Por padrão, cinco itens são selecionados em posições igualmente espaçadas no ranking de
volume mediano do **primeiro conjunto de treino do walk-forward**, cobrindo diferentes níveis
de liquidez sem consultar o teste. Use `--experiment-max-items 0` para todos, ou indique os
nomes com `--experiment-items`. Os regressores continuam treinando com todos os itens, para
preservar seu aprendizado compartilhado; todos os modelos são avaliados nas mesmas linhas da
amostra. Seus tempos de treino, portanto, correspondem a essas cargas diferentes.

```bash
uv run --project ml python -m ml.train --sarima-experiment --experiment-items "Mann Co. Supply Crate Key" "Winter 2019 Cosmetic Case"
uv run --project ml python -m ml.train --sarima-experiment --horizon 15
uv run --project ml python -m ml.train --sarima-experiment --horizon 30
```

Os parâmetros são ajustados até o corte de treino de cada fold, respeitando o mesmo intervalo
de embargo. Durante a avaliação, somente o estado do modelo é atualizado com preços já
observados até cada data-base, usando `extend()`; não há novo ajuste dos parâmetros no holdout.
As lacunas do calendário ficam como `NaN`, sem interpolação ou preenchimento com o futuro.
O alvo continua sendo o preço médio de `t+H-W` a `t+H+W`: as previsões em log-preço são
convertidas em preços esperados com `exp(mu + variância/2)` antes de calcular a média da janela.
Esse cálculo assume a distribuição gaussiana em log-preço do modelo. Veja a
[API SARIMAX](https://www.statsmodels.org/stable/generated/statsmodels.tsa.statespace.sarimax.SARIMAX.html)
e o [guia de atualização e previsão](https://www.statsmodels.org/stable/examples/notebooks/generated/statespace_forecasting.html).

Histórico insuficiente, ajuste sem convergência e falhas numéricas usam **EMA 10 como fallback**.
Essas previsões continuam nas métricas; `fallback_pct` mostra quanto do resultado veio da EMA.
A escolha das configurações termina no CV. O relatório do holdout compara todas, mas não altera
o vencedor escolhido. Após a avaliação, os modelos são reajustados para as previsões mais recentes.

As saídas ficam em `ml/artifacts/sarima_experiment/7d/` (ou `15d/`, `30d/`, conforme o horizonte):

- `cv_folds.csv`, `cv_summary.csv`, `test_metrics.csv` e `metrics_per_item.csv`: comparação de
  MAE de log-retorno, MAE/RMSE/MAPE de preço, direção, ganhos contra as baselines e fallback;
- `predictions.csv`: previsões de CV/teste por item e data, incluindo motivo de fallback;
- `diagnostics.csv`: convergência, observações, lacunas, falhas e tempo por ajuste/item;
- `runtime.csv`: tempos e contagens de falhas/fallback por modelo e fase;
- `previsao_7d.csv`: previsões recentes dos nove modelos para os itens selecionados;
- `metadata.json`: amostra, configurações, versões das bibliotecas e escolhas feitas no CV.

`--output-dir` permite preservar execuções em pastas diferentes. Repetir uma execução na mesma
pasta substitui seus relatórios. O experimento não promove um modelo ativo nem substitui
os artefatos das versões de produção; resultados da amostra não representam necessariamente toda a base.

### Front-end

O menu **Oportunidades** abre `/oportunidades`, com ranking por margem bruta prevista,
risco explicável e cenários de 7, 15 e 30 dias. O ranking aceita o histórico disponível para
testes, com aviso de dados antigos e datas reais de cada previsão.
Veja as regras, operação e amostra retrospectiva em [docs/oportunidades.md](docs/oportunidades.md).
Esta entrega atualiza backend, frontend e ferramentas de ML para **0.3.0**.

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
