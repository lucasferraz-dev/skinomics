# Ranking de oportunidades — US013 (#23)

A página **Oportunidades**, no menu de análise (`/oportunidades`), apresenta os itens TF2
com preço abaixo da média prevista. Mantém os componentes, cores e tipografia do site,
com tabela no desktop e cartões no celular. O horizonte de 7, 15 ou 30 dias fica na URL
e acompanha o link para a página do item.

O menu Área de análise é compartilhado por todas as páginas. No início e no login, ele
fica no cabeçalho (menu hambúrguer na landing page); nas páginas de análise, permanece na navegação existente. A opção
Visão geral retorna ao catálogo de itens de TF2 (`/itens`).

## Regras do ranking

`GET /oportunidades?horizonte=7&pagina=1&por_pagina=20` retorna:

- Nome/imagem, preço-base (`preco_atual` na API), média prevista, margem bruta percentual e diferença em USD.
- Posição, risco baixo/moderado/alto e motivos, volume médio e volatilidade observada.
- Data-base, data-alvo, janela da média futura, geração da previsão e versão do modelo.
- Total, paginação, itens sem previsão compatível e quantidade de oportunidades com dados antigos.

A margem é `(preco_previsto / preco_atual) - 1`, como fração na API. São aceitas somente
margens estritamente positivas, ordenadas da maior para a menor; o ID do item desempata.
Ela não desconta taxas ou spread e não representa lucro garantido ou uma cotação executável.

Entram somente itens ativos de TF2 e previsões do **modelo ativo do horizonte solicitado**.
O último preço completo disponível e a data-base da previsão precisam corresponder entre si.
A coleta precisa ter ocorrido após o fechamento do dia; registros parciais de hoje não
entram. A previsão também precisa usar o mesmo preço-base da série: uma correção do preço
exige nova inferência. Não se substitui um horizonte por outro.

Para facilitar os testes, dados antigos também entram, preservando a data-base e a janela
original, inclusive quando ela já passou. A API marca cada item com `desatualizada` quando
a base antecede ontem em UTC e retorna `itens_desatualizados` para todo o ranking, antes da
paginação. A tela mostra um aviso, a data-base e a janela de cada item. A data-base geral
só é preenchida quando todas as oportunidades compartilham a mesma data.

Estados vazios são explícitos: sem modelo ativo, aguardando previsões compatíveis ou sem
margem positiva. Para atualizar os resultados, execute a coleta/importação e depois a
inferência/worker descritos no [guia de integração](ml-integracao.md). Preços mais recentes
sem previsão correspondente continuam fora do ranking; não se mistura uma previsão antiga
com um preço de outra data.

Não há armazenamento de histórico de oportunidades nem filtros por jogo, preço ou risco.
A API é de leitura e reutiliza as tabelas existentes; nenhuma migração é necessária.

## Indicador de risco

O indicador é uma regra descritiva, não uma probabilidade calibrada. O maior nível entre os
critérios abaixo determina o risco. Todos os motivos ficam disponíveis ao expandir o rótulo
do item. Os limites são referências explícitas da primeira versão, não otimizados no teste.

| Critério | Moderado | Alto |
|---|---|---|
| Volume médio diário, últimos 7 dias calendário | 10 a menos de 100 negociações | Menos de 10 |
| Desvio dos log-retornos diários, últimos 30 dias | 5% a menos de 10% | Pelo menos 10% |
| Intervalo da previsão | Limite inferior menor ou igual ao preço atual | Largura maior que 50% da média prevista ou flag de incerteza elevada |
| Disponibilidade de dados | — | Histórico curto, intervalo ausente, semana incompleta ou menos de 14 retornos diários válidos |

O volume só é calculado com os sete dias disponíveis. A volatilidade é o desvio populacional,
sem anualizar: usa pares de dias consecutivos e exclui pares com preço preenchido. Lacunas
ou preços carregados do dia anterior não são interpretados como estabilidade. Somente
observações até a data-base de cada previsão são usadas, inclusive com dados antigos.
Sem sinais moderados/altos, a classificação é baixa,
sem garantir valorização. A regra está em `backend/app/servicos/risco_oportunidade.py`.

## Validação retrospectiva em uma amostra

O script usa o artefato já treinado, sem ajuste de parâmetros, ativação de modelos ou escrita
no banco. Execute na raiz do repositório completo, com o ambiente ML:

```powershell
uv sync --project ml --locked
uv run --project ml python -m ml.evaluate_opportunities --database --artifact ml/artifacts/<version_id>/price_model.joblib --sample-dates 5 --top-k 10
# Alternativa: --data ml/data/tf2_historico.csv em vez de --database.
```

O script seleciona até cinco datas igualmente espaçadas no período de teste registrado e as
dez maiores margens positivas em cada data. As features usam todo o mercado disponível até
aquele dia. Seleção e risco precedem a consulta do preço real futuro; janelas sem alvo completo
são contabilizadas, não retiradas do ranking após observar o resultado. Empates usam o nome
do item na amostra, pois o CSV pode não ter ID de catálogo. O endpoint desempata por ID.

O teste precisa ser posterior a todos os alvos usados no treino/calibração. Artefatos antigos
reajustados sobre o teste são recusados. O preço real é a mesma média futura usada como alvo
do modelo. Os relatórios `summary.json` e `sample.csv` ficam em uma nova pasta local
`ml/artifacts/opportunities/<id>/`, fora do Git; `--output-dir` exige um destino novo.
Os relatórios são evidência de validação, não histórico de oportunidades servido pela aplicação.

### Amostra executada em 01/11/2026

Histórico piloto de 37 itens, até 14/10/2026; cinco datas do teste por horizonte, no máximo
dez oportunidades por data. As versões são as previamente treinadas e calibradas:

| Horizonte | Versão | Pares item/data avaliados | Margem real positiva | MAE (USD) | MAPE |
|---|---|---|---|---|---|
| 7 dias | `148e982e-36b6-40d5-af1a-e1b8258a4c54` | 50 | 88,00% | 0,0926 | 12,77% |
| 15 dias | `a400f348-1bc9-44a3-b714-099778fac035` | 50 | 84,00% | 0,1024 | 14,68% |
| 30 dias | `a1e82de8-3dac-4232-9c78-e62f42f0385f` | 44 | 72,73% | 0,0962 | 13,32% |

Os pares não são independentes: itens podem reaparecer, e janelas podem se sobrepor. A amostra
não reconstrói o catálogo histórico ou a disponibilidade real de ofertas; assume preços
conhecidos ao fechamento. Não inclui taxas, spread ou execução. As taxas acima não medem
confiança individual nem lucro realizável. Não houve casos de risco baixo na amostra; ela
não valida a discriminação entre todas as categorias de risco.

## Verificação local

```powershell
uv run --directory backend pytest
uv run --project ml pytest -c ml/pyproject.toml ml/tests/test_opportunities.py
uv run --project ml --group integration pytest -c ml/pyproject.toml tests/integration
```

O frontend deve passar `npm test` e `npm run build`. Na conferência em navegador, testar os
três horizontes, link para o item com o horizonte selecionado, paginação, motivos de risco,
carregamento sem resultados do horizonte anterior, erro/repetição e estados vazios.
No celular, preços, margem e risco ficam no mesmo cartão, sem rolagem horizontal da página.
Massas de interface são somente para teste, sem alterar o banco da aplicação.

Para desenvolver com outra porta de API, `SKINOMICS_API_PROXY` configura o proxy do Vite;
o padrão continua `http://localhost:8080`. Esse endereço é usado somente em desenvolvimento.
