from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from ..config import settings

# SQLAlchemy Base
Base = declarative_base()

# Database Engine
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Session Local
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()