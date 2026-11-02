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
uv run --project ml python -m ml.train --database
```

Cada treino cria `ml/artifacts/<version_id>/`, com o artefato, metadados, relatórios de
validação/teste, métricas por item e por faixa de preço-base: `[0, 0.5)`, `[0.5, 2)`,
`[2, 10)` e `[10, infinito)` USD. O registro guarda horizonte, janela, métricas,
versões das bibliotecas, período de treino, caminho relativo e SHA-256 do artefato.
A escolha continua baseada no CV temporal; o teste não seleciona o vencedor.

O treino com `--database` cadastra automaticamente a versão em `modelo_versao`, sem ativá-la.
Use `--no-register` para um experimento local. O treino por CSV só acessa o registro com
`--register`. Se o cadastro falhar após o treino, o artefato permanece salvo e a mensagem
indica o comando para tentar apenas o cadastro novamente, sem repetir o treinamento.

O cadastro não ativa a versão. Revise os relatórios e a comparação com as baselines antes
de publicar. Use o identificador impresso pelo treino:

```powershell
uv run --project ml python -m ml.registry activate <version_id> --reason "Métricas revisadas e aprovadas"
uv run --project ml python -m ml.predict
```

`--horizon 7` é o padrão da inferência. Para outro horizonte, treine e ative uma versão
própria (`ml.train --horizon 30 --database --register`) e execute `ml.predict --horizon 30`.
Nunca se reutiliza um modelo de 7 dias como se ele tivesse sido treinado para 30 dias.
A tela do item permite selecionar **7, 15 ou 30 dias**. A seleção fica na URL (`horizonte=15`),
independente do período histórico (`periodo=90d`), e atualiza cartão e gráfico juntos.
Treine cada horizonte separadamente; CPU continua sendo o padrão:

```powershell
foreach ($horizonte in 7, 15, 30) {
    uv run --project ml python -m ml.train --database --register --horizon $horizonte
}
```

Revise cada versão, ative seu UUID e execute `ml.predict --horizon <horizonte>`.
Sem versão ativa, a tela informa que aquele horizonte está indisponível; não reutiliza outra previsão.

Também é possível cadastrar um artefato local existente:

```powershell
uv run --project ml python -m ml.registry register ml/artifacts/<version_id>/price_model.joblib
```

Artefatos anteriores com `model`, `model_name`, `features`, `config` e `refit_end` continuam
aceitos; sem `version_id`, recebem um identificador no cadastro. Para obter as novas métricas
por faixa de preço e intervalos de 80%, execute um novo treino. Os artefatos antigos mantêm
limites nulos; a tela informa que o intervalo está indisponível. Use apenas arquivos joblib produzidos e
conhecidos pela equipe: carregá-los executa código Python.

O SHA-256 é conferido antes da ativação e da inferência. Cadastrar o mesmo arquivo novamente
retorna a mesma versão. Outra versão nunca sobrescreve o arquivo já registrado.

## Consultar e comparar versões — US018 (#19)

As versões e suas métricas ficam na tabela `modelo_versao`, no campo `metadados`.
Os comandos abaixo consultam somente o banco; não precisam abrir os artefatos nem iniciar
uma tela de gestão. Execute na raiz do repositório:

```powershell
# Versões mais recentes de um mesmo horizonte (padrão: até 20).
uv run --project ml python -m ml.registry list --horizon 7 --limit 20

# Métricas de teste de todos os candidatos/baselines e faixas do modelo selecionado.
uv run --project ml python -m ml.registry show <version_id>

# Comparação de duas ou mais versões, com verificação do conjunto de avaliação.
uv run --project ml python -m ml.registry compare <version_id_1> <version_id_2>

# Saída estruturada para análise por outro script.
uv run --project ml python -m ml.registry show <version_id> --json
```

`--json` também funciona em `list` e `compare`. Cada execução de treino normal registra
uma versão do modelo selecionado, seu identificador, configuração e resultados dos seis
candidatos: ingênuo, EMA 10, HGB, HGB + EMA, LightGBM e LightGBM + EMA. Os dois primeiros
são as baselines. Os erros e acertos são calculados nas mesmas observações do teste temporal,
reservado antes da seleção, tanto no agregado quanto em cada faixa de preço-base.

| Métrica | Interpretação |
|---|---|
| `MAE` | Erro absoluto médio do preço-alvo, em USD; menor é melhor. |
| `MAPE_%` | Erro percentual absoluto médio; menor é melhor. |
| `acerto_preco_%` | Percentual de previsões com erro relativo de preço **até 15%**, inclusive; maior é melhor. |
| `acerto_direcao_%` | Percentual de acertos de alta/queda entre os alvos com variação real. Sem direção prevista, fica indisponível. |
| `n` | Quantidade de observações avaliadas no total ou na faixa. |

A tolerância de 15% é o critério explícito deste relatório: `abs(previsto - real) / real <= 0.15`.
Ela é armazenada nos metadados, não representa probabilidade de acerto de uma previsão futura
e não equivale a `100 - MAPE`. O preço real avaliado é a média da janela do alvo; as faixas
usam o **preço-base** em USD. Faixas sem observações não têm métricas; `N/D`/`null` significa
ausência de informação, nunca erro zero. Cada treino também mantém os relatórios completos
em CSV, incluindo os resultados por faixa de todos os candidatos.

O comparador confere horizonte, janela/definição do alvo, datas, tolerância e critério das
faixas. Uma impressão SHA-256 dos itens, datas, preços-base e preços-alvo identifica o
conjunto de teste; datas iguais com amostras diferentes não bastam para uma comparação direta.
Quando houver divergência ou metadados antigos sem essa identificação, o comando mostra
uma ressalva e `comparable=false` no JSON, sem declarar uma versão superior.

Versões antigas continuam consultáveis: o acerto de preço não registrado aparece como `N/D`.
É necessário um novo treino para obter essa métrica e a identificação do conjunto de teste.
O experimento ARIMA/SARIMA permanece separado das versões de produção. Nenhuma consulta ou
comparação altera o modelo ativo.

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

`GET /itens/{item_id}/previsao?horizonte=7` aceita exatamente **7, 15 e 30 dias**.

- Item inexistente: HTTP 404; horizonte diferente dos três suportados: HTTP 422.
- Sem modelo ativo ou lote para o item: HTTP 200, `disponivel=false`, motivo explícito.
- Com previsão: preço-base e estimado em USD, variação como fração (`0.1 = 10%`), datas,
  janela do alvo, versão/nome do modelo, data de geração e flags de histórico curto/atraso.
- `intervalo_inferior`, `intervalo_superior` em USD, `nivel_confianca=0.8` e
  `incerteza_elevada`. Sem calibração, os três primeiros campos são nulos.
- `cobertura_teste`: fração de alvos contidos na faixa no teste temporal; disponível
  na API e nos relatórios, pode diferir de 80%. Nulo para versões
  sem essa avaliação. É uma medida conjunta do modelo por horizonte, não uma
  probabilidade de acerto para a previsão individual do item.
- `desatualizada=true` quando a data-base é anterior a ontem em UTC ou ao último preço
  diário completo disponível do item. A data exibida sempre é a data real da previsão.

O alvo padrão é a **média dos preços entre t+5 e t+9**, não o preço exato de t+7.
Para 15 e 30 dias, a janela padrão é t+13..t+17 e t+28..t+32, respectivamente.
O cartão mostra janela, variação, taxa de confiança nominal e aviso de incerteza. No gráfico, a linha histórica
continua sólida, a ligação futura é tracejada e a faixa sombreada ocupa os limites de preço
na janela do alvo. Ela representa a incerteza da **média**, não uma trajetória diária.
O cartão exibe apenas a taxa “Confiança nominal”, retornada pela API, logo abaixo do preço
estimado, sem bloco duplicado sob o gráfico, cobertura de teste ou explicações adicionais.
A seção informa carregamento ou indisponibilidade quando necessário, sem inventar uma taxa
para versões sem calibração. O intervalo permanece representado pela faixa no gráfico.
O cartão identifica a data-base e a data-alvo (`data_base + horizonte`)
separadamente da janela da média futura. Os dias são contados da data-base, não de hoje.
Não há opção de ocultar a faixa. Cores, fontes, painéis e controles seguem o site existente.

## Intervalo nominal de 80% (US008)

O treino separa, em ordem temporal, treino/CV, calibração (90 dias por padrão,
`--calibration-days`) e teste (180 dias). Há embargo de `horizon + target_half_window`
entre as etapas. A seleção do modelo usa somente o CV do treino. A calibração usa os
resíduos absolutos de log-retorno, **sem cortar os alvos**, do mesmo modelo salvo.
Com n resíduos, usa a estatística de ordem `ceil((n+1) * 0.8)` como raio q.
Os limites são `preco_previsto * exp(-q)` e `preco_previsto * exp(q)`.
Exige ao menos 30 resíduos finitos; erros impedem publicação, sem fabricar uma faixa.

Essa é a correção de amostra finita de
[split conformal](https://www.stat.cmu.edu/~ryantibs/papers/conformal-jasa.pdf).
A garantia teórica depende de permutabilidade; preços têm dependência temporal e mudanças
de regime. Por isso **80% é o nível nominal**, não uma promessa de cobertura de cada item.
O raio é calibrado por horizonte com o conjunto de itens, não individualmente por item.
A cobertura efetiva e a largura média no teste ficam em `interval_test_metrics.csv` e
`metadata.json → metrics.interval_test`. Revise-as junto com as métricas de preço antes
de ativar a versão; a cobertura pode ficar abaixo de 80% em períodos distintos.

O artefato preserva o modelo que produziu os resíduos e as métricas; não é reajustado
sobre calibração/teste. `refit_end` agora identifica o fim efetivo de ajuste, e
`inference_after` impede previsões retroativas anteriores aos alvos da calibração.
Cada horizonte recebe sua própria versão, raio, datas e avaliação.

“Incerteza elevada” aparece quando `(superior - inferior) / previsto > 0.5` ou
`historico_curto=true`. O corte de 50% é uma regra explícita de apresentação, não uma
probabilidade adicional. O alerta de dados desatualizados permanece independente.
Dados, modelos e previsões locais continuam fora do Git.

A migração `a874b9c120de` adiciona campos opcionais e valida a integridade da faixa.
Aplique-a **antes** de iniciar a API/worker novos. Ela preserva as estimativas anteriores;
um novo treino é necessário para oferecer intervalos.

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
com preservação das previsões anteriores. Também verificam o cadastro automático do treino,
a consulta/comparação de versões e a proteção contra sobrescrita de métricas.
O CI executa o fluxo com PostgreSQL 17.

No frontend, `npm test` verifica a construção dos pontos, os três horizontes e a rejeição
de intervalos inválidos; `npm run build` verifica TypeScript e o build de produção.
Na conferência visual, verifique desktop/celular, tooltip, troca rápida de horizonte,
persistência dos parâmetros, carregamento sem mostrar o horizonte anterior, indisponibilidade,
versões legadas e avisos de histórico curto/desatualizado.

### Avaliação local de 01/11/2026

Histórico piloto: 37 itens, até 14/10/2026. CPU, configuração padrão e 4 threads,
calibração de 90 dias, teste de 180 dias. Os dados estão antigos e a interface mantém
o aviso de previsão desatualizada.

| Horizonte | Modelo selecionado no CV | MAPE no teste | Ganho de MAE sobre ingênuo | Cobertura observada | Largura relativa média |
|---|---|---|---|---|---|
| 7 dias | HGB + EMA | 8,35% | 20,32% | 73,49% | 14,07% |
| 15 dias | HGB + EMA | 10,88% | 17,23% | 74,94% | 17,97% |
| 30 dias | LightGBM + EMA | 12,32% | 18,78% | 95,53% | 84,92% |

As faixas de 7/15 dias ficaram abaixo da cobertura nominal no teste; a de 30 dias ficou
mais ampla e recebe “Incerteza elevada”. Esses resultados não foram usados para ajustar
o raio no teste. Mudanças de calibração exigem nova validação temporal independente.
