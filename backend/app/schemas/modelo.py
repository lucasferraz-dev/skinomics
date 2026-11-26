from pydantic import BaseModel, Field


class ModeloAtivoResumo(BaseModel):
    """Modelo publicado de um jogo num horizonte, com as métricas do seu teste temporal."""

    appid: int = Field(description="Jogo do modelo na Steam (440 = TF2, 730 = CS2).")
    horizonte: int
    versao: str
    nome: str
    treinado_em: str | None = None
    mape_pct: float | None = Field(
        default=None, description="Erro percentual médio do preço no teste."
    )
    acerto_preco_pct: float | None = Field(
        default=None, description="Previsões dentro da tolerância de preço no teste, em %."
    )
    acerto_direcao_pct: float | None = Field(
        default=None, description="Previsões que acertaram se o preço sobe ou desce, em %."
    )
    cobertura_intervalo: float | None = Field(
        default=None, ge=0, le=1, description="Fração do teste dentro da faixa de 80%."
    )
