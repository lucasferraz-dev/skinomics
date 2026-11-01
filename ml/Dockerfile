FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.10.9 /uv /bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /code
COPY ml/pyproject.toml ml/uv.lock ml/.python-version ./ml/
RUN uv sync --project ml --locked --no-dev --no-cache
COPY ml/*.py ./ml/
ENV PATH="/code/ml/.venv/bin:$PATH" \
    SKINOMICS_MODEL_DIR="/models"
RUN useradd --system --no-create-home skinomics
USER skinomics
CMD ["python", "-m", "ml.worker"]
