from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="SKINOMICS_", extra="ignore")

    app_name: str = "Skinomics API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://skinomics:skinomics@localhost:55432/skinomics"
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
