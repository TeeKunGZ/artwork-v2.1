<div align="center">

<img src="icon.png" width="100" height="100" style="border-radius: 20px" alt="ArtPortal Logo">

# ArtPortal v2

**Garment Artwork Processing & Export System**

ระบบจัดการ Artwork สำหรับ Licensing Submission — OCR อ่านข้อมูลจากไฟล์ `.ai`, Crop โลโก้, Export ลง Excel template พร้อมรูปภาพความละเอียดสูงโดยอัตโนมัติ

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-GrabCut-5C3EE8?style=flat-square&logo=opencv&logoColor=white)](https://opencv.org)
[![PyTorch](https://img.shields.io/badge/PyTorch-ResNet18-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](LICENSE)

</div>

---

## ✨ Features

| Feature | รายละเอียด |
|---|---|
| 📄 **OCR Pipeline** | อ่านข้อมูล Item ID, Style, Team, Color จากไฟล์ `.ai` — 3 Stage: PDFMiner → Tesseract → EasyOCR |
| ✂️ **Crop Tool** | Cropper.js พร้อม Auto Crop (GrabCut), วัดขนาด cm จริง, จำพิกัดล่าสุด |
| 🤖 **AI Classifier** | ResNet18 + FAISS ทำนาย target column จากรูปที่ crop — train เพิ่มได้ในระบบ |
| 📊 **Excel Export** | Embed รูปภาพ full resolution ลง template ตาม column mapping — ไม่ resize pixel |
| 📦 **ZIP Export** | Bundle รูป crop ทั้งหมดพร้อม naming convention สำหรับส่งต่อแผนกอื่น |
| 👁 **AI Monitor** | Real-time status ของทุก module ผ่าน SSE — ResNet18, FAISS, OCR, OpenCV, Excel |
| 👥 **Multi-user** | JWT Auth, Admin panel จัดการ User/Team, บันทึก crop memory ต่อ item |

---

## 🏗 Architecture

```
artportal_v2/
├── server.py                  # Entry point — FastAPI bootstrap
├── Templates.xlsx             # Excel template (วาง ณ root)
├── icon.png                   # App icon
│
├── app/
│   ├── config.py              # Settings จาก .env (pydantic-settings)
│   ├── dependencies.py        # get_current_user, get_admin_user
│   ├── db/
│   │   ├── base.py            # SQLAlchemy engine + session
│   │   ├── models.py          # User, Team, CropMemory ORM
│   │   └── crud.py            # Database operations
│   ├── routers/
│   │   ├── auth.py            # /api/login, /api/me
│   │   ├── admin.py           # /api/admin/users, /api/admin/teams
│   │   ├── core.py            # /api/extract-ai, /api/auto_detect
│   │   ├── ai.py              # /api/ai/train, /api/ai/predict, /api/ai/status/stream
│   │   └── export.py          # /api/generate-excel, /api/generate-zip
│   └── services/
│       ├── parser.py          # Parse item records จาก OCR blocks
│       ├── ocr_pipeline.py    # PDFMiner → Tesseract → EasyOCR fallback chain
│       ├── ai_classifier.py   # ResNet18 + FAISS feature index
│       ├── ai_status.py       # SSE status registry
│       └── excel_writer.py    # Embed images + fill template
│
└── js/
    ├── state.js               # Global state + IMAGE_COLUMNS config
    ├── api.js                 # fetchWithAuth, loadMasterTeams
    ├── ui.js                  # Render cards, columns, mapped items
    ├── upload.js              # File upload, parseExcelHeaders
    ├── cropper-tool.js        # Cropper.js + Auto Crop + AI detect
    ├── export.js              # Generate Excel/ZIP
    ├── app.js                 # Event listeners, AI toggle
    └── ai-monitor.js          # SSE real-time status panel
```

---

## ⚙️ Requirements

- **Python 3.11** (เท่านั้น — Python 3.14 ยัง not supported สำหรับ torch/numpy)
- **Tesseract OCR** (optional แต่แนะนำ)
  - Windows: [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
  - macOS: `brew install tesseract`
  - Linux: `sudo apt install tesseract-ocr`

---

## 🚀 Installation

**1. Clone & setup venv**
```bash
git clone https://github.com/<your-org>/artportal-v2.git
cd artportal-v2

# Windows
py -3.11 -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3.11 -m venv .venv
source .venv/bin/activate
```

**2. Install dependencies**
```bash
pip install -r requirements.txt
```

**3. Configure environment**
```bash
cp .env.example .env
```

แก้ไข `.env`:
```env
SECRET_KEY=your-secret-key-here-change-this

# Optional — ถ้าติดตั้ง Tesseract
# TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

**4. วาง Templates.xlsx**

วางไฟล์ `Templates.xlsx` ไว้ที่ root ของ project (เดียวกับ `server.py`)

**5. Run**
```bash
python server.py
```

เปิด browser ที่ `http://localhost:8000`

---

## 🔑 First-time Setup

1. Login ด้วย admin account เริ่มต้น
2. ไปที่ **Admin → จัดการผู้ใช้งาน** เพิ่ม user
3. ไปที่ **Admin → จัดการชื่อทีม (Master)** เพิ่มทีม
4. ไปที่ **Admin → สั่งเทรน AI** — Train FAISS index ครั้งแรก (ต้องมี dataset ก่อน)

---

## 📋 Workflow

```
1. อัปโหลด Templates.xlsx  →  ระบบอ่าน column headers
2. อัปโหลดไฟล์ .ai         →  OCR สกัด Item ID, Style, Team, Color
3. เลือก Artboard           →  เปิด Crop workspace
4. Crop โลโก้               →  เลือก Target Column → ตัดรูป
5. Export                   →  ได้ Excel พร้อมรูป + ZIP full resolution
```

---

## 🖼 Image Column Mapping

Template columns ที่ระบบ embed รูป (hardcoded ใน `js/state.js`):

| Column | ประเภท |
|--------|--------|
| N | Garment image |
| R, T, V, X | Graphic Print No.1–4 |
| Z, AB, AD, AF | Graphic Direct EMB No.1–4 |
| AH, AL | Graphic Patch No.1–2 |
| AP, AS | Graphic Fabric applique EMB No.1–2 |
| AV, AX, AZ | Heat logo 1–3 |

> **หมายเหตุ:** AW, AY, BA (Heat logo color) เป็น text — user key-in เอง

---

## 🤖 AI System

### Column Classifier (ResNet18 + FAISS)
- Extract 512-dim feature vector จากรูปที่ crop
- ค้นหา nearest neighbor ใน FAISS index
- ทำนาย target column พร้อม confidence score
- Train เพิ่มได้จาก Admin panel ทุกครั้งที่มี dataset ใหม่

### Auto Detect (GrabCut)
- ตัด border 5% ออกก่อน
- GrabCut 3 iterations แยก foreground/background
- Morphology close+dilate เชื่อม pixels ของโลโก้เดียวกัน
- Connected Components → NMS กำจัด bounding box ซ้อนทับ

### OCR Pipeline
```
Stage 1: PDFMiner    ~50ms   อ่าน native text
Stage 2: Tesseract  ~300ms   อ่าน vector/outlined text
Stage 3: EasyOCR    ~2-5s    Neural OCR fallback
```
หยุดที่ stage ที่เจอข้อมูลเพียงพอ — ไม่รัน stage ต่อไปโดยไม่จำเป็น

---

## 🗄 Database

SQLite by default (`artportal.db`) — เปลี่ยนเป็น PostgreSQL ได้โดยแก้ `.env` เท่านั้น:

```env
DATABASE_URL=postgresql://user:password@localhost/artportal
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, PyJWT, bcrypt |
| ML/AI | PyTorch (ResNet18), FAISS, OpenCV |
| OCR | PDFMiner, Tesseract (pytesseract), EasyOCR |
| PDF/Image | PyMuPDF (fitz), Pillow, openpyxl |
| Frontend | Vanilla JS, Tailwind CSS (CDN), Cropper.js, XLSX.js |
| Realtime | Server-Sent Events (SSE) |
| Database | SQLite / PostgreSQL |

---

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | *(required)* | JWT signing key |
| `DATABASE_URL` | `sqlite:///./artportal.db` | Database connection string |
| `TESSERACT_CMD` | *(auto detect)* | Path to Tesseract binary |
| `HOST` | `0.0.0.0` | Server bind host |
| `PORT` | `8000` | Server bind port |

---

<div align="center">

Built with ❤️ for the Licensing & Artwork team

</div>