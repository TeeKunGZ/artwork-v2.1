"""Shared template column definitions."""

IMAGE_COL_LETTERS = frozenset({
    "N",
    "R", "T", "V", "X",
    "Z", "AB", "AD", "AF",
    "AH", "AJ", "AL", "AN",
    "AP", "AS",
    "AV", "AX", "AZ",
})


def normalize_image_col(value: str) -> str:
    return (value or "").strip().upper()
