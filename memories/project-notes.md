# Project Notes

## ⚠️ WORKFLOW REQUIREMENT

**ก่อนเริ่ม implement งานใหม่ทุกครั้ง — ต้องอ่าน memories ก่อนเสมอ!**

**หลังจาก implement หรือแก้ไขอะไรเสร็จ — ต้อง update memories เสมอ!**

```bash
# ก่อนเริ่มทำงาน
# → อ่าน memories เพื่อโหลด patterns และ best practices

# หลังทำเสร็จ
# → บันทึกสิ่งที่เรียนรู้ลง memories
```

## 📋 Memory Files

| File | Description |
|------|-------------|
| `fastapi-patterns.md` | FastAPI patterns (settings, DB init, JWT auth, SSE) |
| `frontend-patterns.md` | Frontend patterns (state, auth fetch, modal, Tailwind) |
| `ml-ai-patterns.md` | ML/AI patterns (ResNet18, FAISS, GrabCut, OCR pipeline) |
| `deployment-patterns.md` | Docker & production deployment |
| `debugging.md` | Debugging & troubleshooting guide |

## Current Project: ArtPortal v2

**Description:** Garment Artwork Processing & Export System

**Tech Stack:**
- Backend: FastAPI, SQLAlchemy, PyJWT
- ML/AI: PyTorch (ResNet18), FAISS, OpenCV
- OCR: PDFMiner, Tesseract, EasyOCR
- Frontend: Vanilla JS, Tailwind CSS, Cropper.js
- Database: SQLite / PostgreSQL

**Key Features:**
- OCR Pipeline for .ai files (PDFMiner → Tesseract → EasyOCR)
- ITEM ID parser (XXXX-XXX-XXX-XXX → Style/CW/ORG_CODE auto-split)
- Manual record entry (กรอกเอง กรณี OCR อ่านผิด/ไม่ครบ) + per-record delete
- Crop Tool with Auto Crop (GrabCut)
- AI Classifier (ResNet18 + FAISS)
- Auto-mapping จากประวัติ (history_db/) — ถ้า ITEM ID เดิมเคยทำ จะดึงรูปเก่ามาใช้ซ้ำ
- Column grouping UI (Garment / Print / Direct EMB / Patch+EMB around / Fabric applique / Heat logo)
- Excel Export with embedded images (18 image columns: N, R/T/V/X, Z/AB/AD/AF, AH/AJ/AL/AN, AP/AS, AV/AX/AZ)
- ZIP Export
- Multi-user with JWT Auth

## Project-Specific Notes

### File Structure
```
artwork-v2.1/
├── server.py              # Entry point
├── Templates.xlsx        # Excel template (required)
├── .env                  # Configuration
├── app/
│   ├── config.py         # Settings
│   ├── dependencies.py   # Auth
│   ├── db/               # Database
│   ├── routers/         # API endpoints
│   └── services/        # Business logic
└── js/                   # Frontend
```

### First Run
1. Create `.env` file
2. Run `python server.py`
3. Admin credentials printed to terminal
4. emp_id: `admin01`

### API Endpoints
- `/api/login` - Auth
- `/api/me` - Current user
- `/api/extract-ai` - OCR
- `/api/auto_detect` - GrabCut
- `/api/ai/train` - Train classifier
- `/api/ai/predict` - Predict
- `/api/generate-excel` - Export
- `/api/generate-zip` - Export

## Future Projects

### Ideas
1. [ ] Add image compression before export
2. [ ] Add batch processing for multiple files
3. [ ] Add webhook for external integrations
4. [ ] Add audit logging
5. [ ] Add API rate limiting

## Lessons Learned

### What Worked
- 3-stage OCR pipeline (PDFMiner → Tesseract → EasyOCR)
- GrabCut for auto crop
- FAISS for fast similarity search
- SSE for real-time status updates

### What to Improve
- Add more error handling
- Add unit tests
- Add API documentation (Swagger)
- Add database migrations