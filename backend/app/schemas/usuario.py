from pydantic import BaseModel, ConfigDict, Field


class UsuarioAtual(BaseModel):
    model_config = ConfigDict(from_attributes=True, coerce_numbers_to_str=True)

    id: int
    # Texto: o SteamID64 passa do maior inteiro exato do JavaScript (2^53).
    steam_id: str = Field(description="SteamID64")
    nome: str | None = Field(description="Nome no perfil Steam; nulo se não deu para buscar")
    avatar_url: str | None
