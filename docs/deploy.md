# Vercel, Render e previsões

A Vercel publica apenas `frontend/`. As chamadas `/api/*` passam pelo rewrite de
`frontend/vercel.json` para `https://skinomics-api.onrender.com/*`. A API lê o PostgreSQL
configurado no Render. Fazer deploy do Git não copia o banco local, o CSV, os artefatos
`joblib` nem ativa modelos; esses dados são publicados separadamente.

## Configuração dos serviços

Na Vercel, selecione a branch de produção `main` e **Root Directory = frontend**.
O framework Vite, o build `npm run build` e a saída `dist` estão no `vercel.json`.
Deixe `VITE_API_URL` ausente ou igual a `/api`. Apontar diretamente para o Render separa
os cookies do domínio do site e quebra o fluxo de login pela Steam. O frontend usa
`VITE_*` durante o build; mudar uma variável exige novo deploy. Nunca coloque a URL
do banco ou outras credenciais em uma variável `VITE_*`.

No Render, o serviço Docker da API usa `backend/` como contexto e `backend/Dockerfile`.
Configure:

- `SKINOMICS_DATABASE_URL`: URL PostgreSQL com driver `postgresql+psycopg://` e parâmetros
  SSL exigidos pelo provedor. A API e o processo ML precisam apontar para o mesmo banco.
- `SKINOMICS_SITE_URL`: domínio HTTPS público e canônico do frontend, sem barra final.
  No ambiente atual: `https://skinomics.ferrazdeveloper.com`.
- `SKINOMICS_ENVIRONMENT=production`.
- Health check: `/health/ready`, que também verifica o acesso ao banco.

O container aplica migrações antes de iniciar a API e respeita `PORT` (padrão 8080).
`/health` verifica apenas se o processo responde. Respostas da API têm `no-store`,
inclusive autenticação, listas pessoais e previsões; os assets estáticos continuam
com a política normal da Vercel.

Previews da Vercel usam o mesmo backend definido no rewrite e podem ter proteção de
acesso da Vercel. O login Steam retorna ao domínio canônico configurado no Render;
teste autenticação nesse domínio. Não desative a proteção nem altere o callback de
produção para testar um preview. Se precisar isolar previews, use backend e banco de
homologação e ajuste o destino do rewrite nesse ambiente.

## Publicar os mesmos modelos em outro banco

Use o checkout completo e os **mesmos arquivos** de modelos avaliados localmente.
Treinar novamente cria outras versões e pode mudar o ranking. Para resultados iguais,
também precisam coincidir catálogo ativo, histórico, datas e versão do código.

Guarde a conexão de destino em `.env.production` (ignorado pelo Git):

```dotenv
SKINOMICS_DATABASE_URL=postgresql+psycopg://usuario:senha@host/banco?sslmode=require
SKINOMICS_MODEL_DIR=C:/caminho/skinomics/ml/artifacts
```

Na raiz, faça primeiro a prévia sem escrita:

```powershell
uv sync --project ml --locked
uv run --project ml --env-file .env.production python -m ml.publish ml/artifacts/<versao-7>/price_model.joblib ml/artifacts/<versao-15>/price_model.joblib ml/artifacts/<versao-30>/price_model.joblib
```

A prévia confere os três horizontes, os intervalos calibrados de 80%, os itens elegíveis,
as datas, os hashes e as versões anteriormente ativas. Após revisar, publique:

```powershell
uv run --project ml --env-file .env.production python -m ml.publish ml/artifacts/<versao-7>/price_model.joblib ml/artifacts/<versao-15>/price_model.joblib ml/artifacts/<versao-30>/price_model.joblib --apply --reason "Publicar versões avaliadas nos três horizontes"
```

O comando cadastra as versões e prepara os lotes antes de promover todos os horizontes
em uma transação. Uma falha de inferência ou promoção preserva os modelos ativos
anteriores. Repetir não duplica previsões nem ativações. Versões e lotes preparados
permanecem para auditoria; a publicação não importa nem sobrescreve preços, usuários ou listas.
Se outro operador promover um modelo durante a preparação, o comando recusa a troca.

Também é possível preparar um único lote sem ativar sua versão:

```powershell
uv run --project ml --env-file .env.production python -m ml.predict --horizon 15 --model-version <versao-15>
```

O backend serve as previsões persistidas sem precisar abrir artefatos. Para atualização
contínua, execute `python -m ml.worker` em um processo com acesso ao mesmo banco e a uma
cópia dos artefatos em `SKINOMICS_MODEL_DIR`. Arquivos no computador local não aparecem
automaticamente no Render. Em um worker remoto, provisione os artefatos em armazenamento
persistente e confira os SHA-256; um deploy Docker não os inclui, pois estão fora do Git.

## Verificar depois do deploy

O diagnóstico só lê rotas públicas e retorna código 1 se encontrar falhas:

```powershell
uv run --project ml python scripts/check_deployment.py --site https://skinomics.ferrazdeveloper.com --api https://skinomics-api.onrender.com
uv run --project ml python scripts/check_deployment.py --site https://skinomics.ferrazdeveloper.com --api https://skinomics-api.onrender.com --compare-to http://127.0.0.1:8081
```

Ele verifica o fallback da SPA, JSON no proxy, acesso à API, modelos de 7/15/30 dias,
previsões compatíveis, intervalo de 80% na amostra e diferenças entre os rankings.
Datas antigas geram aviso: continuam visíveis para teste, sem inventar dados atuais.
IDs dos itens e horários de execução podem variar entre bancos e não são usados na
comparação. Os resultados precisam ser comparados com a mesma base; uma coleta nova
pode legitimamente alterar o ranking.

## Diagnóstico de 02/11/2026

O domínio público e a API respondiam corretamente, e o frontend era o mesmo da versão
local. Os dois bancos tinham os mesmos 90.031 preços para 37 itens. A produção usava
outro modelo de 7 dias, sem intervalo calibrado, e não tinha modelos ativos de 15/30 dias.
O deploy do frontend não era suficiente para corrigir essa diferença.

Referências: [rewrites da Vercel](https://vercel.com/docs/routing/rewrites),
[variáveis no Render](https://render.com/docs/configure-environment-variables) e
[discos persistentes](https://render.com/docs/disks).
