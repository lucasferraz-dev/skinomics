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
