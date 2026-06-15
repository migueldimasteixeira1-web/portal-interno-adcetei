from functools import lru_cache
from typing import Literal
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Portal Interno ADCETEI"
    environment: str = "development"
    secret_key: str = "troque-esta-chave-no-ambiente-de-producao"
    access_token_expire_minutes: int = 480
    database_url: str = "sqlite:///./prefeitura_ti.db"
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_db: str = "prefeitura_ti"
    postgres_user: str = "prefeitura_ti"
    postgres_password: str = ""
    cors_origins: str = "http://localhost:3000"

    auth_mode: Literal["local", "ldap", "hybrid"] = "local"
    seed_demo_data: bool | None = None
    ldap_server: str = ""
    ldap_bind_dn: str = ""
    ldap_bind_password: str = ""
    ldap_base_dn: str = ""
    ldap_user_filter: str = "(sAMAccountName={username})"
    ldap_helpdesk_group: str = "GG_TI_HELPDESK"
    ldap_technician_group: str = "GG_TI_TECNICOS"
    ldap_admin_group: str = "GG_TI_ADMIN"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def demo_seed_enabled(self) -> bool:
        if self.seed_demo_data is not None:
            return self.seed_demo_data
        return self.environment.strip().lower() in {"local", "development", "dev"}

    @property
    def is_local_environment(self) -> bool:
        return self.environment.strip().lower() in {"local", "development", "dev"}

    @property
    def effective_database_url(self) -> str:
        if not self.postgres_host:
            return self.database_url
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        database = quote_plus(self.postgres_db)
        return f"postgresql+psycopg://{user}:{password}@{self.postgres_host}:{self.postgres_port}/{database}"

    @model_validator(mode="after")
    def validate_deployment_secrets(self):
        environment = self.environment.strip().lower()
        if environment not in {"local", "development", "dev", "test"}:
            if len(self.secret_key) < 32 or self.secret_key == "troque-esta-chave-no-ambiente-de-producao":
                raise ValueError("SECRET_KEY deve ter pelo menos 32 caracteres fora do ambiente local.")
            if self.postgres_host and not self.postgres_password:
                raise ValueError("POSTGRES_PASSWORD é obrigatório para o PostgreSQL.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
