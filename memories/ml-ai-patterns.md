# ML/AI Patterns (PyTorch + OpenCV)

## ⚠️ IMPORTANT: Read memories before implementing!

> See: [project-notes.md](project-notes.md) for workflow requirement

## Image Classification (ResNet18 + FAISS)

### 1. Feature Extraction
```python
import torch
import torchvision.models as models
from torchvision import transforms

# Load pretrained ResNet18
model = models.resnet18(weights='IMAGENET1K_V1')
model = torch.nn.Sequential(*list(model.children())[:-1])  # Remove FC layer
model.eval()

# Preprocessing
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def extract_features(image):
    img_tensor = transform(image).unsqueeze(0)
    with torch.no_grad():
        features = model(img_tensor)
    return features.squeeze().numpy()
```

### 2. FAISS Index
```python
import faiss
import numpy as np

# Create index
dimension = 512  # ResNet18 output dimension
index = faiss.IndexFlatL2(dimension)

# Add features
features = np.array([extract_features(img) for img in images]).astype('float32')
index.add(features)

# Search
distances, indices = index.search(query_features.reshape(1, -1), k=5)
```

### 3. Training
```python
def train_classifier(dataset_path):
    images, labels = load_dataset(dataset_path)
    features = [extract_features(img) for img in images]
    
    # Build index
    index = faiss.IndexFlatL2(512)
    features_array = np.array(features).astype('float32')
    index.add(features_array)
    
    # Save
    faiss.write_index(index, 'classifier.index')
```

## Image Processing (OpenCV)

### 1. GrabCut (Auto Crop)
```python
import cv2
import numpy as np

def auto_crop(image_path):
    img = cv2.imread(image_path)
    h, w = img.shape[:2]
    
    # Initial rectangle (5% border)
    rect = (int(w*0.05), int(h*0.05), int(w*0.95), int(h*0.95))
    
    # GrabCut
    mask = np.zeros(img.shape[:2], np.uint8)
    bgdModel = np.zeros((1, 65), np.float64)
    fgdModel = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, rect, bgdModel, fgdModel, 3, cv2.GC_INIT_WITH_RECT)
    
    # Create binary mask
    mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
    
    return img * mask2[:, :, np.newaxis]
```

### 2. Connected Components (Object Detection)
```python
def detect_objects(mask):
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    boxes = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w > 20 and h > 20:  # Filter small noise
            boxes.append((x, y, w, h))
    
    # NMS (Non-Maximum Suppression)
    boxes = nms(boxes, 0.3)
    return boxes
```

### 3. Morphology
```python
def clean_mask(mask):
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel)
    return mask
```

## OCR Pipeline

### 3-Stage Pipeline
```python
def ocr_pipeline(file_path):
    # Stage 1: PDFMiner (fast, native text)
    text = extract_native_text(file_path)
    if is_sufficient(text):
        return text
    
    # Stage 2: Tesseract (vector text)
    text = tesseract_ocr(file_path)
    if is_sufficient(text):
        return text
    
    # Stage 3: EasyOCR (neural fallback)
    text = easyocr_ocr(file_path)
    return text
```

## Dependencies
```txt
torch
torchvision
faiss-cpu
opencv-python
numpy
Pillow
```

## Common Issues

| Issue | Solution |
|-------|----------|
| CUDA out of memory | Use `torch.no_grad()` + batch processing |
| FAISS index corruption | Rebuild index from source images |
| GrabCut slow | Reduce image size first |
| EasyOCR timeout | Set timeout parameter |