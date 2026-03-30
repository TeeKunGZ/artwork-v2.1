"""
Text parsing helpers extracted verbatim from the original server.py.
All logic is preserved exactly — only moved to a dedicated module.
"""
from __future__ import annotations

import math
import re
import zlib

from thefuzz import fuzz

# ── Constants ─────────────────────────────────────────────────────────────────
ITEM_ID_PATTERN = re.compile(r"([A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)")
_SYSTEM_COLORS = {
    "cyan", "magenta", "yellow", "black", "white",
    "*gray outline", "*black outline",
    "template magenta", "template black", "redline cyan",
}
_SKIP_PLATE_PREFIXES = ("*", "Template", "Redline")
_SKIP_PLATE_WORDS = {"cyan", "magenta", "yellow", "black", "white",
                     "template", "redline", "process"}


# ── Low-level helpers ─────────────────────────────────────────────────────────
def _clean(value: str) -> str:
    return value.replace("\n", " ").replace("\r", " ").strip()


def _distance(a: dict, b: dict) -> float:
    return math.hypot(
        ((a["x0"] + a["x1"]) / 2) - ((b["x0"] + b["x1"]) / 2),
        ((a["y0"] + a["y1"]) / 2) - ((b["y0"] + b["y1"]) / 2),
    )


# ── Stream-level extraction ───────────────────────────────────────────────────
def _stream_text_tokens(stream_data: bytes) -> list[str]:
    for offset in [0, 2]:
        try:
            tokens: list[str] = []
            pattern = r"\[([^\]]+)\]\s*TJ|\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj"
            raw = zlib.decompress(stream_data[offset:], -15).decode("latin-1", errors="replace")
            for m in re.finditer(pattern, raw):
                if m.group(1):
                    tokens.append(
                        "".join(re.findall(r"\(([^)\\]*(?:\\.[^)\\]*)*)\)", m.group(1)))
                    )
                else:
                    tokens.append(m.group(2) or "")
            return [t.strip() for t in tokens if t.strip()]
        except Exception:
            continue
    return []


def _extract_team_and_colors_from_streams(raw_bytes: bytes) -> tuple[str, str, dict]:
    _ITEM_RE = re.compile(r"^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$")
    team, color, colors = "", "", {}

    for sm in re.finditer(rb"stream\r?\n(.*?)endstream", raw_bytes, re.DOTALL):
        tokens = _stream_text_tokens(sm.group(1))
        if not tokens:
            continue

        if "GARMENT COMP" in tokens:
            gc_idx = tokens.index("GARMENT COMP")
            item_idx = next(
                (i for i, t in enumerate(tokens) if _ITEM_RE.fullmatch(t)), None
            )
            if item_idx:
                for i in range(item_idx - 1, gc_idx, -1):
                    t = tokens[i]
                    if (t and t not in ("N/A", "N\\A")
                            and not t.startswith("\\25")
                            and not t.startswith("Designed")
                            and len(t) > 2):
                        team = t
                        break
            c_start = gc_idx + 1
            for i in range(gc_idx + 1, min(gc_idx + 4, len(tokens))):
                if (tokens[i].startswith("\\25")
                        or "Designed" in tokens[i]
                        or "Developed" in tokens[i]):
                    c_start = i + 1
                    break
            if (c_start < len(tokens)
                    and tokens[c_start]
                    and tokens[c_start] != "N/A"
                    and len(tokens[c_start]) > 2):
                color = tokens[c_start]

        if "GARMENT" in tokens:
            c_num, seen = 1, set()
            for i, t in enumerate(tokens):
                if t == "GARMENT" and i > 0:
                    cand = tokens[i - 1]
                    if (cand
                            and cand not in {"N/A", "IMPORT/ INLINE", "LICENSING SUBMISSION"}
                            and len(cand) > 2
                            and not _ITEM_RE.match(cand)
                            and cand not in seen):
                        seen.add(cand)
                        colors[f"Color {c_num}"] = cand
                        c_num += 1

    return team, color, colors


def _extract_xmp_plate_colors(raw_bytes: bytes) -> list[str]:
    seq = re.search(
        r"<xmpTPg:PlateNames>(.*?)</xmpTPg:PlateNames>",
        raw_bytes[:300_000].decode("latin-1", errors="replace"),
        re.DOTALL,
    )
    if not seq:
        return []
    result = []
    for p in [x.strip() for x in re.findall(r"<rdf:li>(.*?)</rdf:li>", seq.group(1))]:
        if (p and len(p) >= 3
                and p.lower() not in _SYSTEM_COLORS
                and not any(p.startswith(pfx) for pfx in _SKIP_PLATE_PREFIXES)
                and not any(bad in p.lower().split() for bad in _SKIP_PLATE_WORDS)
                and re.search(r"[A-Z]{2,}", p)):
            result.append(p)
    return list(dict.fromkeys(result))


# ── Main parser ───────────────────────────────────────────────────────────────
def parse_item_records(
    blocks: list[dict],
    raw_text: str,
    raw_bytes: bytes = b"",
) -> tuple[list[dict], str, dict]:
    st_team, st_color, st_colors = (
        _extract_team_and_colors_from_streams(raw_bytes)
        if raw_bytes else ("", "", {})
    )
    xmp_colors = _extract_xmp_plate_colors(raw_bytes) if raw_bytes else []

    SKIP = {
        "N/A", "NA", "TEAM", "TEAM NAME", "COLOR", "COLOUR",
        "FABRIC COLOR", "COLOR 1", "COLOR 2", "COLOR 3",
        "FABRIC", "GARMENT FABRIC", "MAIN FABRIC",
    }

    def _find_value_robust(keywords: list[str], ref_block: dict | None = None) -> str:
        kw_block = None
        highest_score = 0

        for b in blocks:
            if ref_block and b["page"] != ref_block["page"]:
                continue
            for kw in keywords:
                score = fuzz.partial_ratio(kw.lower(), b["text"].lower())
                if score > 85 and score > highest_score:
                    highest_score = score
                    kw_block = b

        if not kw_block:
            return ""

        for kw in keywords:
            m = re.search(
                rf"(?i){re.escape(kw)}\s*[:\-]?\s*([^\n\r:]+)", kw_block["text"]
            )
            if m and _clean(m.group(1)) and _clean(m.group(1)).upper() not in SKIP:
                return _clean(m.group(1))

        best_val = ""
        min_dist = float("inf")
        kw_center_y = (kw_block["y0"] + kw_block["y1"]) / 2
        kw_center_x = (kw_block["x0"] + kw_block["x1"]) / 2

        for b in blocks:
            if b is kw_block or b["page"] != kw_block["page"]:
                continue
            if _clean(b["text"]).upper() in SKIP:
                continue

            target_center_y = (b["y0"] + b["y1"]) / 2
            target_center_x = (b["x0"] + b["x1"]) / 2

            dx = b["x0"] - kw_block["x1"]
            dy = (
                b["y0"] - kw_block["y1"]
                if kw_block["source"] == "ocr"
                else kw_block["y0"] - b["y1"]
            )

            is_right = dx >= -10 and abs(target_center_y - kw_center_y) < 30
            is_below = dy >= -10 and abs(target_center_x - kw_center_x) < 50

            if is_right or is_below:
                dist = math.hypot(max(0, dx), max(0, dy))
                if dist < min_dist:
                    min_dist = dist
                    best_val = b["text"]

        return best_val

    global_team = st_team or _find_value_robust(["Team Name", "Team Name:", "Team"])

    all_colors = st_colors if st_colors else (
        {f"Color {i + 1}": p.strip()
         for i, p in enumerate(re.split(r",\s*", st_color)) if p.strip()}
        if st_color else {}
    )
    if not all_colors and xmp_colors:
        all_colors = {f"Color {i + 1}": c for i, c in enumerate(xmp_colors)}
    default_color = st_color or next(iter(all_colors.values()), "")

    # Deduplicate IDs tolerating OCR character confusion (O↔0, I↔1, L↔1)
    raw_ids = list(dict.fromkeys(ITEM_ID_PATTERN.findall(raw_text)))
    ids: list[str] = []
    for rid in raw_ids:
        is_dup = False
        for existing in ids:
            norm_rid = rid.replace("O", "0").replace("I", "1").replace("L", "1")
            norm_exist = existing.replace("O", "0").replace("I", "1").replace("L", "1")
            if norm_rid == norm_exist or fuzz.ratio(rid, existing) >= 85:
                is_dup = True
                break
        if not is_dup:
            ids.append(rid)

    if not ids:
        return [], global_team, all_colors

    id_block = {i: next((b for b in blocks if i in b["text"]), None) for i in ids}
    records: list[dict] = []

    for i in ids:
        pts = i.split("-")
        cw = pts[1] if len(pts) >= 4 else ""
        ref = id_block.get(i)

        item_color = (
            next((v for _, v in all_colors.items() if cw in v.split()), "")
            if cw and all_colors else ""
        )
        if not item_color and cw and all_colors:
            item_color = next((v for _, v in all_colors.items() if cw in v), "")
        if not item_color and ref:
            item_color = _find_value_robust(
                ["Fabric Color", "Color 1", "Color", "Colour"], ref
            )

        fabric_type = (
            _find_value_robust(
                ["Fabric", "Main Fabric", "Garment Fabric", "Body Fabric"], ref
            )
            if ref else ""
        )

        records.append({
            "item_id": i,
            "style": f"{pts[0]}-{pts[3]}" if len(pts) >= 4 else "",
            "cw": cw,
            "org_code": pts[2] if len(pts) >= 4 else "",
            "team": global_team,
            "color": item_color or default_color,
            "fabric": fabric_type,
        })

    return records, global_team, all_colors
