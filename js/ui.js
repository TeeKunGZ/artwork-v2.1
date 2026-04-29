// =============================================================================
// UI Generators & DOM Manipulations
// =============================================================================
function showSection(id) { const el = document.getElementById(id); if (el) el.classList.remove("hidden"); }
function hideSection(id) { const el = document.getElementById(id); if (el) el.classList.add("hidden"); }

function showLoader(text) { 
    document.getElementById("loaderText").textContent = text; 
    document.getElementById("fullScreenLoader").classList.remove("hidden"); 
}
function hideLoader() { document.getElementById("fullScreenLoader").classList.add("hidden"); }

function setBtn(el, loading, loadText = "Processing...") { 
    if (loading) { 
        el._original = el.innerHTML; 
        el.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> ${loadText}`; 
        el.disabled = true; 
    } else { 
        el.innerHTML = el._original; 
        el.disabled = false; 
    } 
}

function flashBox(id) { 
    const el = document.getElementById(id); 
    el.classList.add("ring-4","ring-indigo-500","bg-indigo-50","highlight-pulse"); 
    setTimeout(() => el.classList.remove("ring-4","ring-indigo-500","bg-indigo-50","highlight-pulse"), 1500); 
}

window.showSnapAlert = (text, type = 'item') => {
    const alert = document.getElementById("cropSnapAlert");
    const inner = document.getElementById("cropSnapAlertInner");
    const icon = document.getElementById("cropSnapIcon");
    document.getElementById("cropSnapText").textContent = text;
    
    alert.classList.remove("hidden");
    if (type === 'item') {
        inner.className = "px-3 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm bg-indigo-50 text-indigo-700 border border-indigo-200";
        icon.className = "fa-solid fa-bullseye mr-2";
    } else {
        inner.className = "px-3 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm bg-emerald-50 text-emerald-700 border border-emerald-200";
        icon.className = "fa-solid fa-history mr-2";
    }
    
    setTimeout(() => { alert.classList.add("hidden"); }, 3000);
};

// UI Renderers
function renderColorsPanel() {
    const entries = Object.entries(state.currentColors); 
    const strip = document.getElementById("detectedColorsStrip");
    if (!strip) return;
    if (!entries.length) { strip.classList.add("hidden"); return; }
    
    strip.classList.remove("hidden"); 
    const list = document.getElementById("detectedColorsList"); 
    list.innerHTML = "";
    
    entries.forEach(([label, value]) => { 
        list.insertAdjacentHTML("beforeend", `
            <div class="flex items-center gap-2 bg-white border border-violet-200 rounded-lg px-3 py-1.5 shadow-sm group">
                <i class="fa-solid fa-circle text-violet-400 text-[8px]"></i>
                <span class="text-[10px] font-bold text-violet-600 uppercase">${label}</span>
                <span class="text-xs font-black text-slate-800">${value}</span>
                <button class="ml-1 text-[12px] text-slate-300 hover:text-violet-600 font-bold transition" title="คัดลอกชื่อสีนี้" onclick="copyColorToClipboard('${value.replace(/'/g,"\'")}', this)">
                    <i class="fa-regular fa-copy"></i>
                </button>
            </div>`); 
    });
}

document.addEventListener('click', () => { 
    document.querySelectorAll('[id^="dd-color-"]').forEach(el => el.classList.add('hidden')); 
});
window.toggleColorDropdown = (idx, event) => { 
    event.stopPropagation(); 
    document.querySelectorAll('[id^="dd-color-"]').forEach(el => { 
        if(el.id !== `dd-color-${idx}`) el.classList.add('hidden'); 
    }); 
    const dd = document.getElementById(`dd-color-${idx}`); 
    if(dd) dd.classList.toggle('hidden'); 
};
window.applyColorDropdown = (idx, val) => { 
    const input = document.getElementById(`color-input-${idx}`); 
    if(input) input.value = val; 
    updateRecordField(idx, 'color', val); 
    document.getElementById(`dd-color-${idx}`).classList.add('hidden'); 
};

function renderTextDataCards() {
    const container = document.getElementById("recordCardsContainer"); 
    container.innerHTML = "";
    document.getElementById("recordCountBadge").textContent = `Found ${state.currentTextData.length} Records`;
    renderColorsPanel();
    
    if (!state.currentTextData.length) { 
        container.innerHTML = `<p class="text-center w-full py-4 text-slate-400 col-span-4">ไม่พบ Item ID ในไฟล์นี้</p>`; 
        return; 
    }

    const colorEntries = Object.entries(state.currentColors);
    
    state.currentTextData.forEach((rec, idx) => {
        const sourceFile = rec.source_file || "";
        const safeClass  = sourceFile.replace(/[^a-zA-Z0-9]/g, "_");
        const safeSourceJs = escapeJsString(sourceFile);
        const safeItemId = escapeHtml(rec.item_id || "");
        const safeStyle = escapeHtml(rec.style || "");
        const safeCw = escapeHtml(rec.cw || "");
        const safeOrg = escapeHtml(rec.org_code || "");
        const safeTeam = escapeHtml(rec.team || "");
        const safeColor = escapeHtml(rec.color || "");
        const safeFabric = escapeHtml(rec.fabric || "");
        const isReady = getAllCrops().some(c => c.itemId === rec.item_id);
        const border     = isReady ? "border-2 border-emerald-400 bg-emerald-50" : "border border-slate-200 bg-slate-50";
        const readyBadge = isReady ? `<span class="absolute -top-3 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md"><i class="fa-solid fa-check-circle mr-1"></i>พร้อม Export</span>` : "";
        const ringFocus = isReady ? "focus:ring-emerald-500" : "focus:ring-indigo-500"; 
        const bdr = isReady ? "border-emerald-300" : "border-slate-300";

        const colorDropdownHtml = colorEntries.length
            ? `<div id="dd-color-${idx}" class="hidden absolute top-[105%] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto">${colorEntries.map(([lbl, val]) => `<div class="px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer border-b border-slate-100 last:border-0" onclick="applyColorDropdown(${idx}, '${escapeJsString(val)}')"><span class="font-bold text-[9px] text-violet-500 mr-1">${escapeHtml(lbl)}</span> ${escapeHtml(val)}</div>`).join("")}</div>`
            : "";
        const dropDownBtn = colorEntries.length 
            ? `<button type="button" class="absolute right-2 top-1.5 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded transition" onclick="toggleColorDropdown(${idx}, event)"><i class="fa-solid fa-chevron-down text-xs"></i></button>` 
            : "";
        const fabricDisplay = rec.fabric
            ? `<span class="text-indigo-600" title="${safeFabric}">${safeFabric}</span>`
            : `<span class="text-slate-300 italic">Not Found</span>`;

        const card = document.createElement("div"); 
        card.className = `relative rounded-xl p-4 flex flex-col gap-3 min-w-[240px] shadow-sm transition-all ${border}`;
        
        const manualBadge = rec.manual ? `<span class="absolute -top-3 -left-2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md"><i class="fa-solid fa-pen-to-square mr-1"></i>เพิ่มเอง</span>` : "";
        const deleteBtn = `<button type="button" onclick="deleteManualRecord(${idx})" class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md bg-white/80 border border-slate-200 text-slate-300 hover:text-red-500 hover:border-red-200 transition shadow-sm z-10" title="ลบ Record นี้ออกจากรายการ"><i class="fa-solid fa-trash text-[10px]"></i></button>`;

        card.innerHTML = `
            ${readyBadge}
            ${manualBadge}
            ${deleteBtn}
            <div class="border-b ${isReady ? "border-emerald-200" : "border-slate-200"} pb-2 mb-1 pr-7">
                <p class="text-xs ${isReady ? "text-emerald-600" : "text-slate-500"} uppercase tracking-wider font-bold">Item ID</p>
                <p class="font-black ${isReady ? "text-emerald-800" : "text-indigo-700"} text-lg truncate w-full" title="${safeItemId}">${safeItemId || "-"}</p>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm mb-2 bg-white p-2 rounded border ${isReady ? "border-emerald-100" : "border-slate-100"}">
                <div><p class="text-[10px] text-slate-400">Style</p><p class="font-bold text-slate-700">${safeStyle}</p></div>
                <div><p class="text-[10px] text-slate-400">CW</p><p class="font-bold text-slate-700">${safeCw}</p></div>
                <div><p class="text-[10px] text-slate-400">ORG CODE</p><p class="font-bold text-slate-700">${safeOrg}</p></div>
                <div class="overflow-hidden"><p class="text-[10px] text-slate-400">FABRIC</p><p class="font-bold text-slate-700 truncate">${fabricDisplay}</p></div>
            </div>
            
            <div>
                <label class="text-xs font-bold text-slate-700 block mb-1">
                    <i class="fa-solid fa-users text-slate-400 mr-1"></i> Team Name
                    ${rec.team ? `<span class="ml-1 text-[9px] font-normal text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"><i class="fa-solid fa-file-lines mr-0.5"></i>จาก .ai</span>` : `<span class="ml-1 text-[9px] font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"><i class="fa-solid fa-triangle-exclamation mr-0.5"></i>ไม่พบใน .ai</span>`}
                </label>
                <input type="text" class="team-sync-${safeClass} w-full border ${bdr} ${ringFocus} rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 outline-none transition" value="${safeTeam}" oninput="syncTeamName(this.value, '${safeSourceJs}')" placeholder="ไม่พบ Team Name ใน .ai — พิมพ์เองได้...">
            </div>

            <div class="mt-auto relative">
                <label class="text-xs font-bold text-slate-700 block mb-1"><i class="fa-solid fa-palette text-slate-400 mr-1"></i> Fabric Color</label>
                <div class="relative">
                    <input type="text" id="color-input-${idx}" class="w-full pr-8 border ${bdr} ${ringFocus} rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 outline-none transition" value="${safeColor}" onchange="updateRecordField(${idx}, 'color', this.value)" placeholder="สำหรับใส่สี Colorway">
                    ${dropDownBtn}${colorDropdownHtml}
                </div>
            </div>`;
        container.appendChild(card);
    });
}

window.syncTeamName = (value, sourceFile) => { 
    state.currentTextData.forEach(rec => { 
        if (rec.source_file === sourceFile) rec.team = value; 
    }); 
    const safe = sourceFile.replace(/[^a-zA-Z0-9]/g, "_"); 
    document.querySelectorAll(`.team-sync-${safe}`).forEach(el => { 
        if (el.value !== value) el.value = value; 
    }); 
};

window.updateRecordField = (idx, field, value) => { 
    state.currentTextData[idx][field] = value; 
    if (!document.getElementById("cropModal").classList.contains("hidden")) {
        renderAvailableRecords(); 
    }
};

window.toggleArtboardCompleted = (idx, event) => { 
    event.stopPropagation(); 
    if (state.manualCompletedArtboards.includes(idx)) {
        state.manualCompletedArtboards = state.manualCompletedArtboards.filter(i => i !== idx); 
    } else {
        state.manualCompletedArtboards.push(idx); 
    }
    renderArtboardGallery(); 
};

function renderArtboardGallery() {
    const container = document.getElementById("artboardList"); 
    container.innerHTML = "";
    
    state.currentArtboards.forEach((ab, idx) => {
        const safeSource = escapeHtml(ab.source_file || "");
        const count = state.currentMappedCrops.filter(c => c.artboardIndex === idx).length; 
        const isDone = state.manualCompletedArtboards.includes(idx);
        
        let cardClass = "artboard-card bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-3 flex flex-col items-center cursor-pointer relative transition-all"; 
        let statusBadge = ""; 
        let imgOpacity = "opacity-100";
        
        if (isDone) { 
            cardClass = "artboard-card bg-emerald-50/60 border-2 border-emerald-400 rounded-xl p-3 flex flex-col items-center cursor-pointer relative shadow-sm transition-all"; 
            statusBadge = `<div class="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full flex items-center justify-center border-2 border-white shadow-md font-bold z-10"><i class="fa-solid fa-check-double mr-1"></i> เคลียร์แล้ว</div>`; 
            imgOpacity = "opacity-70"; 
        } 
        else if (count > 0) { 
            cardClass = "artboard-card bg-indigo-50/30 border-2 border-indigo-400 rounded-xl p-3 flex flex-col items-center cursor-pointer relative shadow-sm transition-all"; 
            statusBadge = `<div class="absolute -top-3 -right-3 bg-indigo-500 text-white text-[10px] px-2 py-1 rounded-full flex items-center justify-center border-2 border-white shadow-md font-bold z-10"><i class="fa-solid fa-scissors mr-1"></i> ${count} รูป</div>`; 
        }
        
        const checkBtnColor = isDone ? "text-emerald-600 bg-emerald-100 border-emerald-200" : "text-slate-300 bg-white/90 border-slate-200 hover:text-emerald-500";
        const toggleBtn = `<button onclick="toggleArtboardCompleted(${idx}, event)" class="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-md shadow-sm border transition z-10 ${checkBtnColor}" title="ทำเครื่องหมายว่าหน้านี้เคลียร์แล้ว"><i class="fa-solid fa-check"></i></button>`;
        
        const card = document.createElement("div"); 
        card.className = cardClass;
        card.innerHTML = `
            ${statusBadge}
            ${toggleBtn}
            <div class="w-full h-32 mb-3 rounded-lg overflow-hidden preview-bg flex items-center justify-center border ${isDone ? 'border-emerald-200' : (count > 0 ? 'border-indigo-200' : 'border-slate-200/60')} bg-white">
                <img src="${ab.image_base64}" class="max-h-full max-w-full object-contain p-2 ${imgOpacity} transition-opacity">
            </div>
            <div class="w-full text-center flex flex-col">
                <h4 class="text-sm font-bold ${isDone ? 'text-emerald-800' : (count > 0 ? 'text-indigo-800' : 'text-slate-800')} line-clamp-1">Artboard ${ab.artboard_number}</h4>
                <span class="text-[9px] ${isDone ? 'text-emerald-600' : 'text-slate-500'} truncate" title="${safeSource}">${safeSource}</span>
            </div>`;
        card.onclick = () => openCropperWorkspace(idx); 
        container.appendChild(card);
    });
}

function renderAvailableRecords() {
    const group = document.getElementById("recordButtonGroup"); 
    const previouslySelected = Array.from(document.querySelectorAll(".rec-card.selected")).map(b => b.dataset.itemid); 
    group.innerHTML = "";
    
    state.currentTextData.forEach((rec, i) => {
        const display = rec.color || "⚠️ รอใส่สี"; 
        const safeDisplay = escapeHtml(display);
        const safeItemId = escapeHtml(rec.item_id || "");
        const btn = document.createElement("div");
        btn.className = `rec-card border bg-white rounded-lg p-2 flex flex-col items-start text-left relative ${!rec.color ? "border-orange-200" : "border-slate-200"}`;
        if (previouslySelected.includes(rec.item_id)) btn.classList.add("selected");
        
        btn.dataset.itemid = rec.item_id; 
        btn.dataset.color  = display;
        btn.innerHTML = `<span class="absolute top-1 left-2 text-[10px] font-black text-amber-500">${i + 1}</span><span class="font-bold text-amber-700 text-xs w-full truncate mt-2" title="${safeDisplay}">${safeDisplay}</span><span class="text-[9px] text-slate-400 w-full truncate" title="${safeItemId}">${safeItemId}</span>`;
        
        btn.onclick = () => { 
            btn.classList.toggle("selected"); 
            renderAvailableColumns(); 
        }; 
        group.appendChild(btn);
    });
}

function renderAvailableColumns() {
    const group = document.getElementById("columnButtonGroup");
    const prevCol = document.querySelector(".col-card.selected")?.dataset.col;
    const selectedItemIds = Array.from(document.querySelectorAll(".rec-card.selected")).map(b => b.dataset.itemid);
    group.innerHTML = "";

    let kbdIdx = 0; // running 1-based number for keyboard shortcuts

    COLUMN_GROUPS.forEach(grp => {
        const theme = grp.theme || "slate";
        const groupEl = document.createElement("div");
        groupEl.className = `col-group-${theme}`;

        const labelEl = document.createElement("div");
        labelEl.className = "col-group-label truncate";
        labelEl.textContent = grp.label;
        labelEl.title = grp.label;
        groupEl.appendChild(labelEl);

        grp.cols.forEach(({ col, short }) => {
            const used = selectedItemIds.length > 0 && selectedItemIds.some(id => isMapped(id, col));
            const fullHeader = state.columnHeaders[col] || short;
            const myKbd = ++kbdIdx;

            const btn = document.createElement("div");
            btn.dataset.col = col;
            btn.dataset.colname = fullHeader;
            btn.title = `${fullHeader} (Col ${col})`;

            const baseClasses = `col-card col-card-base col-card-${theme}`;

            if (used) {
                btn.className = `${baseClasses} col-card-used`;
                btn.innerHTML = `<span class="col-short">${short}</span><span class="col-used">✅ ใช้แล้ว</span>`;
                btn.onclick = async () => await customAlert(`คอลัมน์ "${short}" ถูกใช้งานสำหรับสีที่เลือกแล้วครับ`, "warning");
            } else {
                btn.className = baseClasses;
                if (col === prevCol) btn.classList.add("selected");

                const kbdBadge = myKbd <= 9 ? `<span class="col-kbd">${myKbd}</span>` : "";
                btn.innerHTML = `${kbdBadge}<span class="col-short">${short}</span>`;

                btn.onclick = () => {
                    document.querySelectorAll(".col-card").forEach(b => b.classList.remove("selected"));
                    btn.classList.add("selected");
                    if (state.cropper && selectedItemIds.length > 0) {
                        const primaryItemId = selectedItemIds[0];
                        const styleCode = getStyleFromItemId(primaryItemId);

                        if (state.globalCropMemory[styleCode] && state.globalCropMemory[styleCode][col]) {
                            state.cropper.setData(state.globalCropMemory[styleCode][col]);
                            showSnapAlert(`โหลดตำแหน่งเดิมของสไตล์ ${styleCode} (${short})`, 'item');
                        }
                        else if (state.globalCropMemory[primaryItemId] && state.globalCropMemory[primaryItemId][col]) {
                            state.cropper.setData(state.globalCropMemory[primaryItemId][col]);
                            showSnapAlert(`โหลดตำแหน่งเดิมของ ${primaryItemId} (${short})`, 'item');
                        }
                        else if (state.sessionCropMemory[col]) {
                            state.cropper.setData(state.sessionCropMemory[col]);
                            showSnapAlert(`โหลดตำแหน่งล่าสุดของ ${short}`, 'session');
                        }
                    }
                };
            }
            groupEl.appendChild(btn);
        });
        group.appendChild(groupEl);
    });
}

function renderMappedItems() {
    const list  = document.getElementById("mappedItemsList"); 
    const crops = state.currentMappedCrops.filter(c => c.artboardIndex === state.activeArtboardIndex); 
    list.innerHTML = "";
    
    if (!crops.length) { 
        list.innerHTML = `<p class="text-[10px] text-slate-400 italic text-center py-2">ยังไม่มีรูปถูกหั่นจากหน้านี้</p>`; 
        return; 
    }
    
    crops.forEach(crop => {
        const item = document.createElement("div");
        item.className = "flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded shadow-sm group";
        const shortLabel = getColumnShortLabel(crop.col) || `Col ${crop.col}`;
        const safeShortLabel = escapeHtml(shortLabel);
        const safeColorDesc = escapeHtml(crop.colorDesc || "");
        const safeColName = escapeHtml(crop.colName || "");
        const safeFilename = escapeJsString(crop.filename || "");
        item.innerHTML = `
            <div class="w-8 h-8 bg-slate-100 rounded overflow-hidden flex-shrink-0 border border-slate-200 flex items-center justify-center">
                <img src="${crop.previewUrl}" class="max-w-full max-h-full">
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[10px] font-bold text-indigo-600 truncate" title="${safeColName}">${safeShortLabel} <span class="text-amber-600">(${safeColorDesc})</span></p>
            </div>
            <button class="text-slate-300 hover:text-indigo-600 transition px-1 opacity-50 group-hover:opacity-100" onclick="editCrop('${safeFilename}')" title="แก้ไขกรอบรูปนี้ (Edit)">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button class="text-slate-300 hover:text-red-500 transition px-1 opacity-50 group-hover:opacity-100" onclick="deleteCrop('${safeFilename}')" title="ลบถาวร">
                <i class="fa-solid fa-trash text-xs"></i>
            </button>`;
        list.appendChild(item);
    });
}

window.deleteCrop = (filename) => { 
    state.currentMappedCrops = state.currentMappedCrops.filter(c => c.filename !== filename); 
    renderMappedItems(); 
    renderAvailableColumns(); 
    renderArtboardGallery(); 
    renderTextDataCards(); 
};

window.editCrop = (filename) => {
    const crop = state.currentMappedCrops.find(c => c.filename === filename); 
    if (!crop) return;
    state.currentMappedCrops = state.currentMappedCrops.filter(c => c.filename !== filename); 
    state.pendingEditCrop = crop;
    
    if (state.activeArtboardIndex !== crop.artboardIndex) {
        openCropperWorkspace(crop.artboardIndex); 
    } else {
        applyPendingEdit();
    }
};

function applyPendingEdit() {
    if (!state.pendingEditCrop) return; 
    const pc = state.pendingEditCrop;
    
    renderMappedItems(); 
    renderAvailableRecords();
    
    document.querySelectorAll(".rec-card").forEach(b => b.classList.remove("selected")); 
    const recBtn = document.querySelector(`.rec-card[data-itemid="${pc.itemId}"]`); 
    if (recBtn) recBtn.classList.add("selected");
    
    renderAvailableColumns(); 
    const colBtn = document.querySelector(`.col-card[data-col="${pc.col}"]`);
    if (colBtn) { 
        document.querySelectorAll(".col-card").forEach(b => b.classList.remove("selected")); 
        colBtn.classList.add("selected"); 
    }
    
    if (pc.cropData && state.cropper) { 
        state.cropper.setData(pc.cropData); 
        state.cropper.setDragMode("crop"); 
        activateCropTool(); 
    }
    
    showSnapAlert(`โหมดแก้ไข: ปรับพิกัดใหม่แล้วกด Enter เพื่อบันทึกทับได้เลย!`, 'session'); 
    state.pendingEditCrop = null; 
}

function renderAutoMappedUI() {
    const list = document.getElementById("autoMappedList");
    const currentItemIds = state.currentTextData.map(rec => rec.item_id);
    const autoCrops = state.batchMappedCrops.filter(c => c.artboardIndex === "auto" && currentItemIds.includes(c.itemId));
    
    showSection("mainWorkspace");
    if (!autoCrops.length) { hideSection("autoMappedSection"); return; }
    showSection("autoMappedSection"); 
    list.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"; 
    list.innerHTML = "";
    
    const grouped = {}; 
    autoCrops.forEach(c => { 
        if (!grouped[c.col]) grouped[c.col] = []; 
        grouped[c.col].push(c); 
    });
    
    Object.keys(grouped).sort().forEach(col => {
        const items = grouped[col]; 
        const colName = state.columnHeaders[col] || `Column ${col}`;
        let itemsHtml = items.map(c => `
            <div class="flex items-center justify-between p-2 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg transition group" id="auto_card_${c.filename}">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 bg-white rounded border border-slate-200 p-0.5 flex-shrink-0 flex items-center justify-center shadow-sm">
                        <img src="${c.previewUrl}" class="max-w-full max-h-full object-contain">
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-700 truncate" title="${c.itemId}">${c.itemId}</p>
                        <p class="text-[10px] text-emerald-600 font-medium"><i class="fa-solid fa-check mr-1"></i>พร้อมใช้งาน</p>
                    </div>
                </div>
                <button class="text-slate-300 hover:text-red-500 transition px-2 opacity-0 group-hover:opacity-100" onclick="deleteAutoCrop('${c.filename}')" title="ลบเพื่อหั่นรูปนี้ใหม่">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join("");

        list.insertAdjacentHTML("beforeend", `
            <div class="bg-white border border-emerald-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden transition hover:shadow-md hover:border-emerald-300">
                <div class="bg-emerald-50/80 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
                    <div class="flex items-center min-w-0 pr-2">
                        <span class="bg-emerald-500 text-white font-black text-xs px-2 py-1 rounded shadow-sm mr-2.5 flex-shrink-0">${col}</span>
                        <span class="text-xs font-bold text-emerald-900 truncate" title="${colName}">${colName}</span>
                    </div>
                    <span class="text-[10px] font-black text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm flex-shrink-0">${items.length} รูป</span>
                </div>
                <div class="p-2 flex-1 overflow-y-auto max-h-[220px]">${itemsHtml}</div>
            </div>
        `);
    });
}

window.deleteAutoCrop = (filename) => { 
    state.batchMappedCrops = state.batchMappedCrops.filter(c => c.filename !== filename); 
    renderAutoMappedUI(); 
    renderAvailableColumns(); 
    renderTextDataCards(); 
};

window.copyColorToClipboard = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector("i");
        if (icon) {
            icon.className = "fa-solid fa-check text-emerald-500";
            setTimeout(() => { icon.className = "fa-regular fa-copy"; }, 2000);
        }
    }).catch(err => console.error("Failed to copy:", err));
};

// =============================================================================
// Manual Record Entry — สำหรับกรณีระบบอ่านข้อมูลผิดพลาดหรือไม่ครบ
// =============================================================================
const ITEM_ID_REGEX = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/;

function _mrFields() {
    return {
        itemId: document.getElementById("mrItemId"),
        style:  document.getElementById("mrStyle"),
        cw:     document.getElementById("mrCw"),
        org:    document.getElementById("mrOrgCode"),
        team:   document.getElementById("mrTeam"),
        color:  document.getElementById("mrColor"),
        fabric: document.getElementById("mrFabric"),
        error:  document.getElementById("mrError"),
    };
}

function _mrUpdateAutoFields() {
    const f = _mrFields();
    const parts = (f.itemId.value || "").trim().toUpperCase().split("-");
    f.style.value = parts.length >= 4 ? `${parts[0]}-${parts[3]}` : "";
    f.cw.value    = parts.length >= 4 ? parts[1] : "";
    f.org.value   = parts.length >= 4 ? parts[2] : "";
}

function _mrSetError(msg) {
    const el = _mrFields().error;
    if (msg) { el.textContent = msg; el.classList.remove("hidden"); }
    else { el.textContent = ""; el.classList.add("hidden"); }
}

window.openManualRecordModal = () => {
    const f = _mrFields();
    f.itemId.value = "";
    f.style.value  = "";
    f.cw.value     = "";
    f.org.value    = "";
    // Pre-fill team/color จากข้อมูลที่อ่านได้ก่อนหน้า เพื่อความสะดวก
    const firstRec = state.currentTextData[0] || {};
    f.team.value   = firstRec.team || "";
    const firstColor = Object.values(state.currentColors || {})[0] || firstRec.color || "";
    f.color.value  = firstColor;
    f.fabric.value = firstRec.fabric || "";
    _mrSetError("");

    // ใช้ <dialog>.showModal() เพื่อ render บน browser top-layer
    // → อยู่หน้าทุก element โดยไม่ขึ้นกับ z-index/stacking context
    const dlg = document.getElementById("manualRecordModal");
    if (dlg.open) dlg.close();
    if (typeof dlg.showModal === "function") {
        dlg.showModal();
    } else {
        // Fallback สำหรับ browser เก่า (ไม่ควรเจอ Chrome/Edge/Firefox/Safari ใหม่ๆ)
        dlg.setAttribute("open", "");
    }
    setTimeout(() => f.itemId.focus(), 50);
};

window.closeManualRecordModal = () => {
    const dlg = document.getElementById("manualRecordModal");
    if (typeof dlg.close === "function" && dlg.open) {
        dlg.close();
    } else {
        dlg.removeAttribute("open");
    }
};

window.saveManualRecord = async () => {
    const f = _mrFields();
    const itemId = (f.itemId.value || "").trim().toUpperCase();

    if (!itemId) { _mrSetError("กรุณากรอก ITEM ID"); f.itemId.focus(); return; }
    if (!ITEM_ID_REGEX.test(itemId)) {
        _mrSetError("รูปแบบ ITEM ID ไม่ถูกต้อง — ต้องมี 4 ส่วนคั่นด้วย '-' (ตัวอักษร/ตัวเลข)");
        f.itemId.focus();
        return;
    }
    if (state.currentTextData.some(r => r.item_id === itemId)) {
        _mrSetError(`มี ITEM ID "${itemId}" อยู่ในรายการแล้ว`);
        return;
    }
    const batchIds = (state.batchTextData || []).map(r => r.item_id);
    if (batchIds.includes(itemId)) {
        _mrSetError(`ITEM ID "${itemId}" ซ้ำกับไฟล์ที่บันทึกไว้ก่อนหน้า`);
        return;
    }

    const parts = itemId.split("-");
    const rec = {
        item_id:  itemId,
        style:    `${parts[0]}-${parts[3]}`,
        cw:       parts[1],
        org_code: parts[2],
        team:     (f.team.value   || "").trim(),
        color:    (f.color.value  || "").trim(),
        fabric:   (f.fabric.value || "").trim(),
        source_file: state.currentFileName || "manual",
        manual:   true,
    };

    state.currentTextData.push(rec);
    closeManualRecordModal();
    renderTextDataCards();
    if (typeof renderAvailableRecords === "function"
        && document.getElementById("cropModal")
        && !document.getElementById("cropModal").classList.contains("hidden")) {
        renderAvailableRecords();
    }
    await customAlert(`เพิ่ม ITEM ID "${itemId}" สำเร็จ`, "success");
};

window.deleteManualRecord = async (idx) => {
    const rec = state.currentTextData[idx];
    if (!rec) return;

    const hasMappedCrops = state.currentMappedCrops.some(c => c.itemId === rec.item_id)
                        || state.batchMappedCrops.some(c => c.itemId === rec.item_id);
    const warn = hasMappedCrops
        ? `\n⚠️ Record นี้มีรูปที่หั่นไว้แล้ว ${state.currentMappedCrops.filter(c => c.itemId === rec.item_id).length + state.batchMappedCrops.filter(c => c.itemId === rec.item_id).length} ชิ้น — รูปจะถูกลบทิ้งด้วย`
        : "";

    if (!(await customConfirm(`ต้องการลบ Record "${rec.item_id}" ใช่ไหม?${warn}`, "ยืนยันการลบ", "warning"))) return;

    state.currentTextData.splice(idx, 1);
    state.currentMappedCrops = state.currentMappedCrops.filter(c => c.itemId !== rec.item_id);
    state.batchMappedCrops   = state.batchMappedCrops.filter(c => c.itemId !== rec.item_id);

    renderTextDataCards();
    if (typeof renderAvailableRecords === "function") renderAvailableRecords();
    if (typeof renderArtboardGallery === "function") renderArtboardGallery();
    if (typeof renderAutoMappedUI === "function") renderAutoMappedUI();
};

(function _wireManualRecordModal() {
    const itemIdInput = document.getElementById("mrItemId");
    if (itemIdInput) {
        itemIdInput.addEventListener("input", () => {
            itemIdInput.value = itemIdInput.value.toUpperCase();
            _mrUpdateAutoFields();
            _mrSetError("");
        });
    }
    const modal = document.getElementById("manualRecordModal");
    if (!modal) return;

    // คลิกบน backdrop → ปิด modal
    // (เช็คจากพิกัดคลิกว่าอยู่นอกกล่อง dialog หรือเปล่า — backdrop ไม่ใช่ DOM element แยก)
    modal.addEventListener("click", (e) => {
        if (e.target !== modal) return;
        const rect = modal.getBoundingClientRect();
        const inside = rect.top <= e.clientY && e.clientY <= rect.bottom
                    && rect.left <= e.clientX && e.clientX <= rect.right;
        if (!inside) closeManualRecordModal();
    });

    // Enter ใน input → submit
    // (Escape browser handle ให้ native ผ่าน <dialog> cancel event โดยอัตโนมัติ)
    modal.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && document.activeElement
                && document.activeElement.tagName === "INPUT") {
            e.preventDefault();
            saveManualRecord();
        }
    });
})();
