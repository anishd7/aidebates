from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    NEXTAUTH_SECRET: str
    ENCRYPTION_KEY: str
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
