// =============================================================================
// AI Monitor — Real-time status panel via Server-Sent Events
// =============================================================================

const AI_MONITOR = (() => {
    let _es = null;
    let _lastData = null;
    let _connected = false;

    const STATE_CONFIG = {
        not_ready: { label: "ยังไม่พร้อม",  dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500"   },
        idle:      { label: "พร้อมใช้งาน",  dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700", pulse: false },
        loading:   { label: "กำลังโหลด...", dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700",   pulse: true  },
        running:   { label: "กำลังทำงาน",   dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700",     pulse: true  },
        success:   { label: "สำเร็จ",       dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
        error:     { label: "Error",        dot: "bg-red-500",     badge: "bg-red-100 text-red-700"        },
    };

    const GROUP_CONFIG = {
        ai:     { label: "AI / Machine Learning", icon: "fa-brain",      color: "text-violet-600" },
        ocr:    { label: "OCR Pipeline",          icon: "fa-file-lines", color: "text-blue-600"   },
        system: { label: "System Services",       icon: "fa-gears",      color: "text-slate-600"  },
    };

    function connect() {
        if (_es) return;
        const token = getAuthToken();
        if (!token) return;
        _es = new EventSource(`${API_BASE}/ai/status/stream?token=${token}`);
        _es.onopen = () => { _connected = true; _setConnectionBadge(true); };
        _es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === "ping") return;
                if (data.type === "snapshot") { _lastData = data; _render(data.modules); }
            } catch (err) { console.warn("[AI Monitor] JSON parse failed:", err); }
        };
        _es.onerror = () => {
            _connected = false;
            _setConnectionBadge(false);
            _es.close(); _es = null;
            setTimeout(connect, 5000);
        };
    }

    function disconnect() {
        if (_es) { _es.close(); _es = null; }
        _connected = false;
    }

    function _render(modules) {
        const container = document.getElementById("aiMonitorContainer");
        if (!container) return;

        const groups = {};
        modules.forEach(m => {
            if (!groups[m.group]) groups[m.group] = [];
            groups[m.group].push(m);
        });

        container.innerHTML = "";

        Object.entries(GROUP_CONFIG).forEach(([groupKey, groupMeta]) => {
            const items = groups[groupKey] || [];
            if (!items.length) return;

            const section = document.createElement("div");
            section.className = "mb-4";
            section.innerHTML = `
                <div class="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100">
                    <i class="fa-solid ${groupMeta.icon} text-sm ${groupMeta.color}"></i>
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">${groupMeta.label}</span>
                </div>
                <div class="space-y-1.5" id="group-${groupKey}"></div>
            `;
            container.appendChild(section);

            const groupEl = section.querySelector(`#group-${groupKey}`);
            items.forEach(m => {
                const cfg     = STATE_CONFIG[m.state] || STATE_CONFIG.not_ready;
                const isActive = ["loading", "running"].includes(m.state);
                const ringCls  = isActive
                    ? (m.state === "loading" ? "bg-amber-50/60 ring-1 ring-amber-200" : "bg-blue-50/60 ring-1 ring-blue-200")
                    : "bg-white hover:bg-slate-50";

                const durationHtml = m.duration_ms
                    ? `<span class="text-[9px] text-slate-400 ml-1">${m.duration_ms < 1000 ? m.duration_ms + "ms" : (m.duration_ms/1000).toFixed(1) + "s"}</span>`
                    : "";
                const countHtml = m.total_processed
                    ? `<span class="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full ml-1">${m.total_processed.toLocaleString()} รูป</span>`
                    : "";

                const row = document.createElement("div");
                row.id        = `ai-module-${m.id}`;
                row.className = `flex items-start gap-2.5 p-2 rounded-lg transition-all duration-300 ${ringCls}`;
                row.innerHTML = `
                    <div class="mt-1 flex-shrink-0 relative w-2.5 h-2.5">
                        <span class="block w-2.5 h-2.5 rounded-full ${cfg.dot}"></span>
                        ${isActive ? `<span class="absolute inset-0 rounded-full ${cfg.dot} animate-ping opacity-60"></span>` : ""}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs font-bold text-slate-700 leading-none">${m.label}</span>
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}">${cfg.label}</span>
                            ${durationHtml}${countHtml}
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5 truncate leading-tight" title="${m.message || m.description}">
                            ${m.message || m.description}
                        </p>
                    </div>
                `;
                groupEl.appendChild(row);
            });
        });

        const runningCount = modules.filter(m => ["running","loading"].includes(m.state)).length;
        const errorCount   = modules.filter(m => m.state === "error").length;
        const idleCount    = modules.filter(m => m.state === "idle").length;
        _updateSummaryBadge(runningCount, errorCount, idleCount, modules.length);
    }

    function _updateSummaryBadge(running, errors, idle, total) {
        const badge = document.getElementById("aiMonitorBadge");
        if (!badge) return;
        if (errors > 0) {
            badge.className = "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200";
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span> ${errors} Error`;
        } else if (running > 0) {
            badge.className = "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 animate-pulse";
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span> ${running} กำลังทำงาน`;
        } else if (idle > 0) {
            badge.className = "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200";
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> ${idle}/${total} พร้อม`;
        } else {
            badge.className = "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200";
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span> รอ init`;
        }
    }

    function _setConnectionBadge(connected) {
        const el = document.getElementById("aiMonitorConnBadge");
        if (!el) return;
        if (connected) {
            el.className = "text-[9px] font-bold text-emerald-600 flex items-center gap-1";
            el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span> Live`;
        } else {
            el.className = "text-[9px] font-bold text-slate-400 flex items-center gap-1";
            el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span> กำลังเชื่อมต่อ...`;
        }
    }

    return { connect, disconnect };
})();
