from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str       = "sqlite:////app/data/artportal.db"
    SECRET_KEY: str         = "artportal_super_secret_key_v1_secure_2026"
    ALGORITHM: str          = "HS256"
    TOKEN_EXPIRE_HOURS: int = 12
    OCR_THRESHOLD: int      = 5      # min blocks → skip next OCR stage
    AI_THRESHOLD: float     = 0.75   # cosine similarity cutoff


settings = Settings()
