// =============================================================================
// Zone Painter — Solution B for AI Crop Detection
// =============================================================================

const ZonePainter = (() => {
    let _active      = false;
    let _zones       = [];
    let _drawing     = false;
    let _startX      = 0;
    let _startY      = 0;
    let _overlay     = null;
    let _previewRect = null;
    let _container   = null;
    let _imgEl       = null;
    let _resizeObs   = null;   // BUG1 FIX: เก็บ reference เพื่อ disconnect ได้

    const ZONE_FILL   = "rgba(99,102,241,0.15)";
    const ZONE_STROKE = "#6366f1";
    const ZONE_ACTIVE = "rgba(99,102,241,0.08)";

    // ── coords helpers ────────────────────────────────────────────────────────
    function _toNatural(cx, cy) {
        // BUG2 FIX: Cropper.js transform ทำให้ _imgEl.getBoundingClientRect() ผิด
        // ใช้ cropper canvas rect แทน (cropper render ลงบน canvas ข้างใน)
        const cropperCanvas = _container.querySelector(".cropper-canvas");
        const ref  = cropperCanvas ? cropperCanvas.getBoundingClientRect()
                                   : _imgEl.getBoundingClientRect();
        const cr   = _container.getBoundingClientRect();

        const scaleX = _imgEl.naturalWidth  / ref.width;
        const scaleY = _imgEl.naturalHeight / ref.height;
        const nx = (cx - (ref.left - cr.left)) * scaleX;
        const ny = (cy - (ref.top  - cr.top))  * scaleY;
        return {
            x: Math.max(0, Math.min(_imgEl.naturalWidth,  nx)),
            y: Math.max(0, Math.min(_imgEl.naturalHeight, ny)),
        };
    }

    function _toDisplay(nx, ny) {
        const cropperCanvas = _container.querySelector(".cropper-canvas");
        const ref  = cropperCanvas ? cropperCanvas.getBoundingClientRect()
                                   : _imgEl.getBoundingClientRect();
        const cr   = _container.getBoundingClientRect();
        const scaleX = ref.width  / _imgEl.naturalWidth;
        const scaleY = ref.height / _imgEl.naturalHeight;
        return {
            x:  nx * scaleX + (ref.left - cr.left),
            y:  ny * scaleY + (ref.top  - cr.top),
            sw: scaleX,
            sh: scaleY,
        };
    }

    // ── SVG overlay ───────────────────────────────────────────────────────────
    function _createOverlay() {
        // BUG3 FIX: ลบ overlay เก่าก่อน disconnect ResizeObserver ด้วย
        if (_resizeObs) { _resizeObs.disconnect(); _resizeObs = null; }
        if (_overlay)   { _overlay.remove(); _overlay = null; }

        _overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        // BUG4 FIX: pointer-events:none บน overlay ทำให้ click × ลบ zone ไม่ได้
        // แก้: overlay = none แต่ child elements ที่ต้องการ click ตั้ง pointer-events:all เอง
        _overlay.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:20;overflow:visible";
        _container.appendChild(_overlay);

        _resizeObs = new ResizeObserver(() => { if (_zones.length) _redrawZones(); });
        _resizeObs.observe(_container);
    }

    // ── Redraw zones ──────────────────────────────────────────────────────────
    function _redrawZones() {
        if (!_overlay) return;
        _overlay.querySelectorAll(".zone-rect,.zone-label,.zone-del").forEach(e => e.remove());

        _zones.forEach((z, i) => {
            const d  = _toDisplay(z.x, z.y);
            const dw = z.w * d.sw;
            const dh = z.h * d.sh;

            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x",               d.x);
            rect.setAttribute("y",               d.y);
            rect.setAttribute("width",           dw);
            rect.setAttribute("height",          dh);
            rect.setAttribute("fill",            ZONE_FILL);
            rect.setAttribute("stroke",          ZONE_STROKE);
            rect.setAttribute("stroke-width",    "2");
            rect.setAttribute("stroke-dasharray","6 3");
            rect.setAttribute("rx",              "4");
            rect.classList.add("zone-rect");
            _overlay.appendChild(rect);

            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x",           d.x + 6);
            label.setAttribute("y",           d.y + 16);
            label.setAttribute("fill",        "#4338ca");
            label.setAttribute("font-size",   "11");
            label.setAttribute("font-weight", "700");
            label.setAttribute("font-family", "sans-serif");
            label.classList.add("zone-label");
            label.textContent = `Zone ${i + 1}`;
            _overlay.appendChild(label);

            // ปุ่มลบ ×  — ต้องรับ pointer events ได้
            const del = document.createElementNS("http://www.w3.org/2000/svg", "text");
            del.setAttribute("x",              d.x + dw - 14);
            del.setAttribute("y",              d.y + 14);
            del.setAttribute("fill",           "#ef4444");
            del.setAttribute("font-size",      "16");
            del.setAttribute("font-weight",    "900");
            del.setAttribute("font-family",    "sans-serif");
            del.setAttribute("cursor",         "pointer");
            del.setAttribute("pointer-events", "all");   // BUG4 FIX: เปิด pointer events ให้ปุ่มลบ
            del.classList.add("zone-del");
            del.textContent = "×";
            del.addEventListener("click", (e) => {
                e.stopPropagation();
                _zones.splice(i, 1);
                _redrawZones();
                _updateBadge();
            });
            _overlay.appendChild(del);
        });
    }

    // ── Mouse events ──────────────────────────────────────────────────────────
    function _onMouseDown(e) {
        if (!_active || e.button !== 0) return;
        // BUG5 FIX: preventDefault ด้วย ไม่ใช่แค่ stopPropagation
        // เพื่อป้องกัน Cropper.js รับ event ไปทำ crop/move แทน
        e.preventDefault();
        e.stopPropagation();
        _drawing = true;

        const cr  = _container.getBoundingClientRect();
        const nat = _toNatural(e.clientX - cr.left, e.clientY - cr.top);
        _startX   = nat.x;
        _startY   = nat.y;

        _previewRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        _previewRect.setAttribute("fill",            ZONE_ACTIVE);
        _previewRect.setAttribute("stroke",          ZONE_STROKE);
        _previewRect.setAttribute("stroke-width",    "2");
        _previewRect.setAttribute("stroke-dasharray","6 3");
        _previewRect.setAttribute("rx",              "4");
        _overlay.appendChild(_previewRect);
    }

    function _onMouseMove(e) {
        if (!_drawing || !_previewRect) return;
        const cr  = _container.getBoundingClientRect();
        const nat = _toNatural(e.clientX - cr.left, e.clientY - cr.top);

        const nx = Math.min(_startX, nat.x);
        const ny = Math.min(_startY, nat.y);
        const nw = Math.abs(nat.x - _startX);
        const nh = Math.abs(nat.y - _startY);

        const d = _toDisplay(nx, ny);
        _previewRect.setAttribute("x",      d.x);
        _previewRect.setAttribute("y",      d.y);
        _previewRect.setAttribute("width",  nw * d.sw);
        _previewRect.setAttribute("height", nh * d.sh);
    }

    function _onMouseUp(e) {
        if (!_drawing) return;
        _drawing = false;

        if (_previewRect) { _previewRect.remove(); _previewRect = null; }

        const cr  = _container.getBoundingClientRect();
        const nat = _toNatural(e.clientX - cr.left, e.clientY - cr.top);
        const x   = Math.min(_startX, nat.x);
        const y   = Math.min(_startY, nat.y);
        const w   = Math.abs(nat.x - _startX);
        const h   = Math.abs(nat.y - _startY);

        if (w > 30 && h > 30) {
            _zones.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
            _redrawZones();
            _updateBadge();
        }
    }

    // ── Badge ─────────────────────────────────────────────────────────────────
    function _updateBadge() {
        const badge = document.getElementById("zoneBadge");
        if (!badge) return;
        if (_zones.length === 0) {
            badge.textContent = "0 zones";
            // BUG6 FIX: classList.replace จะ silent-fail ถ้า class ไม่มีอยู่
            badge.className = badge.className.replace("bg-indigo-600", "bg-slate-400");
            if (!badge.classList.contains("bg-slate-400")) badge.classList.add("bg-slate-400");
        } else {
            badge.textContent = `${_zones.length} zone${_zones.length > 1 ? "s" : ""}`;
            badge.className = badge.className.replace("bg-slate-400", "bg-indigo-600");
            if (!badge.classList.contains("bg-indigo-600")) badge.classList.add("bg-indigo-600");
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────
    function init() {
        _container = document.getElementById("cropper-container");
        _imgEl     = document.getElementById("imageToCrop");
        if (!_container || !_imgEl) return;
        _active = false;
        // สร้าง overlay ใหม่เสมอเมื่อ init (cropper-container ถูก re-render)
        // แต่ _zones ยังคงอยู่ — redraw หลังสร้าง overlay ใหม่ทันที
        _createOverlay();
        if (_zones.length) _redrawZones();
    }

    function toggle(forceState) {
        _active    = forceState !== undefined ? forceState : !_active;
        _container = document.getElementById("cropper-container");

        if (_active) {
            _container.style.cursor = "crosshair";
            _container.addEventListener("mousedown", _onMouseDown, true);
            window.addEventListener("mousemove", _onMouseMove);
            window.addEventListener("mouseup",   _onMouseUp);
        } else {
            _container.style.cursor = "";
            _container.removeEventListener("mousedown", _onMouseDown, true);
            window.removeEventListener("mousemove", _onMouseMove);
            window.removeEventListener("mouseup",   _onMouseUp);
        }
        return _active;
    }

    function reset() {
        _zones = [];
        if (_overlay) _overlay.querySelectorAll(".zone-rect,.zone-label,.zone-del").forEach(e => e.remove());
        _updateBadge();
    }

    function getZones() { return [..._zones]; }

    return { init, toggle, reset, getZones };
})();

// =============================================================================
// Zone-based Detect
// =============================================================================
window.runZoneDetect = async (ab) => {
    const zones = ZonePainter.getZones();
    if (zones.length === 0) {
        await customAlert("กรุณาวาด Zone บนภาพก่อนครับ\n(กดปุ่ม 'วาด Zone' แล้วลากกรอบบริเวณที่ต้องการ)", "warning");
        return;
    }

    const list  = document.getElementById("detectedObjectsList");
    const panel = document.getElementById("detectedObjectsPanel");
    const badge = document.getElementById("aiStatusBadge");

    list.innerHTML = "";
    panel.classList.remove("hidden");
    badge.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> สแกน ${zones.length} zone...`;
    badge.classList.remove("hidden");

    const fullImg = new Image();
    fullImg.src   = ab.image_base64;
    await new Promise(r => { fullImg.onload = r; });

    let totalFound = 0;

    for (let zi = 0; zi < zones.length; zi++) {
        const z = zones[zi];

        const zCanvas = document.createElement("canvas");
        zCanvas.width  = z.w;
        zCanvas.height = z.h;
        zCanvas.getContext("2d").drawImage(fullImg, z.x, z.y, z.w, z.h, 0, 0, z.w, z.h);

        const zBlob = await new Promise(r => zCanvas.toBlob(r, "image/png"));
        const fd    = new FormData();
        fd.append("file", zBlob, "zone.png");

        try {
            const res  = await fetchWithAuth(`${API_BASE}/auto_detect`, { method: "POST", body: fd });
            const data = await res.json();
            if (data.status !== "success") continue;

            totalFound += data.objects.length;

            data.objects.forEach(obj => {
                const absX = z.x + obj.x;
                const absY = z.y + obj.y;

                const canvas = document.createElement("canvas");
                canvas.width  = obj.w;
                canvas.height = obj.h;
                canvas.getContext("2d").drawImage(fullImg, absX, absY, obj.w, obj.h, 0, 0, obj.w, obj.h);

                const btn = document.createElement("div");
                btn.className = "relative cursor-pointer border-2 border-transparent hover:border-indigo-400 rounded bg-white p-1 shadow-sm shrink-0 transition-all hover:scale-105";

                const zonePill = document.createElement("span");
                zonePill.className = "absolute -top-2 -left-2 bg-indigo-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm";
                zonePill.textContent = `Z${zi + 1}`;
                btn.appendChild(zonePill);

                const thumbImg     = document.createElement("img");
                thumbImg.src       = canvas.toDataURL();
                thumbImg.className = "h-10 object-contain";
                btn.appendChild(thumbImg);

                const predBadge = document.createElement("span");
                predBadge.className = "absolute -top-2 -right-2 bg-slate-200 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm";
                predBadge.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
                btn.appendChild(predBadge);
                list.appendChild(btn);

                canvas.toBlob(async (cropBlob) => {
                    try {
                        const pFd = new FormData();
                        pFd.append("file", cropBlob, "predict.png");
                        const pRes  = await fetchWithAuth(`${API_BASE}/ai/predict`, { method: "POST", body: pFd });
                        const pData = await pRes.json();
                        if (pData.status === "success" && pData.label !== "Unknown") {
                            const conf = Math.round(pData.confidence * 100);
                            predBadge.className = "absolute -top-2 -right-2 bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md border border-white";
                            predBadge.innerHTML = `${pData.label} <span class="text-[7px] text-violet-200">${conf}%</span>`;
                            btn.dataset.predictedCol  = pData.label;
                            btn.dataset.predictedConf = conf;
                        } else {
                            predBadge.remove();
                        }
                    } catch { predBadge.remove(); }
                }, "image/png");

                btn.onclick = () => {
                    if (!state.cropper) return;
                    state.cropper.setData({ x: absX, y: absY, width: obj.w, height: obj.h });
                    state.cropper.setDragMode("crop");
                    activateCropTool();

                    const pCol = btn.dataset.predictedCol;
                    if (pCol) {
                        const colBtn = document.querySelector(`.col-card[data-col="${pCol}"]`);
                        if (colBtn) {
                            document.querySelectorAll(".col-card").forEach(b => b.classList.remove("selected"));
                            colBtn.classList.add("selected");
                            showSnapAlert(`AI ตีกรอบ + เลือกคอลัมน์ ${pCol} (${btn.dataset.predictedConf}%)`, "item");
                            return;
                        }
                    }
                    showSnapAlert(`AI ดึงกรอบจาก Zone ${zi + 1}`, "item");
                };
            });
        } catch (e) {
            console.warn(`Zone ${zi + 1} detect failed:`, e);
        }
    }

    badge.innerHTML = totalFound > 0
        ? `<i class="fa-solid fa-robot mr-1 text-indigo-500"></i> เจอ ${totalFound} ชิ้นส่วนใน ${zones.length} zone`
        : `<i class="fa-solid fa-magnifying-glass mr-1 text-amber-500"></i> ไม่พบชิ้นส่วนใน zone ที่เลือก`;
};

// =============================================================================
// Toggle / Clear controls
// =============================================================================
window.toggleZonePaint = () => {
    const btn  = document.getElementById("btnZonePaint");
    const isOn = ZonePainter.toggle();

    if (isOn) {
        btn.classList.replace("bg-white",         "bg-indigo-600");
        btn.classList.replace("text-slate-500",   "text-white");
        btn.classList.replace("border-slate-200", "border-indigo-600");
        btn.querySelector(".btn-label").textContent = "วาด Zone (ON)";
        showSnapAlert("โหมดวาด Zone เปิดแล้ว — ลากบนภาพเพื่อกำหนดโซนที่ต้องการ Detect", "item");
    } else {
        btn.classList.replace("bg-indigo-600",    "bg-white");
        btn.classList.replace("text-white",       "text-slate-500");
        btn.classList.replace("border-indigo-600","border-slate-200");
        btn.querySelector(".btn-label").textContent = "วาด Zone";
    }
};

window.clearAllZones = () => {
    ZonePainter.reset();
    const btn = document.getElementById("btnZonePaint");
    if (!btn) return;
    // ปิด paint mode ถ้าเปิดอยู่
    if (btn.classList.contains("bg-indigo-600")) {
        ZonePainter.toggle(false);
        btn.classList.replace("bg-indigo-600",    "bg-white");
        btn.classList.replace("text-white",       "text-slate-500");
        btn.classList.replace("border-indigo-600","border-slate-200");
        btn.querySelector(".btn-label").textContent = "วาด Zone";
    }
};

// =============================================================================
// Hook into openCropperWorkspace
// =============================================================================
const _origOpenCropperWorkspace = window.openCropperWorkspace;
window.openCropperWorkspace = (index) => {
    const isNewArtboard = state.activeArtboardIndex !== index;
    _origOpenCropperWorkspace(index);
    // ต้องรอ Cropper.js ready ก่อน (Cropper ใช้ setTimeout 150ms ใน cropper-tool.js)
    // จึงใช้ 400ms เพื่อให้แน่ใจว่า Cropper render เสร็จแล้ว
    setTimeout(() => {
        if (isNewArtboard) {
            clearAllZones();      // reset zones เมื่อเปลี่ยน artboard
        }
        ZonePainter.init();       // สร้าง/redraw overlay หลัง Cropper ready
    }, 400);
};
