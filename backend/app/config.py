"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    SECRET_KEY: str = "ev-charging-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    DATABASE_URL: str = "sqlite:///./ev_charging.db"
    OPENCHARGEMAP_API_KEY: str = ""

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
