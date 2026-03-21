"""Database engine, session, and base model configuration."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite specific
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
