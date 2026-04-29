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

function formatMergeSize(bytes) {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function mergeRequestWithProgress(url, formData, onUploadProgress, onUploadDone) {
    return new Promise((resolve, reject) => {
        const token = getAuthToken();
        if (!token) {
            logout();
            reject(new Error("No token found"));
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.responseType = "blob";
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onUploadProgress(event.loaded, event.total);
        };
        xhr.upload.onload = () => onUploadDone();
        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.onload = async () => {
            const headers = { get: (name) => xhr.getResponseHeader(name) };
            if (xhr.status === 401) {
                logout();
                reject(new Error("Token expired"));
                return;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ ok: true, status: xhr.status, statusText: xhr.statusText, headers, blob: async () => xhr.response });
                return;
            }

            let message = xhr.statusText || "Request failed";
            try {
                const text = await xhr.response.text();
                const data = JSON.parse(text);
                message = data.message || data.detail || message;
            } catch (_) {}
            resolve({ ok: false, status: xhr.status, statusText: message, headers, json: async () => ({ message }) });
        };
        xhr.send(formData);
    });
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

    const totalBytes = [state.mergeExcel.baseFile, ...state.mergeExcel.importFiles]
        .reduce((sum, file) => sum + (file?.size || 0), 0);
    const fileCount = 1 + state.mergeExcel.importFiles.length;
    let phaseTimer = null;

    showLoader("Merging Excel files...", {
        subtext: "Uploading large workbooks. You can leave this screen open and do other work.",
        detail: `${fileCount} files selected, total ${formatMergeSize(totalBytes)}.`,
        progress: 3
    });

    const formData = new FormData();
    formData.append("base_file", state.mergeExcel.baseFile);
    state.mergeExcel.importFiles.forEach(file => formData.append("import_files", file));

    try {
        const processingPhases = [
            "Upload complete. Server is opening the Excel workbooks.",
            "Reading the first sheet and ITEM_ID values from column D.",
            "Comparing rows and skipping duplicate ITEM_ID values.",
            "Copying new rows, styles, formulas, and embedded images.",
            "Saving the merged workbook and preparing the download."
        ];
        let phaseIndex = 0;
        const startProcessingHints = () => {
            updateLoader({ subtext: processingPhases[0], detail: "Large files can take several minutes after upload finishes.", progress: 42 });
            clearInterval(phaseTimer);
            phaseTimer = setInterval(() => {
                phaseIndex = Math.min(phaseIndex + 1, processingPhases.length - 1);
                const elapsedSeconds = Math.floor((Date.now() - loaderStartedAt) / 1000);
                const progress = Math.min(92, 42 + phaseIndex * 10 + Math.floor(elapsedSeconds / 20));
                updateLoader({ subtext: processingPhases[phaseIndex], detail: "Please keep this tab open until the download starts.", progress });
            }, 8000);
        };

        const res = await mergeRequestWithProgress(
            `${API_BASE}/merge-excel`,
            formData,
            (loaded, total) => {
                const uploadPercent = Math.round((loaded / total) * 100);
                updateLoader({
                    subtext: `Uploading workbooks: ${uploadPercent}% complete.`,
                    detail: `${formatMergeSize(loaded)} of ${formatMergeSize(total)} sent to server.`,
                    progress: 5 + Math.round(uploadPercent * 0.32)
                });
            },
            startProcessingHints
        );

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            clearInterval(phaseTimer);
            hideLoader();
            await customAlert(`Merge failed: ${err.message || res.statusText}`, "error");
            return;
        }

        clearInterval(phaseTimer);
        updateLoader({
            subtext: "Merge complete. Preparing your download now.",
            detail: "The browser will start downloading the merged workbook.",
            progress: 100
        });
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
        clearInterval(phaseTimer);
        hideLoader();
        await customAlert(`Backend connection failed. ${err}`, "error");
    } finally {
        clearInterval(phaseTimer);
        hideLoader();
    }
});
