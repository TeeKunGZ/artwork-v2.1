"""
OCR Fallback Chain with real-time status reporting.
  Stage 1 — PDFMiner  (~50ms)
  Stage 2 — Tesseract (~300ms)
  Stage 3 — EasyOCR  (~2-5s)
"""
from __future__ import annotations

import gc
import hashlib
import io
import os
import shutil
import time
from typing import TypedDict

import cv2
import fitz
import numpy as np
from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTTextBox
from thefuzz import fuzz

from app.config import settings
from app.services.ai_status import get_registry, ModuleState


class TextBlock(TypedDict):
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    page: int
    source: str


_easy_ocr = None
_tesseract_available: bool | None = None
_ocr_cache: dict[str, list[TextBlock]] = {}


def _check_tesseract() -> bool:
    global _tesseract_available
    if _tesseract_available is not None:
        return _tesseract_available

    custom_path = os.environ.get("TESSERACT_CMD")
    if custom_path:
        try:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = custom_path
        except ImportError:
            pass

    _tesseract_available = bool(shutil.which("tesseract") or custom_path)
    reg = get_registry()
    if _tesseract_available:
        reg.update("ocr_tesseract", ModuleState.IDLE, "พร้อมใช้งาน")
    else:
        reg.update("ocr_tesseract", ModuleState.NOT_READY,
                   "ไม่พบ binary — Stage 2 ถูกข้าม")
    return _tesseract_available


def _get_easyocr():
    global _easy_ocr
    if _easy_ocr is None:
        reg = get_registry()
        reg.update("ocr_easyocr", ModuleState.LOADING, "กำลังโหลด EasyOCR model...")
        import easyocr
        import torch
        gpu = torch.cuda.is_available()
        _easy_ocr = easyocr.Reader(["en"], gpu=gpu)
        reg.update("ocr_easyocr", ModuleState.IDLE,
                   f"พร้อมใช้งาน (GPU: {gpu})")
    return _easy_ocr


def _clean(text: str) -> str:
    return text.replace("\n", " ").replace("\r", " ").strip()


def _is_dup(text: str, existing: list[TextBlock]) -> bool:
    lo = text.lower()
    return any(fuzz.ratio(b["text"].lower(), lo) > 85 for b in existing)


def _render_page(pdf_bytes: bytes, page_num: int = 0) -> tuple[np.ndarray, float]:
    doc = fitz.open("pdf", pdf_bytes)
    page = doc.load_page(page_num)
    w = page.rect.width
    zoom = 1.5 if w < 800 else (1500 / w if w > 1500 else 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    del pix
    gc.collect()
    return img, zoom


def _tesseract_blocks(pdf_bytes: bytes) -> list[TextBlock]:
    import pytesseract
    from pytesseract import Output
    img, zoom = _render_page(pdf_bytes)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    data = pytesseract.image_to_data(img_rgb, config="--psm 11 --oem 3",
                                     output_type=Output.DICT)
    del img, img_rgb
    gc.collect()
    blocks: list[TextBlock] = []
    for i in range(len(data["text"])):
        text = _clean(data["text"][i])
        conf = int(data["conf"][i])
        if conf < 40 or not text:
            continue
        x, y = data["left"][i] / zoom, data["top"][i] / zoom
        w, h = data["width"][i] / zoom, data["height"][i] / zoom
        blocks.append(TextBlock(text=text, x0=x, y0=y,
                                x1=x + w, y1=y + h, page=0, source="tesseract"))
    return blocks


def extract_text_blocks(pdf_bytes: bytes, use_ai: bool = True) -> list[TextBlock]:
    """Run OCR fallback chain with real-time status updates."""
    file_hash = hashlib.md5(pdf_bytes).hexdigest()
    if file_hash in _ocr_cache:
        return _ocr_cache[file_hash]

    threshold = settings.OCR_THRESHOLD
    reg = get_registry()
    blocks: list[TextBlock] = []

    # ── Stage 1: PDFMiner ──────────────────────────────────────────────────
    t0 = time.time()
    reg.update("ocr_pdfminer", ModuleState.RUNNING, "กำลังอ่าน native text...")
    try:
        laparams = LAParams(line_margin=0.5, word_margin=0.1, char_margin=2.0)
        for page_num, page_layout in enumerate(
            extract_pages(io.BytesIO(pdf_bytes), laparams=laparams)
        ):
            for el in page_layout:
                if isinstance(el, LTTextBox):
                    text = _clean(el.get_text())
                    if text:
                        blocks.append(TextBlock(
                            text=text, x0=el.x0, y0=el.y0,
                            x1=el.x1, y1=el.y1, page=page_num, source="pdfminer"
                        ))
        elapsed = int((time.time() - t0) * 1000)
        reg.update("ocr_pdfminer", ModuleState.SUCCESS,
                   f"พบ {len(blocks)} blocks", duration_ms=elapsed,
                   delta_count=len(blocks))
    except Exception as exc:
        reg.update("ocr_pdfminer", ModuleState.ERROR, str(exc))

    if not use_ai or len(blocks) >= threshold:
        _ocr_cache[file_hash] = blocks
        return blocks

    # ── Stage 2: Tesseract ─────────────────────────────────────────────────
    if _check_tesseract():
        t0 = time.time()
        reg.update("ocr_tesseract", ModuleState.RUNNING,
                   "กำลัง scan ด้วย Tesseract...")
        try:
            new_blocks = [b for b in _tesseract_blocks(pdf_bytes)
                          if not _is_dup(b["text"], blocks)]
            blocks.extend(new_blocks)
            elapsed = int((time.time() - t0) * 1000)
            reg.update("ocr_tesseract", ModuleState.SUCCESS,
                       f"เพิ่มอีก {len(new_blocks)} blocks",
                       duration_ms=elapsed, delta_count=len(new_blocks))
        except Exception as exc:
            reg.update("ocr_tesseract", ModuleState.ERROR, str(exc))

    if len(blocks) >= threshold:
        _ocr_cache[file_hash] = blocks
        return blocks

    # ── Stage 3: EasyOCR ───────────────────────────────────────────────────
    t0 = time.time()
    reg.update("ocr_easyocr", ModuleState.RUNNING,
               "กำลัง scan ด้วย EasyOCR (Neural)...")
    try:
        img, zoom = _render_page(pdf_bytes)
        new_blocks = 0
        for bbox, text, conf in _get_easyocr().readtext(img):
            text = _clean(text)
            if conf > 0.4 and text and not _is_dup(text, blocks):
                xs = [p[0] / zoom for p in bbox]
                ys = [p[1] / zoom for p in bbox]
                blocks.append(TextBlock(
                    text=text, x0=min(xs), y0=min(ys),
                    x1=max(xs), y1=max(ys), page=0, source="easyocr"
                ))
                new_blocks += 1
        del img
        gc.collect()
        elapsed = int((time.time() - t0) * 1000)
        reg.update("ocr_easyocr", ModuleState.SUCCESS,
                   f"เพิ่มอีก {new_blocks} blocks",
                   duration_ms=elapsed, delta_count=new_blocks)
    except Exception as exc:
        reg.update("ocr_easyocr", ModuleState.ERROR, str(exc))

    _ocr_cache[file_hash] = blocks
    return blocks
