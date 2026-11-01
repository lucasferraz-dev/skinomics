# Previsões na aplicação

O treinamento continua manual. A atualização de previsões carrega um modelo já treinado,
calcula as mesmas 35 features com o histórico completo de TF2 (incluindo a Key) e publica
um lote no PostgreSQL. A API consulta esse lote; abrir uma página não dispara treinamento.

## Preparação

Na raiz do projeto, com o banco e a API disponíveis:

```powershell
docker compose up -d --build
uv sync --project ml --locked
```

O container da API aplica as migrações. Se executar o backend fora do Docker, rode
`uv run --directory backend alembic upgrade head` a partir da raiz,
ou entre em `backend/` e execute `uv run alembic upgrade head`.

O ML lê `SKINOMICS_DATABASE_URL` do ambiente. O padrão local é
`postgresql+psycopg://skinomics:skinomics@localhost:55432/skinomics`.
Para usar um arquivo `.env`, passe `--env-file backend/.env` ao `uv run`.
`SKINOMICS_MODEL_DIR` define a pasta de artefatos; o padrão é `ml/artifacts/`.
Esse diretório precisa existir no processo que registra/ativa modelos e no worker.

Importe o histórico se ainda não estiver no banco:

```powershell
uv run --directory backend python -m app.coleta.importar_csv ../ml/data/tf2_historico.csv
```

## Treinar, revisar e publicar

```powershell
# CPU é o padrão; acrescente --device gpu para treinar LightGBM em OpenCL.
uv run --project ml python -m ml.train --database --register
```

Cada treino cria `ml/artifacts/<version_id>/`, com o artefato, metadados, relatórios de
validação/teste, métricas por item e por faixa de preço-base: `[0, 0.5)`, `[0.5, 2)`,
`[2, 10)` e `[10, infinito)` USD. O registro guarda horizonte, janela, métricas,
versões das bibliotecas, período de treino, caminho relativo e SHA-256 do artefato.
A escolha continua baseada no CV temporal; o teste não seleciona o vencedor.

O cadastro não ativa a versão. Revise os relatórios e a comparação com as baselines antes
de publicar. Use o identificador impresso pelo treino:

```powershell
uv run --project ml python -m ml.registry activate <version_id> --reason "Métricas revisadas e aprovadas"
uv run --project ml python -m ml.predict
```

`--horizon 7` é o padrão da inferência. Para outro horizonte, treine e ative uma versão
própria (`ml.train --horizon 30 --database --register`) e execute `ml.predict --horizon 30`.
Nunca se reutiliza um modelo de 7 dias como se ele tivesse sido treinado para 30 dias.
A tela do item exibe inicialmente o horizonte de 7 dias.

Também é possível cadastrar um artefato local existente:

```powershell
uv run --project ml python -m ml.registry register ml/artifacts/<version_id>/price_model.joblib
```

Artefatos anteriores com `model`, `model_name`, `features`, `config` e `refit_end` continuam
aceitos; sem `version_id`, recebem um identificador no cadastro. Para obter as novas métricas
por faixa de preço, execute um novo treino. Use apenas arquivos joblib produzidos e
conhecidos pela equipe: carregá-los executa código Python.

O SHA-256 é conferido antes da ativação e da inferência. Cadastrar o mesmo arquivo novamente
retorna a mesma versão. Outra versão nunca sobrescreve o arquivo já registrado.

## Atualização após a coleta

Execução contínua, consultando o banco a cada 60 segundos:

```powershell
uv run --project ml python -m ml.worker
# Alternativa: um ciclo, para chamar ao final da coleta ou por agendador externo.
uv run --project ml python -m ml.worker --once
```

Ou no Docker, com os artefatos em `ml/artifacts/`:

```powershell
docker compose --profile ml up -d --build
```

O worker verifica todos os horizontes ativos. Uma coleta/importação de preços concluída
com sucesso ou resultado parcial, uma nova versão ativa ou a mudança do dia UTC tornam
o lote pendente. Ele não agenda a coleta Steam: consome o registro `execucao_coleta`
gravado pelos coletores/importador existentes. Se preços forem alterados fora desse fluxo,
rode `ml.predict` manualmente para forçar uma atualização.

Os preços do dia atual e registros coletados antes de o dia fechar são excluídos. Dados de
itens inativos ainda contribuem para o contexto histórico do mercado; só itens ativos
recebem novas previsões. Um item cujo histórico termina antes da última data de alvo vista
no treinamento não recebe uma nova previsão retroativa.

O lote inteiro é confirmado numa transação. Repetir a execução atualiza a chave
`(item_id, modelo_id, data_base)`. Um lock por horizonte impede dois workers simultâneos.
Falhas ficam em `execucao_previsao`; o lote anterior permanece disponível e o próximo ciclo
tenta novamente. Uma execução interrompida é marcada como falha ao retomar o horizonte.

## Promoção e reversão

Uma versão fica ativa por horizonte. Toda troca registra a versão anterior, motivo e data.
A API publica somente resultados da versão ativa, mesmo que existam resultados antigos
de outras versões. Entre a ativação e a primeira inferência, retorna `aguardando_previsao`.

```powershell
uv run --project ml python -m ml.registry rollback --horizon 7 --reason "Reversão após avaliação"
uv run --project ml python -m ml.predict
```

A reversão recupera a versão da última troca e preserva todo o histórico. Os comandos
administrativos são locais; não há endpoint público para carregar ou ativar modelos.

## Contrato da API e interface

`GET /itens/{item_id}/previsao?horizonte=7` aceita horizontes de 7 a 30 dias.

- Item inexistente: HTTP 404; horizonte fora do intervalo: HTTP 422.
- Sem modelo ativo ou lote para o item: HTTP 200, `disponivel=false`, motivo explícito.
- Com previsão: preço-base e estimado em USD, variação como fração (`0.1 = 10%`), datas,
  janela do alvo, versão/nome do modelo, data de geração e flags de histórico curto/atraso.
- `desatualizada=true` quando a data-base é anterior a ontem em UTC ou ao último preço
  diário completo disponível do item. A data exibida sempre é a data real da previsão.

O alvo padrão é a **média dos preços entre t+5 e t+9**, não o preço exato de t+7.
O cartão mostra essa janela e a variação contra o preço-base. Não apresenta intervalo de
previsão, pois sua calibração ainda pertence à issue #22.

## CSV e verificação

O CSV continua disponível para treino e inferência independente do banco:

```powershell
uv run --project ml python -m ml.train --data ml/data/tf2_historico.csv
uv run --project ml python -m ml.predict --data ml/data/tf2_historico.csv --artifact ml/artifacts/<version_id>/price_model.joblib --output ml/artifacts/previsao.csv
```

Testes de integração criam exclusivamente o banco `<SKINOMICS_DATABASE_URL.database>_test`
e recriam suas tabelas pelas migrações. O banco deve permitir criar esse banco de testes.

```powershell
uv sync --project ml --locked --group integration
uv run --project ml --group integration pytest -c ml/pyproject.toml tests/integration
uv run --project ml pytest ml/tests
```

Eles cobrem importação, igualdade das features para preços com a mesma precisão, treino,
cadastro, inferência sem retreino, API, promoção/reversão, repetição, concorrência e falhas
com preservação das previsões anteriores. O CI executa o fluxo com PostgreSQL 17.
