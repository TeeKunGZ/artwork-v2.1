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

**⚠️ IMPORTANT: ใช้ HTML5 `<dialog>` + `showModal()` สำหรับ modal ใหม่เสมอ**

โปรเจกต์นี้มี nested stacking contexts หลายชั้น (body flex + main relative + cropModal z-50 ฯลฯ) ทำให้ z-index modal มัก fail แบบเงียบ → ใช้ browser top-layer แทน

```html
<!-- HTML -->
<dialog id="myModal">
    <div class="...">
        <!-- modal content -->
    </div>
</dialog>
```

```css
/* CSS - override UA defaults + style backdrop */
dialog#myModal {
    padding: 0; border: 1px solid #e2e8f0; border-radius: 1rem;
    background: #ffffff; max-width: 32rem; width: calc(100% - 2rem);
}
dialog#myModal::backdrop {
    background-color: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
}
```

```javascript
// JS - ใช้ showModal() / close() แทน hidden class
function openModal(id) {
    const dlg = document.getElementById(id);
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", ""); // legacy fallback
}
function closeModal(id) {
    const dlg = document.getElementById(id);
    if (typeof dlg.close === "function" && dlg.open) dlg.close();
    else dlg.removeAttribute("open");
}

// Click backdrop → close (เช็คจากพิกัดคลิก)
modal.addEventListener("click", (e) => {
    if (e.target !== modal) return;
    const r = modal.getBoundingClientRect();
    const inside = r.top<=e.clientY && e.clientY<=r.bottom && r.left<=e.clientX && e.clientX<=r.right;
    if (!inside) closeModal(modal.id);
});
```

**Benefit:** Esc key, focus trap, top-layer rendering = ฟรีหมด — ไม่ต้องเขียน listener เอง

**Legacy `<div>` modal pattern** (ใช้ใน customDialogOverlay เดิม — อย่าใช้กับของใหม่):
```javascript
function openDivModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeDivModal(id) { document.getElementById(id).classList.add('hidden'); }
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

## ⚠️ Tailwind Compile Caveat — IMPORTANT

Tailwind v3 ใน project นี้ทำ **tree-shaking ตอน build** → class ที่ไม่อยู่ใน HTML/JS source ตอน `npm run build:css` จะ **ไม่อยู่ใน `css/output.css`** ใช้ runtime ไม่ได้

### Rules
1. **อย่าสร้าง class ด้วย string concat ใน JS** เช่น
   ```js
   btn.className = `bg-${color}-100`;  // ❌ scanner หาไม่เจอ
   ```
   ใช้ literal mapping แทน:
   ```js
   const COLORS = { red: "bg-red-100", blue: "bg-blue-100" }; // ✓
   btn.className = COLORS[color];
   ```

2. **ก่อนเพิ่ม class ใหม่** verify ว่า compiled แล้ว:
   ```bash
   grep "bg-stone-100" css/output.css   # ถ้าไม่เจอ → ต้อง rebuild
   ```

3. **Rebuild:** `npm run build:css` (script ใน `package.json`) — สแกน `index.html` + `js/**/*.js` ใหม่ตาม `tailwind.config.js`

4. **ไม่มี npm/node?** เขียน CSS rules ตรงๆ ใน `<style>` block ของ `index.html` แทน — ดูตัวอย่าง `.col-card-{theme}` ใน CSS block (Session 4, 2026-04-28)

### Existing Color Classes (พร้อมใช้)
- `bg-amber-100`, `bg-blue-100`, `bg-emerald-100`, `bg-slate-100/200/300`
- `border-amber-200/300`, `border-blue-200`, `border-emerald-100/200/300`, `border-pink-200`, `border-slate-100/200/300`
- `text-amber-700/800`, `text-blue-700`, `text-emerald-700/800/900`, `text-slate-300/700/800`

(ตรวจ `grep -oE "(bg|text|border)-[a-z]+-[0-9]+" css/output.css | sort -u` ก่อนใช้)

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