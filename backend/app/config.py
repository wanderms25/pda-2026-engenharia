"""Configuração central do sistema via variáveis de ambiente."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Banco de dados
    DATABASE_URL: str = (
        "postgresql+psycopg://pda_user:pda_password@localhost:5432/pda_nbr5419"
    )

    # Segurança
    SECRET_KEY: str = "mude-esta-chave-em-producao"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # Ambiente
    ENVIRONMENT: str = "development"


settings = Settings()
