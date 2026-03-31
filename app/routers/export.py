"""
Export routes:
  POST /api/generate-excel  — fill Excel template with crops + text data
  POST /api/generate-zip    — bundle crops into a named ZIP
"""
from __future__ import annotations

import io
import json
import time
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.dependencies import get_current_user
from app.services.excel_writer import generate_excel_bytes, generate_zip_bytes
from app.services.ai_status import get_registry, ModuleState

router = APIRouter(tags=["Export"])


@router.post("/generate-excel")
async def generate_excel(
    text_data: str = Form(...),
    mapping_data: str = Form(...),
    images: list[UploadFile] = File([]),
    excel_file: UploadFile = File(None),
    _: dict = Depends(get_current_user),
):
    reg   = get_registry()
    start = time.time()
    reg.update("excel_export", ModuleState.RUNNING, "กำลังสร้างไฟล์ Excel...")

    try:
        try:
            records  = json.loads(text_data)
            mappings = json.loads(mapping_data)
        except json.JSONDecodeError as exc:
            reg.update("excel_export", ModuleState.ERROR, "Invalid JSON input")
            return JSONResponse(status_code=400,
                                content={"status": "error", "message": f"Invalid JSON: {exc}"})
        crops    = [(img.filename, await img.read()) for img in images]

        workbook_bytes = generate_excel_bytes(records, crops, mappings)

        elapsed = int((time.time() - start) * 1000)
        reg.update("excel_export", ModuleState.IDLE,
                   f"สร้างสำเร็จ {len(crops)} รูป ({elapsed}ms)", duration_ms=elapsed)

        filename = f"Artwork_Report_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        return StreamingResponse(
            io.BytesIO(workbook_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except FileNotFoundError as exc:
        reg.update("excel_export", ModuleState.ERROR, str(exc))
        return JSONResponse(status_code=404,
                            content={"status": "error", "message": str(exc)})
    except Exception as exc:
        reg.update("excel_export", ModuleState.ERROR, str(exc))
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500,
                            content={"status": "error", "message": f"Server Error: {exc}"})


@router.post("/generate-zip")
async def generate_zip(
    text_data: str = Form(...),
    mapping_data: str = Form(...),
    images: list[UploadFile] = File([]),
    _: dict = Depends(get_current_user),
):
    try:
        try:
            records  = json.loads(text_data)
            mappings = json.loads(mapping_data)
        except json.JSONDecodeError as exc:
            return JSONResponse(status_code=400,
                                content={"status": "error", "message": f"Invalid JSON: {exc}"})
        crops    = [(img.filename, await img.read()) for img in images]

        zip_bytes = generate_zip_bytes(records, crops, mappings)

        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=Artwork_Assets.zip"},
        )
    except Exception as exc:
        return JSONResponse(status_code=400,
                            content={"status": "error", "message": str(exc)})
