from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str       = "sqlite:////app/data/artportal.db"
    SECRET_KEY: str         # REQUIRED — must be set via .env or environment variable
    ALGORITHM: str          = "HS256"
    TOKEN_EXPIRE_HOURS: int = 12
    OCR_THRESHOLD: int      = 5      # min blocks → skip next OCR stage
    AI_THRESHOLD: float     = 0.90   # cosine similarity cutoff
    MAX_UPLOAD_MB: int      = 500     # max file upload size in megabytes


settings = Settings()
