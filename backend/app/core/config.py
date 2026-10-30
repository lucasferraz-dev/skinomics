from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SKINOMICS_", extra="ignore")

    app_name: str = "Skinomics API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://skinomics:skinomics@localhost:55432/skinomics"
    cors_origins: list[str] = ["http://localhost:5173"]
    # Endereço público do site: a Steam devolve o usuário para cá depois do login.
    site_url: str = "http://localhost:5173"
    # Chave da Steam Web API, para buscar nome e avatar; sem ela, vêm da página pública do perfil.
    steam_api_key: str | None = None
    sessao_dias: int = 30

    @property
    def cookie_seguro(self) -> bool:
        return self.site_url.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
