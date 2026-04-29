// =============================================================================
// Merge Excel Workspace
// =============================================================================
const MENU_ACTIVE = "flex items-center px-4 py-3 bg-indigo-600 text-white rounded-lg shadow-md transition";
const MENU_INACTIVE = "flex items-center px-4 py-3 bg-slate-800 text-indigo-300 hover:bg-slate-700 hover:text-white rounded-lg transition mt-2 border border-slate-700";

function setMergeSummary(message = "") {
    const el = document.getElementById("mergeExcelSummary");
    if (!el) return;
    if (!message) {
        el.textContent = "";
        el.classList.add("hidden");
        return;
    }
    el.textContent = message;
    el.classList.remove("hidden");
}

window.switchWorkspace = (workspace) => {
    const mapping = document.getElementById("mappingWorkspace");
    const merge = document.getElementById("mergeExcelWorkspace");
    const mappingMenu = document.getElementById("btnMappingMenu");
    const mergeMenu = document.getElementById("btnMergeExcelMenu");
    const cacheCounter = document.getElementById("cacheCounter");

    const showMerge = workspace === "mergeExcel";
    mapping.classList.toggle("hidden", showMerge);
    merge.classList.toggle("hidden", !showMerge);
    mappingMenu.className = showMerge ? MENU_INACTIVE : MENU_ACTIVE;
    mergeMenu.className = showMerge ? MENU_ACTIVE : MENU_INACTIVE;
    if (cacheCounter) {
        if (showMerge || !state.processedAIFiles.length) cacheCounter.classList.replace("flex", "hidden");
        else cacheCounter.classList.replace("hidden", "flex");
    }
};

function getDownloadFilename(res, fallback) {
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    return match ? match[1] : fallback;
}

function renderMergeExcelFiles() {
    const baseBadge = document.getElementById("mergeBaseFileName");
    const importBadge = document.getElementById("mergeImportFileCount");
    const list = document.getElementById("mergeImportList");

    if (state.mergeExcel.baseFile) {
        baseBadge.innerHTML = `<i class="fa-solid fa-check mr-1"></i> ${escapeHtml(state.mergeExcel.baseFile.name)}`;
        baseBadge.classList.remove("hidden");
    } else {
        baseBadge.textContent = "";
        baseBadge.classList.add("hidden");
    }

    if (state.mergeExcel.importFiles.length) {
        importBadge.textContent = `${state.mergeExcel.importFiles.length} files selected`;
        importBadge.classList.remove("hidden");
        list.innerHTML = `
            <p class="text-xs font-bold text-slate-500 mb-3">Import queue</p>
            <div class="space-y-2">
                ${state.mergeExcel.importFiles.map((file, idx) => `
                    <div class="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <span class="min-w-0 truncate text-slate-700 font-semibold"><span class="text-slate-400 mr-2">${idx + 1}.</span>${escapeHtml(file.name)}</span>
                        <span class="text-[10px] text-slate-400 font-bold whitespace-nowrap">${Math.ceil(file.size / 1024)} KB</span>
                    </div>
                `).join("")}
            </div>
        `;
        list.classList.remove("hidden");
    } else {
        importBadge.textContent = "";
        importBadge.classList.add("hidden");
        list.innerHTML = "";
        list.classList.add("hidden");
    }
}

function clearMergeExcelFiles() {
    state.mergeExcel.baseFile = null;
    state.mergeExcel.importFiles = [];
    document.getElementById("mergeBaseFile").value = "";
    document.getElementById("mergeImportFiles").value = "";
    setMergeSummary("");
    renderMergeExcelFiles();
}

document.getElementById("mergeBaseFile").addEventListener("change", (e) => {
    state.mergeExcel.baseFile = e.target.files[0] || null;
    setMergeSummary("");
    renderMergeExcelFiles();
});

document.getElementById("mergeImportFiles").addEventListener("change", (e) => {
    state.mergeExcel.importFiles = Array.from(e.target.files || []);
    setMergeSummary("");
    renderMergeExcelFiles();
});

document.getElementById("btnClearMergeExcel").addEventListener("click", clearMergeExcelFiles);

document.getElementById("btnMergeExcel").addEventListener("click", async () => {
    if (!state.mergeExcel.baseFile) {
        await customAlert("Please upload a base Excel file first.", "warning");
        return;
    }
    if (!state.mergeExcel.importFiles.length) {
        await customAlert("Please upload at least one import Excel file.", "warning");
        return;
    }

    showLoader("Merging Excel files...");
    const formData = new FormData();
    formData.append("base_file", state.mergeExcel.baseFile);
    state.mergeExcel.importFiles.forEach(file => formData.append("import_files", file));

    try {
        const res = await fetchWithAuth(`${API_BASE}/merge-excel`, { method: "POST", body: formData });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            await customAlert(`Merge failed: ${err.message || res.statusText}`, "error");
            return;
        }

        const added = res.headers.get("X-Merge-Added") || "0";
        const skipped = res.headers.get("X-Merge-Skipped") || "0";
        const errors = res.headers.get("X-Merge-Errors") || "0";
        const filename = getDownloadFilename(res, "Merged_Excel.xlsx");
        const url = URL.createObjectURL(await res.blob());
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setMergeSummary(`Merge complete: added ${added} rows, skipped ${skipped}, errors ${errors}.`);
    } catch (err) {
        await customAlert(`Backend connection failed. ${err}`, "error");
    } finally {
        hideLoader();
    }
});
