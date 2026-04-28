# FastAPI Project Patterns

## ⚠️ IMPORTANT: Read memories before implementing!

> See: [project-notes.md](project-notes.md) for workflow requirement

## Project Structure
```
project/
├── server.py              # Entry point
├── app/
│   ├── config.py          # Settings (pydantic-settings)
│   ├── dependencies.py    # Auth dependencies
│   ├── db/
│   │   ├── base.py       # SQLAlchemy engine + init
│   │   ├── models.py     # ORM models
│   │   └── crud.py       # Database operations
│   └── routers/          # API endpoints
│   └── services/         # Business logic
├── js/                   # Frontend JS
└── templates/            # HTML templates
```

## Key Patterns

### 1. Settings with pydantic-settings
```python
# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
    
    SECRET_KEY: str  # Required - no default
    DATABASE_URL: str = "sqlite:///./app.db"
```

### 2. Database Init with Seed Data
```python
# app/db/base.py
def _seed_defaults():
    """Insert default admin user on first run."""
    from app.db.models import User
    import secrets
    
    default_pw = secrets.token_urlsafe(16)
    # Create admin user
    print(f"[INIT] Default admin created — emp_id=admin01  password={default_pw}")
```

### 3. JWT Auth Dependencies
```python
# app/dependencies.py
from fastapi import Depends
from fastapi.security import HTTPBearer
from jose import JWTError, jwt

security = HTTPBearer()

def get_current_user(token: str = Depends(security)):
    # Decode JWT and return user
    pass
```

### 4. SSE (Server-Sent Events)
```python
# For real-time updates
from fastapi.responses import StreamingResponse

@app.get("/api/status/stream")
async def status_stream():
    async def event_generator():
        while True:
            yield f"data: {json.dumps(status)}\n\n"
            await asyncio.sleep(1)
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

## Common Issues

| Issue | Solution |
|-------|----------|
| pydantic_settings ValidationError | Create `.env` file with required fields |
| CORS errors | Add `app.add_middleware(CORSMiddleware, ...)` |
| Static files not loading | Use `app.mount("/", StaticFiles(directory="static"))` |
| Database locked | Use `check_same_thread=False` for SQLite |

## Dependencies
```txt
fastapi
uvicorn
sqlalchemy
pydantic-settings
python-jose[cryptography]
bcrypt
python-multipart
```