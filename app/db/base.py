from sqlalchemy import create_engine, inspect, text
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
    _migrate_schema()
    _seed_defaults()


def _migrate_schema():
    """Add missing columns to existing tables (lightweight migration)."""
    insp = inspect(engine)
    if "users" in insp.get_table_names():
        col_names = {c["name"] for c in insp.get_columns("users")}
        if "must_change_password" not in col_names:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0"
                ))
            print("[MIGRATE] Added column users.must_change_password")


def _seed_defaults():
    """Insert default teams & admin user if the DB is brand-new."""
    from app.db.models import Team, User
    from app.db.crud import get_password_hash
    import secrets

    db = SessionLocal()
    try:
        if db.query(Team).count() == 0:
            db.add_all([Team(name="Graphic Team A"), Team(name="Graphic Team B")])
            try:
                db.commit()
            except Exception:
                db.rollback()

        if not db.query(User).filter_by(emp_id="admin01").first():
            default_pw = secrets.token_urlsafe(16)
            db.add(
                User(
                    emp_id="admin01",
                    password_hash=get_password_hash(default_pw),
                    first_name="System",
                    last_name="Admin",
                    team_name="IT Support",
                    role="admin",
                    must_change_password=1,
                )
            )
            try:
                db.commit()
                print(f"[INIT] Default admin created — emp_id=admin01  password={default_pw}")
                print("[INIT] *** Please change this password immediately! ***")
            except Exception:
                db.rollback()
    finally:
        db.close()
