"""
AI Classifier — ResNet18 + FAISS IndexFlatIP
torch/torchvision imported lazily to prevent startup crash.
All state changes reported to AIStatusRegistry for real-time monitoring.
"""
from __future__ import annotations

import gc
import io
import json
import os
import threading
import time

import numpy as np

from app.config import settings
from app.services.ai_status import get_registry, ModuleState

FAISS_INDEX_FILE = "/app/data/faiss_index.bin"
FAISS_LABEL_FILE = "/app/data/faiss_labels.json"
DATASET_DIR = "dataset"


class FeatureExtractor:
    def __init__(self) -> None:
        reg = get_registry()
        reg.update("resnet18", ModuleState.LOADING, "กำลังโหลด ResNet18...")

        import torch
        import torch.nn as nn
        from torchvision import models, transforms

        weights = models.ResNet18_Weights.DEFAULT
        base = models.resnet18(weights=weights)
        self.model = nn.Sequential(*list(base.children())[:-1])
        self.model.eval()

        self.preprocess = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else
            "cpu"
        )
        self.model.to(self.device)
        self._torch = torch
        self._index = None
        self._labels: list[str] = []

        reg.update("resnet18", ModuleState.IDLE,
                   f"พร้อมใช้งาน (device: {self.device})")

        # Check if FAISS index already exists
        if os.path.exists(FAISS_INDEX_FILE):
            try:
                self._load_index()
                reg.update("faiss_index", ModuleState.IDLE,
                           f"โหลด index แล้ว ({len(self._labels)} samples)")
            except Exception:
                reg.update("faiss_index", ModuleState.NOT_READY,
                           "มีไฟล์ index แต่โหลดไม่สำเร็จ")
        else:
            reg.update("faiss_index", ModuleState.NOT_READY,
                       "ยังไม่มี index — กด Train AI ก่อน")

    def extract_vector(self, image_bytes: bytes) -> np.ndarray | None:
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            tensor = self.preprocess(img).unsqueeze(0).to(self.device)
            with self._torch.no_grad():
                vec = self.model(tensor).cpu().numpy().flatten()
            norm = np.linalg.norm(vec)
            return (vec / norm).astype(np.float32) if norm > 0 else None
        except Exception as exc:
            print(f"[AI] extract_vector error: {exc}")
            return None

    def build_index(self) -> dict:
        import faiss
        reg = get_registry()

        if not os.path.exists(DATASET_DIR):
            reg.update("ai_train", ModuleState.ERROR, "ไม่พบโฟลเดอร์ dataset")
            return {"status": "error", "message": "ไม่พบโฟลเดอร์ dataset"}

        reg.update("ai_train", ModuleState.RUNNING, "กำลังอ่านรูปภาพจาก dataset...")
        reg.update("faiss_index", ModuleState.LOADING, "กำลังสร้าง index ใหม่...")
        start = time.time()

        vectors: list[np.ndarray] = []
        labels: list[str] = []
        all_classes = [d for d in sorted(os.listdir(DATASET_DIR))
                       if os.path.isdir(os.path.join(DATASET_DIR, d))]
        total_files = sum(
            len([f for f in os.listdir(os.path.join(DATASET_DIR, d))
                 if f.lower().endswith((".png", ".jpg", ".jpeg"))])
            for d in all_classes
        )
        processed = 0

        for label in all_classes:
            class_dir = os.path.join(DATASET_DIR, label)
            reg.update("ai_train", ModuleState.RUNNING,
                       f"กำลังประมวลผล: {label}",
                       progress=int(processed / max(total_files, 1) * 100))
            for fname in os.listdir(class_dir):
                if not fname.lower().endswith((".png", ".jpg", ".jpeg")):
                    continue
                with open(os.path.join(class_dir, fname), "rb") as f:
                    vec = self.extract_vector(f.read())
                if vec is not None:
                    vectors.append(vec)
                    labels.append(label)
                processed += 1

        if not vectors:
            reg.update("ai_train", ModuleState.ERROR, "ไม่พบรูปภาพใน dataset")
            reg.update("faiss_index", ModuleState.NOT_READY, "ไม่มีรูปใน dataset")
            return {"status": "error", "message": "ไม่พบรูปภาพใน dataset"}

        reg.update("ai_train", ModuleState.RUNNING,
                   f"กำลังสร้าง FAISS index จาก {len(labels)} รูป...", progress=90)

        dim = vectors[0].shape[0]
        index = faiss.IndexFlatIP(dim)
        index.add(np.vstack(vectors))
        faiss.write_index(index, FAISS_INDEX_FILE)
        with open(FAISS_LABEL_FILE, "w", encoding="utf-8") as f:
            json.dump(labels, f)

        self._index = index
        self._labels = labels
        gc.collect()

        elapsed = int((time.time() - start) * 1000)
        reg.update("ai_train", ModuleState.SUCCESS,
                   f"สร้าง index เสร็จแล้ว ({len(labels)} รูป)",
                   progress=100, duration_ms=elapsed)
        reg.update("faiss_index", ModuleState.IDLE,
                   f"พร้อมใช้งาน — {len(labels)} samples",
                   duration_ms=elapsed, delta_count=len(labels))
        print(f"[AI] Index built — {len(labels)} samples in {elapsed}ms")
        return {"status": "success", "trained_items": len(labels)}

    def _load_index(self) -> None:
        if self._index is not None:
            return
        import faiss
        if not os.path.exists(FAISS_INDEX_FILE):
            raise FileNotFoundError("AI ยังไม่ได้ Train (ไม่มีไฟล์ Index)")
        self._index = faiss.read_index(FAISS_INDEX_FILE)
        with open(FAISS_LABEL_FILE, encoding="utf-8") as f:
            self._labels = json.load(f)

    def predict(self, image_bytes: bytes, threshold: float | None = None) -> dict:
        if threshold is None:
            threshold = settings.AI_THRESHOLD

        reg = get_registry()
        start = time.time()
        reg.update("ai_predict", ModuleState.RUNNING, "กำลังทำนาย column...")

        try:
            self._load_index()
        except FileNotFoundError as exc:
            reg.update("ai_predict", ModuleState.NOT_READY, str(exc))
            return {"status": "error", "message": str(exc)}

        vec = self.extract_vector(image_bytes)
        if vec is None:
            reg.update("ai_predict", ModuleState.ERROR, "อ่านภาพไม่สำเร็จ")
            return {"status": "error", "message": "อ่านภาพไม่สำเร็จ"}

        scores, indices = self._index.search(vec.reshape(1, -1), k=1)
        best_score = float(scores[0][0])
        best_idx = int(indices[0][0])
        if best_idx < 0 or best_idx >= len(self._labels):
            reg.update("ai_predict", ModuleState.ERROR, "FAISS returned invalid index")
            return {"status": "error", "message": "FAISS returned invalid index"}
        best_label = self._labels[best_idx]
        elapsed = int((time.time() - start) * 1000)

        if best_score < threshold:
            reg.update("ai_predict", ModuleState.SUCCESS,
                       f"ผลลัพธ์: Unknown ({best_score:.2f})",
                       duration_ms=elapsed, delta_count=1)
            return {"status": "success", "label": "Unknown", "confidence": best_score}

        reg.update("ai_predict", ModuleState.SUCCESS,
                   f"ทำนาย: {best_label} ({best_score:.0%})",
                   duration_ms=elapsed, delta_count=1)
        return {"status": "success", "label": best_label, "confidence": best_score}


# ── Lazy singleton ────────────────────────────────────────────────────────────
_instance: FeatureExtractor | None = None
_instance_lock = threading.Lock()


def get_ai_classifier() -> FeatureExtractor:
    global _instance
    if _instance is None:
        with _instance_lock:
            if _instance is None:
                print("[AI] Loading ResNet18...")
                _instance = FeatureExtractor()
                print("[AI] ResNet18 + FAISS ready")
    return _instance