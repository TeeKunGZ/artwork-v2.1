from sqlalchemy import Column, String, Integer, Text, DateTime
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    emp_id        = Column(String, primary_key=True, index=True)
    password_hash = Column(String, nullable=False)
    first_name    = Column(String, default="")
    last_name     = Column(String, default="")
    team_name     = Column(String, default="")
    role          = Column(String, default="user")   # "user" | "admin"
    is_active     = Column(Integer, default=1)
    last_login    = Column(DateTime, nullable=True)


class Team(Base):
    __tablename__ = "teams"

    id   = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)


class CropMemory(Base):
    __tablename__ = "crop_memory"

    item_id    = Column(String, primary_key=True)
    column_id  = Column(String, primary_key=True)
    crop_data  = Column(Text, nullable=False)   # JSON string
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True)
