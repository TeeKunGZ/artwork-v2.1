"""
Excel & ZIP generation — column mapping verified จาก Templates.xlsx (2026-03)

Fixed text columns (เขียนโดยระบบ):
    C  (3)  = Style
    D  (4)  = Item id    ← row key
    E  (5)  = CW
    F  (6)  = ORG CODE
    G  (7)  = Team name
    M  (13) = Fabric col (color)

Image columns (embed รูปจาก crop):
    N, R, T, V, X, Z, AB, AD, AF, AH, AL, AP, AS, AV, AX, AZ
"""
from __future__ import annotations

import io
import os
import zipfile

import openpyxl
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
from openpyxl.drawing.xdr import XDRPositiveSize2D
from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker, TwoCellAnchor
from openpyxl.utils import column_index_from_string
from PIL import Image as PILImage

TEMPLATE_PATH  = "Templates.xlsx"
FIRST_DATA_ROW = 2
_EMU_PER_PX    = 9525

_TEXT_COLS = {
    "style":    3,
    "item_id":  4,
    "cw":       5,
    "org_code": 6,
    "team":     7,
    "color":    13,
}

_IMAGE_COL_LETTERS = {
    "N",
    "R",  "T",  "V",  "X",
    "Z",  "AB", "AD", "AF",
    "AH", "AL",
    "AP", "AS",
    "AV", "AX", "AZ",
}


def _col_px(sheet, col_letter: str) -> int:
    default_w = sheet.sheet_format.defaultColWidth or 8.43
    dim = sheet.column_dimensions.get(col_letter)
    w   = dim.width if (dim and dim.width) else default_w
    return max(1, int(w * 7.5))


def _row_px(sheet, row: int) -> int:
    default_h = sheet.sheet_format.defaultRowHeight or 15.0
    dim = sheet.row_dimensions.get(row)
    h   = dim.height if (dim and dim.height) else default_h
    return max(1, int(h * 1.3333))


def _build_row_map(sheet) -> dict[str, int]:
    row_map: dict[str, int] = {}
    id_col   = _TEXT_COLS["item_id"]
    scan_end = max(sheet.max_row, FIRST_DATA_ROW) + 1
    for r in range(FIRST_DATA_ROW, scan_end):
        val = sheet.cell(row=r, column=id_col).value
        if val:
            row_map[str(val).strip()] = r
    return row_map


def _next_empty_row(row_map: dict) -> int:
    if not row_map:
        return FIRST_DATA_ROW
    return max(row_map.values()) + 1


def generate_excel_bytes(
    records: list[dict],
    crops: list[tuple[str, bytes]],
    mappings: dict,
) -> bytes:
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError("ไม่พบไฟล์ Templates.xlsx")

    wb    = openpyxl.load_workbook(TEMPLATE_PATH)
    try:
        sheet = wb.active

        row_map  = _build_row_map(sheet)
        next_row = _next_empty_row(row_map)

        # ── Write text columns ───────────────────────────────────────────────────
        for rec in records:
            item_id = str(rec.get("item_id", "")).strip()
            if not item_id:
                continue

            if item_id in row_map:
                target_row = row_map[item_id]
            else:
                target_row       = next_row
                row_map[item_id] = target_row
                next_row        += 1

            sheet.cell(row=target_row, column=_TEXT_COLS["style"],    value=rec.get("style"))
            sheet.cell(row=target_row, column=_TEXT_COLS["item_id"],  value=item_id)
            sheet.cell(row=target_row, column=_TEXT_COLS["cw"],       value=rec.get("cw"))
            sheet.cell(row=target_row, column=_TEXT_COLS["org_code"], value=rec.get("org_code"))
            sheet.cell(row=target_row, column=_TEXT_COLS["team"],     value=rec.get("team"))
            sheet.cell(row=target_row, column=_TEXT_COLS["color"],    value=rec.get("color"))

        # ── Embed images ─────────────────────────────────────────────────────────
        for fname, img_data in crops:
            if fname not in mappings:
                continue

            map_info          = mappings[fname]
            item_id           = str(map_info["item_id"]).strip()
            target_col_letter = map_info["col"]

            if item_id not in row_map:
                continue

            if target_col_letter not in _IMAGE_COL_LETTERS:
                print(f"[ExcelWriter] Skipped col {target_col_letter}: ไม่อยู่ใน image column list")
                continue

            target_row = row_map[item_id]
            col_idx    = column_index_from_string(target_col_letter)  # 1-based

            # TwoCellAnchor: stretch รูปให้เต็ม cell อัตโนมัติ
            # ไม่ต้องคำนวณ pixel — Excel จัดการ scaling เอง
            from openpyxl.drawing.spreadsheet_drawing import TwoCellAnchor
            from openpyxl.drawing.xdr import XDRPoint2D, XDRPositiveSize2D

            xl_img = XLImage(io.BytesIO(img_data))  # embed bytes ต้นฉบับ resolution เต็ม

            anchor        = TwoCellAnchor()
            anchor.editAs = "oneCell"               # ล็อคมุมบนซ้าย, ขยายตาม cell

            # มุมบนซ้าย = cell นี้
            anchor._from      = AnchorMarker(
                col=col_idx - 1, colOff=0,
                row=target_row - 1, rowOff=0,
            )
            # มุมล่างขวา = cell ถัดไป (ขยายเต็ม cell)
            anchor.to         = AnchorMarker(
                col=col_idx, colOff=0,
                row=target_row, rowOff=0,
            )
            xl_img.anchor     = anchor
            sheet.add_image(xl_img)

        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return out.getvalue()
    finally:
        wb.close()


def generate_zip_bytes(
    records: list[dict],
    crops: list[tuple[str, bytes]],
    mappings: dict,
) -> bytes:
    item_info = {r["item_id"]: r for r in records}
    out_zip   = io.BytesIO()

    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname, data in crops:
            if fname not in mappings:
                continue
            m        = mappings[fname]
            rec      = item_info.get(m["item_id"], {})
            team     = rec.get("team", "UNKNOWN").replace("/", "_").replace("\\", "_")
            safe_id  = m["item_id"].replace("/", "_").replace("\\", "_")
            col_name = m.get("col_name", "").replace("/", "_").replace("\\", "_")
            zf.writestr(f"{team}_{safe_id}_{m['col']}_{col_name}.png", data)

    out_zip.seek(0)
    return out_zip.getvalue()