// =============================================================================
// Constants & Global State
// =============================================================================

// COLUMN_GROUPS — Visual grouping ของ image columns ใน Templates.xlsx (verified 2026-03)
// แต่ละ group ใช้ theme color ใน UI "Select Target Column"
//
// Col  N  — Garment image
// Col  R/T/V/X       — Graphic Print No.1-4
// Col  Z/AB/AD/AF    — Graphic Direct EMB No.1-4 (AF template มี typo "No.3" แต่ใช้ใน No.4)
// Col  AH/AL         — Graphic Patch No.1, No.2
// Col  AJ/AN         — Direct EMB around Patch No.1, No.2
// Col  AP/AS         — Graphic Fabric applique EMB No.1, No.2
// Col  AV/AX/AZ      — Heat logo No.1-3
//
// หมายเหตุ: AA/AC/AE/AG/AI/AK/AM/AO/AQ/AR/AT/AU/AW/AY/BA = color/stitch text columns
//          (user key in เอง ไม่ embed รูป จึงไม่อยู่ใน list นี้)
const COLUMN_GROUPS = [
    { label: "Garment", theme: "amber", cols: [
        { col: "N",  short: "Garment Image" }
    ]},
    { label: "Print", theme: "blue", cols: [
        { col: "R",  short: "Print No.1" },
        { col: "T",  short: "Print No.2" },
        { col: "V",  short: "Print No.3" },
        { col: "X",  short: "Print No.4" }
    ]},
    { label: "Direct EMB", theme: "stone", cols: [
        { col: "Z",  short: "Direct EMB No.1" },
        { col: "AB", short: "Direct EMB No.2" },
        { col: "AD", short: "Direct EMB No.3" },
        { col: "AF", short: "Direct EMB No.4" }
    ]},
    { label: "Patch + EMB around", theme: "emerald", cols: [
        { col: "AH", short: "Patch No.1" },
        { col: "AJ", short: "EMB around Patch No.1" },
        { col: "AL", short: "Patch No.2" },
        { col: "AN", short: "EMB around Patch No.2" }
    ]},
    { label: "Fabric applique", theme: "pink", cols: [
        { col: "AP", short: "Fabric applique No.1" },
        { col: "AS", short: "Fabric applique No.2" }
    ]},
    { label: "Heat logo", theme: "slate", cols: [
        { col: "AV", short: "Heat logo No.1" },
        { col: "AX", short: "Heat logo No.2" },
        { col: "AZ", short: "Heat logo No.3" }
    ]}
];

// Flat list ใช้สำหรับ legacy callers (keyboard shortcut, mapping checks ฯลฯ)
const IMAGE_COLUMNS = COLUMN_GROUPS.flatMap(g => g.cols.map(c => c.col));

const COL_MEMORY_KEY = "artportal_col_memory";

const state = {
    excelFile: null, columnHeaders: {}, batchTextData: [], batchMappedCrops: [], processedAIFiles: [],
    currentArtboards: [], currentTextData: [], currentMappedCrops: [], currentFileName: "", currentColors: {},
    cropper: null, activeArtboardIndex: null, cmPerPx: 0, isColorLocked: false,
    globalCropMemory: {}, sessionCropMemory: {}, pendingEditCrop: null, manualCompletedArtboards: [],
    crosshairEnabled: false, aiAbortController: null, useAiMode: true
};

// =============================================================================
// Global Utilities
// =============================================================================
function getAllCrops() { return [...state.batchMappedCrops, ...state.currentMappedCrops]; }
function isMapped(itemId, col) { return getAllCrops().some(c => c.col === col && c.itemId === itemId); }

function getStyleFromItemId(itemId) {
    const rec = state.currentTextData.find(r => r.item_id === itemId);
    if (rec && rec.style) return rec.style;
    const parts = itemId.split('-');
    if (parts.length >= 4) return `${parts[0]}-${parts[3]}`;
    return itemId;
}

// Lookup short display label สำหรับ Excel column letter (e.g., "R" → "Print No.1")
function getColumnShortLabel(col) {
    for (const grp of COLUMN_GROUPS) {
        const found = grp.cols.find(c => c.col === col);
        if (found) return found.short;
    }
    return "";
}
