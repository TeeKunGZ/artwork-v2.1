# Debugging & Troubleshooting

## ⚠️ IMPORTANT: Read memories before implementing!

> See: [project-notes.md](project-notes.md) for workflow requirement

## Domain-Specific Pitfalls

### Excel image columns must share one backend constant
**Modules:** `app/services/columns.py`, `app/services/excel_writer.py`, `app/routers/core.py`

Frontend `COLUMN_GROUPS` includes 18 image columns:
`N, R, T, V, X, Z, AB, AD, AF, AH, AJ, AL, AN, AP, AS, AV, AX, AZ`.

Do not keep separate ad hoc backend lists. Use `IMAGE_COL_LETTERS` from
`app/services/columns.py` for export and dataset/history validation. If the UI
adds a template image column, update this shared backend constant and add a
focused export test.

### Export must preserve uploaded workbook bytes
**Modules:** `app/routers/export.py`, `app/services/excel_writer.py`

`/api/generate-excel` receives `excel_file` from the frontend. Use those bytes
as the workbook source first so user-uploaded template data is preserved. Only
fall back to server `Templates.xlsx` when no upload is supplied.

### Dataset/history writes need path validation
**Module:** `app/routers/core.py` -> `/api/save-dataset`

Never use request `label` directly as a directory name. Normalize it as an image
column, verify it is in `IMAGE_COL_LETTERS`, validate ITEM ID, and resolve child
paths under `dataset/` and `history_db/` before writing files.

### ⚠️ ITEM ID Deduplication — ห้ามใช้ `fuzz.ratio` กับ ID ที่ share suffix
**Module:** `app/services/parser.py` → `parse_item_records()`

ITEM ID format: `XXXX-XXX-XXX-XXX` (4 segments). หลาย ID ใน .ai เดียวกันมัก share segments หลังเหมือนกัน เช่น:
- `03C3-2GY-SDN-4EB`
- `03AZ-2GY-SDN-4EB`
- `0TAZ-2GY-SDN-4EB`

**ห้าม** ใช้ `thefuzz.fuzz.ratio()` ทำ dedup — `SequenceMatcher` ให้ ratio ~87% กับ ID ที่ต่างแค่ 2 ตัวแต่ suffix เหมือน 12 ตัว → false positive ตัด ID ที่ต่างกันทิ้ง

**ใช้** exact OCR-normalized equality เท่านั้น:
```python
_OCR_CONFUSION = str.maketrans({"O": "0", "I": "1", "L": "1"})
def _norm(s): return s.upper().translate(_OCR_CONFUSION)
# dedup: if _norm(rid) in seen_norm: skip
```

ITEM ID เป็น precise code — ต่างแค่ 1 ตัว = คนละชิ้นจริงๆ อย่าใช้ similarity threshold

**อย่าขยาย OCR confusion map** ไปถึง S↔5, B↔8, G↔6, Z↔2 โดยไม่จำเป็น — ตัวอักษรเหล่านี้เป็น character ของ ID จริง การ normalize อาจตัด ID ที่ legit ออก (เช่น `XYZ` กับ `XY2` จะถูก dedup ผิด)

---

## Python Issues

### 1. Import Errors
```bash
# Check Python version (must be 3.11 for torch)
python --version

# Verify virtual environment
which python

# Reinstall dependencies
pip install -r requirements.txt
```

### 2. pydantic_settings ValidationError
```
pydantic_core._pydantic_core.ValidationError: 1 validation error for Settings
SECRET_KEY
  Field required [type=missing, input_value={}, input_type=dict]
```
**Solution:** Create `.env` file with required fields:
```env
SECRET_KEY=your-secret-key-here
```

### 3. Module Not Found
```bash
# Check PYTHONPATH
echo $PYTHONPATH

# Add project to path
export PYTHONPATH="${PYTHONPATH}:/path/to/project"
```

### 4. Database Locked
```python
# In config.py, use check_same_thread=False
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)
```

## Frontend Issues

### 1. CORS Errors
```javascript
// Add Authorization header
headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
}
```

### 2. Token Expired
```javascript
if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/';
}
```

### 3. Image Not Loading
```javascript
// Use createObjectURL for preview
const url = URL.createObjectURL(file);
document.getElementById('preview').src = url;

// Clean up
URL.revokeObjectURL(url);
```

## ML/AI Issues

### 1. CUDA Out of Memory
```python
# Use no_grad and move to CPU
with torch.no_grad():
    features = model(img.to('cpu'))
```

### 2. FAISS Index Not Found
```python
# Rebuild index
index = faiss.IndexFlatL2(512)
# Add features and save
faiss.write_index(index, 'classifier.index')
```

### 3. Tesseract Not Found
```python
# Set path in .env
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe

# Or install tesseract
# Windows: winget install UB-Mannheim.tesseract
# macOS: brew install tesseract
```

## Docker Issues

### 1. Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :8000

# Kill process
taskkill /PID <pid> /F
```

### 2. Volume Permissions
```dockerfile
# Add to Dockerfile
RUN mkdir -p /app/data && chown -R app:app /app
```

### 3. Build Cache
```bash
# Rebuild without cache
docker build --no-cache -t app:latest .
```

## Database Issues

### 1. Reset Database
```bash
# Delete SQLite file
rm artportal.db

# Restart server (will recreate)
python server.py
```

### 2. View Database
```bash
# Using sqlite3
sqlite3 artportal.db

# Or use DB Browser
# https://sqlitebrowser.org/
```

## Quick Debug Commands
```bash
# Check environment
python -c "import sys; print(sys.path)"

# Check installed packages
pip list

# Test import
python -c "from app.config import settings; print(settings.SECRET_KEY)"

# Check file exists
python -c "import os; print(os.path.exists('.env'))"
```

## Log Locations
- **Server logs:** Terminal output
- **Database:** `artportal.db` (SQLite)
- **Uploads:** `./uploads/` directory
- **Exports:** `./exports/` directory

## Excel Merge Issues

### 1. Merge output missing imported rows
- Check imported workbook first sheet and confirm ITEM_ID exists in column `D`, starting at row 2.
- Blank ITEM_ID rows and duplicate ITEM_ID rows are intentionally skipped.
- Use the response headers `X-Merge-Added`, `X-Merge-Skipped`, and `X-Merge-Errors` to confirm behavior.

### 2. Merge output missing images
- Images are copied only when the image anchor starts on the copied source row.
- Floating images or images anchored to header/blank rows may not be copied.
- OpenPyXL image anchors are most reliable after saving and reloading the workbook.

### 3. Unit test discovery
- `python -m unittest` currently discovers 0 tests in this repo.
- Use `python -m unittest discover -s tests` for the full local suite.
