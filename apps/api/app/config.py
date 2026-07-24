from functools import lru_cache
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

    auth_mode: str = "email"
    institutional_email_pattern: str = r"^[^@\s]+@[a-z0-9-]+\.cabofrio\.rj\.gov\.br$"
    email_verification_expire_minutes: int = 60
    public_app_url: str = "http://localhost:3000"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    seed_demo_data: bool | None = None

    remote_access_enabled: bool = False
    mesh_bridge_url: str = "http://mesh-bridge:8080"
    mesh_bridge_shared_secret: str = ""
    mesh_session_ttl_seconds: int = 3600

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
            if self.remote_access_enabled:
                if not self.mesh_bridge_url.strip():
                    raise ValueError("MESH_BRIDGE_URL é obrigatório quando REMOTE_ACCESS_ENABLED=true.")
                if not self.mesh_bridge_shared_secret.strip():
                    raise ValueError("MESH_BRIDGE_SHARED_SECRET é obrigatório fora do ambiente local quando o acesso remoto estiver habilitado.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
