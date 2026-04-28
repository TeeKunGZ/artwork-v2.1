# Frontend Patterns (Vanilla JS + Tailwind)

## ⚠️ IMPORTANT: Read memories before implementing!

> See: [project-notes.md](project-notes.md) for workflow requirement

## Project Structure
```
js/
├── api.js          # API calls (fetchWithAuth)
├── state.js        # Global state management
├── ui.js           # UI rendering
├── app.js          # Event listeners
├── upload.js       # File upload handling
├── cropper-tool.js # Image cropping
└── export.js        # Export functionality
```

## Key Patterns

### 1. State Management
```javascript
// js/state.js
const state = {
    currentUser: null,
    teams: [],
    items: [],
    columns: [],
    isAdmin: false
};

function updateState(key, value) {
    state[key] = value;
    render();
}
```

### 2. Auth Fetch
```javascript
// js/api.js
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    if (res.status === 401) {
        // Handle token expiry
        window.location.href = '/';
    }
    return res;
}
```

### 3. Modal Handling
```javascript
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}
```

### 4. File Upload
```javascript
async function handleUpload(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetchWithAuth('/api/upload', {
        method: 'POST',
        body: formData
    });
    return await res.json();
}
```

### 5. Tailwind Classes
- **Layout:** `flex`, `grid`, `grid-cols-2`, `gap-4`
- **Spacing:** `p-4`, `m-2`, `mt-4`, `mb-2`
- **Colors:** `bg-slate-800`, `text-white`, `text-indigo-600`
- **Responsive:** `md:grid-cols-2`, `lg:flex-row`
- **States:** `hover:bg-slate-700`, `focus:ring`, `disabled:opacity-50`

### 6. SSE (Server-Sent Events)
```javascript
// js/ai-monitor.js
const eventSource = new EventSource('/api/ai/status/stream');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateStatusPanel(data);
};
```

## Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Add Authorization header |
| File upload size | Set `MAX_UPLOAD_MB` in backend |
| Image preview | Use `URL.createObjectURL(file)` |
| Large file handling | Use `FormData` + chunked upload |

## CDN Dependencies
```html
<!-- Tailwind -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Cropper.js -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js"></script>

<!-- Font Awesome -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```