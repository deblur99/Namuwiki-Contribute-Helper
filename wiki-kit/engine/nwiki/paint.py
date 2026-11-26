"""Hex / paint value serialization for wiki markup."""

from __future__ import annotations

from .ast import CallExpr, EnumRef, MemberAccess
from .errors import NwikiError

HEXCOLOR_PRESETS: dict[str, str] = {
    "white": "#fff",
    "black": "#000",
    "transparent": "transparent",
}


def norm_hex(h: str, *, lower: bool = False) -> str:
    """Parse #RGB or #RRGGBB; preserve digit length on emit."""
    raw = h.strip()
    if not raw.startswith("#"):
        raw = "#" + raw
    body = raw[1:]
    if len(body) in (4, 8):
        raise NwikiError(
            f"invalid HexColor {h!r}: namuwiki does not support "
            "#RGBA/#RRGGBBAA; use RgbaColor / opacity / .transparent"
        )
    if len(body) not in (3, 6):
        raise NwikiError(
            f"invalid HexColor {h!r}: expected #RGB (3) or #RRGGBB (6)"
        )
    if any(c not in "0123456789abcdefABCDEF" for c in body):
        raise NwikiError(f"invalid HexColor {h!r}: non-hex digit")
    out = "#" + body
    return out.lower() if lower else out


def paint_to_wiki(val, *, lower: bool = False) -> str:
    """Serialize HexColor / .hex / preset / dual-theme string to wiki color token(s)."""
    if isinstance(val, EnumRef) and val.name == "transparent":
        return "transparent"
    if isinstance(val, MemberAccess) and len(val.parts) == 2 and val.parts[0] == "HexColor":
        preset = HEXCOLOR_PRESETS.get(val.parts[1])
        if preset is None:
            raise NwikiError(f"unknown HexColor.{val.parts[1]}")
        if preset == "transparent":
            return "transparent"
        return norm_hex(preset, lower=lower)
    if isinstance(val, CallExpr) and val.name == "hex":
        if not val.args:
            raise NwikiError(".hex() requires a color")
        return norm_hex(str(val.args[0]), lower=lower)
    if isinstance(val, CallExpr) and val.name == "HexColor":
        if val.kwargs:
            has_light = "light" in val.kwargs
            has_dark = "dark" in val.kwargs
            if has_light or has_dark:
                if not has_light or not has_dark:
                    raise NwikiError(
                        "HexColor dual-theme requires both light= and dark="
                    )
            light = str(val.kwargs.get("light", ""))
            dark = str(val.kwargs.get("dark", ""))
            return f"{norm_hex(light, lower=True)},{norm_hex(dark, lower=True)}"
        if val.args:
            arg = str(val.args[0])
            if "," in arg:
                light, dark = arg.split(",", 1)
                return f"{norm_hex(light, lower=True)},{norm_hex(dark, lower=True)}"
            return norm_hex(arg, lower=lower)
    if isinstance(val, str):
        if val.lower() == "transparent":
            return "transparent"
        if "," in val:
            light, dark = val.split(",", 1)
            return f"{norm_hex(light, lower=True)},{norm_hex(dark, lower=True)}"
        return norm_hex(val, lower=lower)
    raise NwikiError("expected HexColor")
