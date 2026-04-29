"""
All database read/write helpers.
Uses bcrypt directly (no passlib) for Python 3.11+ compatibility.
"""
import json
from datetime import datetime

import bcrypt
from sqlalchemy.orm import Session

from app.db.models import CropMemory, Team, User


# ── Password helpers ──────────────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_password_hash(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── User CRUD ─────────────────────────────────────────────────────────────────
def get_user(db: Session, emp_id: str) -> User | None:
    return db.query(User).filter_by(emp_id=emp_id).first()


def get_active_user(db: Session, emp_id: str) -> User | None:
    return db.query(User).filter_by(emp_id=emp_id, is_active=1).first()


def get_all_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.emp_id).all()


def create_user(db: Session, emp_id: str, password: str, first_name: str,
                last_name: str, team_name: str, role: str) -> User:
    user = User(
        emp_id=emp_id,
        password_hash=get_password_hash(password),
        first_name=first_name,
        last_name=last_name,
        team_name=team_name,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, emp_id: str, first_name: str, last_name: str,
                team_name: str, role: str) -> User | None:
    user = get_user(db, emp_id)
    if not user:
        return None
    user.first_name = first_name
    user.last_name = last_name
    user.team_name = team_name
    user.role = role
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, emp_id: str) -> bool:
    user = get_user(db, emp_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


def toggle_user_active(db: Session, emp_id: str) -> User | None:
    user = get_user(db, emp_id)
    if not user:
        return None
    user.is_active = 0 if user.is_active else 1
    db.commit()
    db.refresh(user)
    return user


def set_password(db: Session, emp_id: str, new_password: str) -> bool:
    user = get_user(db, emp_id)
    if not user:
        return False
    user.password_hash = get_password_hash(new_password)
    user.must_change_password = 0
    db.commit()
    return True


def touch_last_login(db: Session, emp_id: str) -> None:
    user = get_user(db, emp_id)
    if user:
        user.last_login = datetime.utcnow()
        db.commit()


# ── Team CRUD ─────────────────────────────────────────────────────────────────
def get_all_teams(db: Session) -> list[Team]:
    return db.query(Team).order_by(Team.name).all()


def create_team(db: Session, name: str) -> Team:
    team = Team(name=name.strip())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def delete_team(db: Session, team_id: int) -> bool:
    team = db.query(Team).filter_by(id=team_id).first()
    if not team:
        return False
    db.delete(team)
    db.commit()
    return True


# ── CropMemory CRUD ───────────────────────────────────────────────────────────
def upsert_crop_memory(db: Session, item_id: str, column_id: str,
                       crop_data: dict, emp_id: str) -> None:
    record = db.query(CropMemory).filter_by(
        item_id=item_id, column_id=column_id
    ).first()
    now = datetime.utcnow()
    if record:
        record.crop_data = json.dumps(crop_data)
        record.updated_by = emp_id
        record.updated_at = now
    else:
        db.add(CropMemory(
            item_id=item_id,
            column_id=column_id,
            crop_data=json.dumps(crop_data),
            updated_by=emp_id,
            updated_at=now,
        ))
    db.commit()


def get_all_crop_memory(db: Session) -> dict:
    """Return {item_id: {column_id: crop_data_dict}}"""
    memory: dict = {}
    for row in db.query(CropMemory).all():
        memory.setdefault(row.item_id, {})[row.column_id] = json.loads(row.crop_data)
    return memory
