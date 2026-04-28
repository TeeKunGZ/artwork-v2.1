# Debugging & Troubleshooting

## ⚠️ IMPORTANT: Read memories before implementing!

> See: [project-notes.md](project-notes.md) for workflow requirement

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