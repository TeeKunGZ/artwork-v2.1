"""
Shared FastAPI dependencies injected into all routers.
Uses bcrypt directly — no passlib dependency.
"""
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt

from app.config import settings
from app.db.base import get_db
from app.db.crud import get_active_user
from sqlalchemy.orm import Session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        emp_id: str = payload.get("sub")
        if not emp_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = get_active_user(db, emp_id)
    if not user:
        raise HTTPException(status_code=401, detail="User disabled or not found")

    return {c.name: getattr(user, c.name) for c in user.__table__.columns
            if c.name != "password_hash"}


async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin Only")
    return current_user
