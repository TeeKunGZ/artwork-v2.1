from datetime import datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.db.base import get_db
from app.db.crud import (
    get_user,
    touch_last_login,
    verify_password,
    set_password,
)
from app.dependencies import get_current_user

router = APIRouter(tags=["Auth"])


def _create_token(emp_id: str) -> str:
    payload = {
        "sub": emp_id,
        "exp": datetime.utcnow() + timedelta(hours=settings.TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = get_user(db, form_data.username)
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="รหัสพนักงาน หรือ รหัสผ่าน ไม่ถูกต้อง")
    if user.is_active == 0:
        raise HTTPException(status_code=400, detail="บัญชีนี้ถูกระงับการใช้งาน")

    touch_last_login(db, user.emp_id)
    user_dict = {c.name: getattr(user, c.name)
                 for c in user.__table__.columns
                 if c.name != "password_hash"}
    return {
        "access_token": _create_token(user.emp_id),
        "token_type": "bearer",
        "user": user_dict,
    }


@router.get("/me")
async def read_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put("/users/me/password")
async def change_own_password(
    old_password: str = Form(...),
    new_password: str = Form(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(new_password) < 8:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"},
        )
    user = get_user(db, current_user["emp_id"])
    if not verify_password(old_password, user.password_hash):
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "รหัสผ่านเดิมไม่ถูกต้อง"},
        )
    set_password(db, current_user["emp_id"], new_password)
    return {"status": "success"}
