from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# SQLite needs check_same_thread=False; ignored by other engines
connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI Dependency — yields a SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.db import models  # noqa: F401 — registers ORM models
    Base.metadata.create_all(bind=engine)
    _seed_defaults()


def _seed_defaults():
    """Insert default teams & admin user if the DB is brand-new."""
    from app.db.models import Team, User
    from app.db.crud import get_password_hash

    db = SessionLocal()
    try:
        if db.query(Team).count() == 0:
            db.add_all([Team(name="Graphic Team A"), Team(name="Graphic Team B")])
            db.commit()

        if not db.query(User).filter_by(emp_id="admin01").first():
            db.add(
                User(
                    emp_id="admin01",
                    password_hash=get_password_hash("123456"),
                    first_name="System",
                    last_name="Admin",
                    team_name="IT Support",
                    role="admin",
                )
            )
            db.commit()
    finally:
        db.close()
