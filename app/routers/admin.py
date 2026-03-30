from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db import crud
from app.dependencies import get_admin_user, get_current_user

router = APIRouter(tags=["Admin"])


# ── Teams ─────────────────────────────────────────────────────────────────────
@router.get("/teams")
async def list_teams(
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    return [{"id": t.id, "name": t.name} for t in crud.get_all_teams(db)]


@router.post("/teams")
async def add_team(
    name: str = Form(...),
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    try:
        crud.create_team(db, name)
        return {"status": "success"}
    except IntegrityError:
        db.rollback()
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "ชื่อทีมนี้มีในระบบแล้ว"},
        )


@router.delete("/teams/{team_id}")
async def remove_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    crud.delete_team(db, team_id)
    return {"status": "success"}


# ── Users ─────────────────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    cols = ["emp_id", "first_name", "last_name", "team_name", "role", "is_active", "last_login"]
    return [
        {c: str(getattr(u, c)) if c == "last_login" and getattr(u, c) else getattr(u, c)
         for c in cols}
        for u in crud.get_all_users(db)
    ]


@router.post("/users")
async def create_user(
    emp_id: str = Form(...),
    password: str = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(""),
    team_name: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    if crud.get_user(db, emp_id):
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "รหัสพนักงานนี้มีในระบบแล้ว"},
        )
    crud.create_user(db, emp_id, password, first_name, last_name, team_name, role)
    return {"status": "success"}


@router.put("/users/{target_emp_id}")
async def edit_user(
    target_emp_id: str,
    first_name: str = Form(...),
    last_name: str = Form(""),
    team_name: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user),
):
    if target_emp_id == admin["emp_id"] and role != "admin":
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "ไม่สามารถปลดสิทธิ์ Admin ของตัวเองได้"},
        )
    crud.update_user(db, target_emp_id, first_name, last_name, team_name, role)
    return {"status": "success"}


@router.delete("/users/{target_emp_id}")
async def delete_user(
    target_emp_id: str,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user),
):
    if target_emp_id == admin["emp_id"]:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "ไม่สามารถลบบัญชีตัวเองได้"},
        )
    crud.delete_user(db, target_emp_id)
    return {"status": "success"}


@router.put("/users/{target_emp_id}/status")
async def toggle_status(
    target_emp_id: str,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_admin_user),
):
    if target_emp_id == admin["emp_id"]:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": "ไม่สามารถระงับบัญชีตัวเองได้"},
        )
    crud.toggle_user_active(db, target_emp_id)
    return {"status": "success"}


@router.put("/users/{target_emp_id}/reset-password")
async def reset_password(
    target_emp_id: str,
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    _: dict = Depends(get_admin_user),
):
    crud.set_password(db, target_emp_id, new_password)
    return {"status": "success"}
