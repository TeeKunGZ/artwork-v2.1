// =============================================================================
// Constants & Global State
// =============================================================================

// IMAGE_COLUMNS — Hardcode จาก Templates.xlsx (verified 2026-03)
// ครอบคลุมทุก column ที่ต้องใส่รูป (Graphic / Garment / Heat logo)
//
// Col  N  — Garment image
// Col  R  — Graphic Print No.1
// Col  T  — Graphic Print No.2
// Col  V  — Graphic Print No.3
// Col  X  — Graphic Print No.4
// Col  Z  — Graphic Direct EMB No.1
// Col AB  — Graphic Direct EMB No.2
// Col AD  — Graphic Direct EMB No.3
// Col AF  — Graphic Direct EMB No.4  ← (template header มี typo แต่ใช้ col นี้)
// Col AH  — Graphic Patch No.1
// Col AL  — Graphic Patch No.2
// Col AP  — Graphic Fabric applique EMB No.1
// Col AS  — Graphic Fabric applique EMB No.2
// Col AV  — Heat logo 1
// Col AX  — Heat logo 2
// Col AZ  — Heat logo 3
//
// หมายเหตุ: AW, AY, BA = Heat logo color (text) — user key in เอง ไม่อยู่ใน list นี้
const IMAGE_COLUMNS = [
    "N",
    "R",  "T",  "V",  "X",
    "Z",  "AB", "AD", "AF",
    "AH", "AL",
    "AP", "AS",
    "AV", "AX", "AZ"
];

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
