# ใช้ Python 3.11 Slim เป็นฐาน (เบาและเสถียร)
FROM python:3.11-slim

# ตั้งค่าตัวแปรสภาพแวดล้อม ป้องกัน Python สร้างไฟล์ .pyc และให้ Print log ทันที
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ติดตั้ง System Dependencies ที่จำเป็นสำหรับ OpenCV และการ Build ไลบรารี
RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# กำหนดโฟลเดอร์ทำงานใน Container
WORKDIR /app

# ก๊อปปี้ requirements.txt มาก่อน เพื่อ Cache Layer การติดตั้งไลบรารี
COPY requirements.txt .

# 🌟 ติดตั้ง PyTorch เวอร์ชัน CPU (ลดขนาด Image)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# ติดตั้งไลบรารีอื่นๆ
# (ถ้าใน requirements.txt มี opencv-python ให้เปลี่ยนเป็น opencv-python-headless จะดีที่สุดสำหรับ Docker)
RUN pip install --no-cache-dir -r requirements.txt

# ก๊อปปี้ Source Code ทั้งหมดลงไป
COPY . .

# สร้างโฟลเดอร์ที่จำเป็น ป้องกัน Error (เผื่อลืม Mount)
RUN mkdir -p dataset history_db data

# สร้าง non-root user เพื่อความปลอดภัย
RUN useradd -m -s /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

# เปิด Port 8502
EXPOSE 8502

# รัน FastAPI ผ่าน Uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8502"]