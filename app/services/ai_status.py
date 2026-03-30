"""
AI Status Registry — single source of truth for all AI/ML module states.

ทุก module update สถานะตัวเองผ่าน registry นี้
Frontend รับ updates ผ่าน SSE endpoint /api/ai/status/stream
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Callable


class ModuleState(str, Enum):
    IDLE      = "idle"       # โหลดแล้ว รอใช้งาน
    LOADING   = "loading"    # กำลังโหลด model
    RUNNING   = "running"    # กำลังประมวลผล
    SUCCESS   = "success"    # เสร็จสมบูรณ์ (แสดงชั่วคราว แล้วกลับ idle)
    ERROR     = "error"      # เกิด error
    NOT_READY = "not_ready"  # ยังไม่ได้ init (ยังไม่ถูกเรียก)


@dataclass
class ModuleStatus:
    id: str                          # unique key เช่น "resnet18", "ocr_pdfminer"
    label: str                       # ชื่อแสดงผล
    description: str                 # คำอธิบาย
    state: ModuleState = ModuleState.NOT_READY
    message: str = ""                # ข้อความสถานะปัจจุบัน
    progress: int = 0                # 0-100 (ถ้า known)
    last_updated: float = field(default_factory=time.time)
    duration_ms: int = 0             # เวลาที่ใช้ล่าสุด (ms)
    total_processed: int = 0         # จำนวนรวมที่ประมวลผลแล้ว
    group: str = "ai"                # กลุ่ม: "ai" | "ocr" | "system"


class AIStatusRegistry:
    """Thread-safe registry ที่ทุก service update สถานะเข้ามา"""

    def __init__(self):
        self._modules: dict[str, ModuleStatus] = {}
        self._listeners: list[asyncio.Queue] = []
        self._init_defaults()

    def _init_defaults(self):
        defaults = [
            # ── AI/ML Modules ─────────────────────────────────────────────
            ModuleStatus(
                id="resnet18",
                label="ResNet18 Feature Extractor",
                description="โหลด model ResNet18 สำหรับแปลงรูปเป็น vector 512 มิติ",
                group="ai",
            ),
            ModuleStatus(
                id="faiss_index",
                label="FAISS Index",
                description="ค้นหา vector ที่ใกล้เคียงที่สุดใน dataset",
                group="ai",
            ),
            ModuleStatus(
                id="ai_predict",
                label="AI Column Classifier",
                description="ทำนาย column จากรูปที่ตัดมา",
                group="ai",
            ),
            ModuleStatus(
                id="ai_train",
                label="AI Training",
                description="สร้าง FAISS index ใหม่จาก dataset ทั้งหมด",
                group="ai",
            ),
            # ── OCR Modules ───────────────────────────────────────────────
            ModuleStatus(
                id="ocr_pdfminer",
                label="PDFMiner OCR",
                description="Stage 1: อ่าน native text จาก PDF (~50ms)",
                group="ocr",
            ),
            ModuleStatus(
                id="ocr_tesseract",
                label="Tesseract OCR",
                description="Stage 2: อ่าน vector/outlined text (~300ms)",
                group="ocr",
            ),
            ModuleStatus(
                id="ocr_easyocr",
                label="EasyOCR",
                description="Stage 3: Neural OCR fallback (~2-5s)",
                group="ocr",
            ),
            # ── System ────────────────────────────────────────────────────
            ModuleStatus(
                id="cv2_detect",
                label="OpenCV Object Detection",
                description="ตรวจหาชิ้นส่วนใน artboard อัตโนมัติ",
                group="system",
            ),
            ModuleStatus(
                id="excel_export",
                label="Excel Generator",
                description="สร้างไฟล์ Excel พร้อมรูปภาพ",
                group="system",
            ),
        ]
        for m in defaults:
            self._modules[m.id] = m

    # ── Public API ────────────────────────────────────────────────────────
    def update(self, module_id: str, state: ModuleState,
               message: str = "", progress: int = 0,
               duration_ms: int = 0, delta_count: int = 0) -> None:
        """Update module state and broadcast to all SSE listeners."""
        if module_id not in self._modules:
            return
        m = self._modules[module_id]
        m.state = state
        m.message = message
        m.progress = progress
        m.last_updated = time.time()
        if duration_ms:
            m.duration_ms = duration_ms
        if delta_count:
            m.total_processed += delta_count

        self._broadcast()

    def get_all(self) -> list[dict]:
        return [asdict(m) | {"state": m.state.value} for m in self._modules.values()]

    def get_snapshot(self) -> dict:
        """Full snapshot for initial SSE connection."""
        return {
            "type": "snapshot",
            "modules": self.get_all(),
            "ts": time.time(),
        }

    # ── SSE Subscription ──────────────────────────────────────────────────
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._listeners.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._listeners.remove(q)
        except ValueError:
            pass

    def _broadcast(self) -> None:
        snapshot = self.get_snapshot()
        dead = []
        for q in self._listeners:
            try:
                q.put_nowait(snapshot)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)


# ── Singleton ─────────────────────────────────────────────────────────────────
_registry: AIStatusRegistry | None = None


def get_registry() -> AIStatusRegistry:
    global _registry
    if _registry is None:
        _registry = AIStatusRegistry()
    return _registry


# ── Convenience context manager ───────────────────────────────────────────────
import contextlib

@contextlib.contextmanager
def track(module_id: str, running_msg: str = "", success_msg: str = ""):
    """
    Context manager สำหรับ wrap การทำงาน แล้ว update สถานะอัตโนมัติ

    Usage:
        with track("resnet18", "กำลัง extract features...", "สำเร็จ"):
            vec = model(img)
    """
    reg = get_registry()
    start = time.time()
    reg.update(module_id, ModuleState.RUNNING, running_msg or "กำลังทำงาน...")
    try:
        yield
        elapsed = int((time.time() - start) * 1000)
        reg.update(module_id, ModuleState.SUCCESS,
                   success_msg or "เสร็จสมบูรณ์", duration_ms=elapsed)
        # auto-reset to idle after 3s (non-blocking)
        import threading
        def _reset():
            time.sleep(3)
            if reg._modules[module_id].state == ModuleState.SUCCESS:
                reg.update(module_id, ModuleState.IDLE, "")
        threading.Thread(target=_reset, daemon=True).start()
    except Exception as exc:
        elapsed = int((time.time() - start) * 1000)
        reg.update(module_id, ModuleState.ERROR, str(exc), duration_ms=elapsed)
        raise
