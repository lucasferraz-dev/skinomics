FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.10.9 /uv /bin/uv

WORKDIR /code

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/code/.venv/bin:$PATH"

# Dependências antes do código: a camada só é refeita quando o uv.lock muda.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-cache

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN useradd --system --no-create-home skinomics
USER skinomics

EXPOSE 8080

# Aplica as migrações pendentes antes de subir a API, para o banco nunca ficar atrás do código.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8080"]
