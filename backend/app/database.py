"""
Conexão e sessão do SQLAlchemy 2.x.

Fornece:
- `engine`: pool de conexões
- `SessionLocal`: factory de sessões
- `Base`: base declarativa para models
- `get_db`: dependency do FastAPI
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base declarativa para todos os models ORM do sistema."""
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependency injection para rotas FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
