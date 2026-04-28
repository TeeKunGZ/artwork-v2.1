# Deployment Patterns (Docker + Production)

## ⚠️ IMPORTANT: Read memories before implementing!

> See: [project-notes.md](project-notes.md) for workflow requirement

## Docker Setup

### 1. Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["python", "server.py"]
```

### 2. docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./Templates.xlsx:/app/Templates.xlsx
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=sqlite:///./data/artportal.db
    restart: unless-stopped
```

### 3. .dockerignore
```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
venv/
.venv/
*.db
.env
.git/
node_modules/
```

## Production Checklist

### 1. Environment Variables
```bash
# Generate secure SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# .env file
SECRET_KEY=<generated-key>
DATABASE_URL=postgresql://user:password@db:5432/artportal
HOST=0.0.0.0
PORT=8000
```

### 2. Security
- [ ] Change default admin password
- [ ] Use HTTPS in production
- [ ] Set proper CORS origins
- [ ] Enable rate limiting
- [ ] Use strong JWT secret

### 3. Database
- [ ] Use PostgreSQL for production
- [ ] Set up database backup
- [ ] Configure connection pooling

### 4. Monitoring
- [ ] Add logging (structlog)
- [ ] Set up health check endpoint
- [ ] Configure error tracking (Sentry)

## Common Commands
```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild
docker-compose build --no-cache
```

## Nginx Reverse Proxy (Production)
```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static {
        alias /app/static;
    }
}
```