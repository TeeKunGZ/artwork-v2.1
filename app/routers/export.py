"""
Export routes:
  POST /api/generate-excel  — fill Excel template with crops + text data
  POST /api/generate-zip    — bundle crops into a named ZIP
"""
from __future__ import annotations

import asyncio
import io
import json
import time
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import settings
from app.dependencies import get_current_user
from app.services.excel_merger import merge_excel_bytes
from app.services.excel_writer import generate_excel_bytes, generate_zip_bytes
from app.services.ai_status import get_registry, ModuleState

router = APIRouter(tags=["Export"])

MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


async def _read_xlsx_upload(file: UploadFile, field_name: str) -> tuple[str, bytes]:
    filename = file.filename or ""
    if not filename.lower().endswith(".xlsx"):
        raise ValueError(f"{field_name} must be a .xlsx file")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError(f"{field_name} exceeds {settings.MAX_UPLOAD_MB}MB")
    if not data:
        raise ValueError(f"{field_name} is empty")
    return filename, data


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
        # Read all uploaded images in parallel
        async def _read_img(img: UploadFile):
            return (img.filename, await img.read())
        crops = await asyncio.gather(*[_read_img(img) for img in images])
        template_bytes = await excel_file.read() if excel_file else None

        workbook_bytes = await asyncio.to_thread(
            generate_excel_bytes, records, list(crops), mappings, template_bytes
        )

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
        async def _read_img(img: UploadFile):
            return (img.filename, await img.read())
        crops = await asyncio.gather(*[_read_img(img) for img in images])

        zip_bytes = await asyncio.to_thread(
            generate_zip_bytes, records, list(crops), mappings
        )

        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=Artwork_Assets.zip"},
        )
    except Exception as exc:
        return JSONResponse(status_code=400,
                            content={"status": "error", "message": str(exc)})


@router.post("/merge-excel")
async def merge_excel(
    base_file: UploadFile | None = File(None),
    import_files: list[UploadFile] = File([]),
    _: dict = Depends(get_current_user),
):
    try:
        if base_file is None:
            return JSONResponse(status_code=400,
                                content={"status": "error", "message": "base_file is required"})
        if not import_files:
            return JSONResponse(status_code=400,
                                content={"status": "error", "message": "import_files is required"})

        _, base_bytes = await _read_xlsx_upload(base_file, "base_file")
        imports = []
        for file in import_files:
            imports.append(await _read_xlsx_upload(file, "import_files"))

        workbook_bytes, summary = await asyncio.to_thread(
            merge_excel_bytes, base_bytes, imports
        )

        filename = f"Merged_Excel_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        return StreamingResponse(
            io.BytesIO(workbook_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Merge-Added": str(summary.added),
                "X-Merge-Skipped": str(summary.skipped),
                "X-Merge-Errors": str(summary.errors),
            },
        )
    except ValueError as exc:
        return JSONResponse(status_code=400,
                            content={"status": "error", "message": str(exc)})
    except Exception as exc:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500,
                            content={"status": "error", "message": f"Server Error: {exc}"})
