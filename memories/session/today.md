# Session Notes

## ⚠️ WORKFLOW REQUIREMENT

**ก่อนเริ่ม implement งานใหม่ทุกครั้ง — ต้องอ่าน memories ก่อนเสมอ!**

**หลังจาก implement หรือแก้ไขอะไรเสร็จ — ต้อง update memories เสมอ!**

```bash
# ก่อนเริ่มทำงาน
# → อ่าน memories เพื่อโหลด patterns และ best practices

# หลังทำเสร็จ
# → บันทึกสิ่งที่เรียนรู้ลง memories
```

## 2026-04-28

### Completed Tasks
1. Fixed `.env` missing error - created `.env` file with SECRET_KEY
2. Answered admin password question - auto-generated on first run
3. Created memory files for future projects

### Memory Files Created
- `memories/fastapi-patterns.md` - FastAPI patterns
- `memories/frontend-patterns.md` - Frontend patterns  
- `memories/ml-ai-patterns.md` - ML/AI patterns
- `memories/deployment-patterns.md` - Docker & deployment
- `memories/debugging.md` - Debugging & troubleshooting
- `memories/project-notes.md` - Project notes

### Next Steps
- Run server: `python server.py`
- Login with admin01 + auto-generated password
- Change password immediately

---

## 2026-04-28 (Session 2 — Bug fix + Manual entry)

### Issue Reported
1. ไฟล์ .ai มี ITEM ID 3 records แต่ระบบเจอแค่ 2 records (`03C3-2GY-SDN-4EB`, `0TAZ-2GY-SDN-4EB` — หาย `03AZ-2GY-SDN-4EB`)
2. ขอเพิ่มปุ่ม Add manual ในกรณีระบบอ่านผิดพลาด

### Root Cause (Issue 1)
`app/services/parser.py` ใน `parse_item_records()` ใช้ `fuzz.ratio() >= 85` เป็น dedup fallback
→ `thefuzz` ใช้ `SequenceMatcher` ซึ่งให้ ratio สูงกับ ID ที่ share suffix ยาวเหมือนกัน:
- `03C3-2GY-SDN-4EB` vs `03AZ-2GY-SDN-4EB` → ratio ≈ 87.5% (ต่างแค่ 2 ตัวจาก 16 ตัว แต่ suffix `-2GY-SDN-4EB` 12 ตัวเหมือนกัน) → false positive!
→ ระบบเลยตัด `03AZ-...` ทิ้งโดยเข้าใจผิดว่าเป็นซ้ำ

### Fix Applied
**`app/services/parser.py` (line ~215)** — เปลี่ยน dedup logic:
```python
# OLD (buggy): fuzz.ratio fallback ทำให้ ID ที่ต่างกันถูก dedup
norm_rid = rid.replace("O", "0").replace("I", "1").replace("L", "1")
norm_exist = existing.replace("O", "0").replace("I", "1").replace("L", "1")
if norm_rid == norm_exist or fuzz.ratio(rid, existing) >= 85:
    is_dup = True

# NEW: dedup เฉพาะ exact OCR-normalized equality เท่านั้น
_OCR_CONFUSION = str.maketrans({"O": "0", "I": "1", "L": "1"})
def _norm(s): return s.upper().translate(_OCR_CONFUSION)
seen_norm = set()
for rid in raw_ids:
    n = _norm(rid)
    if n in seen_norm: continue
    seen_norm.add(n)
    ids.append(rid)
```

**Verified:** `parse_item_records` ตอนนี้คืน 3 records ถูกต้อง และยัง dedup OCR confusion (`OTAZ` vs `0TAZ`) ได้

### Manual Entry Feature (Issue 2)
- **HTML modal** [`index.html`] — เพิ่ม `#manualRecordModal` (max-w-lg) + ปุ่ม `#btnAddManualRecord` ตรง header section "Extracted Garment Info"
- **JS handlers** [`js/ui.js`] — เพิ่ม:
  - `openManualRecordModal()` / `closeManualRecordModal()` / `saveManualRecord()` / `deleteManualRecord(idx)`
  - Auto-derive Style/CW/ORG_CODE จาก ITEM ID ผ่าน `_mrUpdateAutoFields()`
  - Validate: รูปแบบ `XXXX-XXX-XXX-XXX`, กันซ้ำ `currentTextData` + `batchTextData`
  - Pre-fill team/color จาก first record เพื่อสะดวก
  - Keyboard: Esc=ปิด, Enter=บันทึก
- **Card UI** [`js/ui.js` `renderTextDataCards`] — เพิ่ม:
  - Manual badge (มุมซ้ายบน) สำหรับ `rec.manual === true`
  - Trash icon (มุมขวาบน, z-10) สำหรับลบ record (เตือนถ้ามี crops ที่ทำไว้)
- Manual records flow ผ่าน `state.currentTextData` → `batchTextData` → final export ตามปกติ (field `manual: true` เป็น metadata เฉยๆ)

### Files Touched
- `app/services/parser.py` (dedup logic)
- `index.html` (modal + button)
- `js/ui.js` (handlers + card delete button + manual badge)

### Lesson Learned (added to debugging.md)
- ห้ามใช้ `fuzz.ratio` กับ ITEM ID ที่ share long suffix — ใช้ exact normalize equality พอ

---

## 2026-04-28 (Session 3 — Manual modal goes behind issue)

### Issue Reported
Modal "เพิ่มข้อมูลเอง" แสดงไปอยู่ด้านหลัง element อื่น user key ข้อมูลไม่ได้

### Root Cause Hypothesis
Modal เดิมเป็น `<div class="fixed inset-0 z-[10400] ...">` พึ่งพา z-index ทั้งหมด — แต่ใน app นี้มี nested stacking contexts หลายชั้น (body flex + main relative + cropModal z-50 ฯลฯ) ทำให้ z-index บางครั้งไม่ทำงานตามที่คาด

### Fix Applied — Use HTML5 `<dialog>` + `showModal()`
**`index.html`** เปลี่ยน `<div id="manualRecordModal">` → `<dialog id="manualRecordModal">`

**Why `<dialog>` ดีกว่า `<div>` สำหรับ modal:**
- `dialog.showModal()` render element บน **browser top-layer** ซึ่งอยู่บนสุดของหน้าจอ **โดยไม่ขึ้นกับ z-index หรือ stacking context** ใดๆ — กัน bug ประเภท "modal ไปอยู่ด้านหลัง" ได้ 100%
- มี `::backdrop` pseudo-element สำหรับ overlay สีดำ — ไม่ต้องสร้าง wrapper div
- Esc key ปิด modal ทำงานเอง (browser native)
- Focus trap ทำงานเอง (focus วนใน modal เท่านั้น)

**CSS ที่เพิ่ม:**
```css
dialog#manualRecordModal {
    padding: 0; border: 1px solid #e2e8f0; border-radius: 1rem;
    background: #ffffff; max-width: 32rem; width: calc(100% - 2rem);
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
}
dialog#manualRecordModal::backdrop {
    background-color: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
}
```

**JS:**
- `openManualRecordModal()` → `dlg.showModal()` (มี fallback `setAttribute("open")`)
- `closeManualRecordModal()` → `dlg.close()` (มี fallback `removeAttribute("open")`)
- ลบ `keydown` listener ระดับ document — ใช้ native cancel event ของ dialog แทน
- Click outside (backdrop): เช็ค `e.target === modal` แล้วดูว่าพิกัดคลิกอยู่นอก bounding rect ของ dialog

### Files Touched
- `index.html` (CSS + dialog markup)
- `js/ui.js` (openManualRecordModal/closeManualRecordModal + click/keydown wiring)

### Lesson Learned
- **ใช้ `<dialog>` + `showModal()` สำหรับ modal เสมอ** ในโปรเจกต์ที่มี nested stacking contexts หลายชั้น
- z-index สงครามไม่จบ — top layer คือคำตอบ
- ถ้าจำเป็นต้องใช้ `<div>` modal (เช่น ต้อง support browser เก่ามาก) ให้ append เข้า `document.body` ตอนเปิด เพื่อหนีจาก parent stacking context

---

## 2026-04-28 (Session 4 — Group Target Column UI + เพิ่ม AJ, AN)

### Issue Reported
"Select Target Column" แสดง column letters (N, R, T, ...) เป็นป้ายตัวใหญ่ — ผู้ใช้อยากให้:
1. **จับกลุ่ม** column ตาม category (Garment / Print / Direct EMB / Patch / Fabric applique / Heat logo) สีต่างกัน
2. **ลบ** ตัว A, B, C ออก แสดงเฉพาะชื่อ cell (Garment Image, Print No.1 ฯลฯ)

### Discovery
ตรวจ Templates.xlsx แล้วพบว่า column **AJ "Direct EMB around Patch No.1"** และ **AN "Direct EMB around Patch No.2"** มีอยู่ในไฟล์แต่ **ขาดหายไปจาก IMAGE_COLUMNS** ทั้งที่ user เห็นในรูปกลุ่ม Patch — ถูกเพิ่มกลับเข้า list ในรอบนี้ด้วย

### Changes Applied

**`js/state.js`**
- เปลี่ยนจาก flat `IMAGE_COLUMNS` array เป็น nested `COLUMN_GROUPS` ที่มี `theme` + `cols[{col, short}]`
- 6 groups: Garment(amber) / Print(blue) / Direct EMB(stone) / Patch+EMB around(emerald) / Fabric applique(pink) / Heat logo(slate)
- เพิ่ม `AJ` และ `AN` เข้า list (ขาดหายมาก่อน)
- `IMAGE_COLUMNS` ตอนนี้ derive จาก `COLUMN_GROUPS.flatMap(...)` (backward-compat กับ legacy callers เช่น keyboard shortcut)
- เพิ่ม helper `getColumnShortLabel(col)` คืนชื่อสั้น (e.g., "R" → "Print No.1")

**`index.html`**
- `<style>` block เพิ่ม CSS รุ่น self-contained สำหรับ 6 themes (`.col-card-amber`, `.col-card-blue`, ...) และ `#columnButtonGroup` grid layout
  - **เหตุผล:** ไม่ได้ install npm/node ที่เครื่องนี้ → run `npm run build:css` ไม่ได้ → ใช้ Tailwind classes ใหม่ๆ ที่ไม่มีใน `output.css` ไม่ได้
  - แก้โดยเขียน CSS rules ตรงๆ เป็น literal classes
- `.col-card.selected` แก้ให้คง theme bg ของกลุ่ม + เพิ่ม indigo ring + scale up (เดิม override bg เป็น indigo-50)
- Container `<div id="columnButtonGroup">` ลบ Tailwind utility classes ทั้งหมด — ใช้ CSS rules ใน `<style>` แทน
- Grid: 3 cols บน mobile/tablet, 6 cols บน lg+ (1024px+)

**`js/ui.js`**
- `renderAvailableColumns()` iterate `COLUMN_GROUPS` → สร้าง `<div class="col-group-{theme}">` + label + cards
- Cards ใช้ `col-card-base` + `col-card-{theme}` แทน Tailwind utilities
- Card content: kbd badge (1-9) + short label เท่านั้น — ไม่มี col letter อีกแล้ว
- Tooltip บน card ยังแสดง full header + col letter เพื่อ debugging
- `renderMappedItems()` เปลี่ยน "Col R" → "Print No.1" ใช้ `getColumnShortLabel(crop.col)`

### Tailwind Constraint (Important Lesson)
ใน project นี้ Tailwind classes ที่ไม่ได้ปรากฎใน `index.html` หรือ `js/**/*.js` ตอน build จะ **ไม่อยู่ใน `css/output.css`** → ใช้ class ใหม่ runtime ไม่ได้

**Why:** Tailwind v3 ทำ tree-shaking ระหว่าง compile เพื่อลด file size

**How to apply:**
1. ถ้ามี npm/node → `npm run build:css` (script ใน `package.json`) เพื่อ rescan + rebuild
2. ถ้าไม่มี (เช่น production server, สภาพแวดล้อมจำกัด) → เขียน CSS rules ตรงๆ ใน `<style>` block
3. **อย่าใช้ string concatenation สร้าง class ใน JS** เช่น `\`bg-${color}-100\`` — Tailwind regex scanner หาไม่เจอ → จงใช้ literal mapping object หรือ static CSS แทน
4. ถ้าจำเป็นต้องเพิ่ม class ใหม่ใน JS literal — ตรวจ `output.css` ก่อนว่า class นั้นมีอยู่จริง: `grep "bg-pink-100" css/output.css`

### Files Touched
- `js/state.js` — COLUMN_GROUPS + getColumnShortLabel
- `js/ui.js` — renderAvailableColumns + renderMappedItems
- `index.html` — CSS block (themes + grid) + container markup