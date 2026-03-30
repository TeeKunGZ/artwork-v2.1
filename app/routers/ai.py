"""
AI routes:
  POST /api/ai/train         — rebuild FAISS index (admin only)
  POST /api/ai/predict       — classify an image crop
  GET  /api/ai/status        — current snapshot (JSON)
  GET  /api/ai/status/stream — Server-Sent Events real-time stream
"""
from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.dependencies import get_admin_user, get_current_user
from app.services.ai_status import get_registry, ModuleState

router = APIRouter(tags=["AI"])


def _get_classifier():
    from app.services.ai_classifier import get_ai_classifier
    return get_ai_classifier()


# ── Train ─────────────────────────────────────────────────────────────────────
@router.post("/train")
async def train_ai(_: dict = Depends(get_admin_user)):
    try:
        return _get_classifier().build_index()
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(exc)},
        )


# ── Predict ───────────────────────────────────────────────────────────────────
@router.post("/predict")
async def predict_image(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user),
):
    try:
        return _get_classifier().predict(await file.read())
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(exc)},
        )


# ── Status snapshot ───────────────────────────────────────────────────────────
@router.get("/status")
async def get_ai_status(_: dict = Depends(get_current_user)):
    return get_registry().get_snapshot()


# ── SSE stream ────────────────────────────────────────────────────────────────
@router.get("/status/stream")
async def stream_ai_status(token: str = ""):
    """
    Server-Sent Events stream — ส่ง snapshot ทุกครั้งที่ module state เปลี่ยน
    รับ token ผ่าน query string เพราะ EventSource ไม่รองรับ custom headers
    GET /api/ai/status/stream?token=<jwt>
    """
    # Validate token manually (EventSource cannot send Authorization header)
    import jwt as _jwt
    from app.config import settings as _s
    from app.db.base import SessionLocal as _SL
    from app.db.crud import get_active_user as _gau
    try:
        payload = _jwt.decode(token, _s.SECRET_KEY, algorithms=[_s.ALGORITHM])
        emp_id = payload.get("sub")
        db = _SL()
        user = _gau(db, emp_id)
        db.close()
        if not user:
            raise ValueError("user not found")
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid token")

    reg = get_registry()
    queue = reg.subscribe()

    async def event_generator():
        try:
            # ส่ง snapshot แรกทันที
            snapshot = reg.get_snapshot()
            yield f"data: {json.dumps(snapshot)}\n\n"

            # heartbeat + updates
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(msg)}\n\n"
                except asyncio.TimeoutError:
                    # heartbeat ทุก 15s เพื่อป้องกัน connection timeout
                    yield f"data: {json.dumps({'type': 'ping', 'ts': time.time()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            reg.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
