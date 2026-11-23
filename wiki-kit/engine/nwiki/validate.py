"""Structural validation for nwiki AST."""

from __future__ import annotations

from .ast import Document, Element
from .errors import NwikiError


def validate_document(doc: Document) -> None:
    for el in doc.template:
        _walk(el, parent=None)


def _walk(el: Element, parent: Element | None) -> None:
    if el.name == "TableRow":
        if not el.children:
            raise NwikiError("TableRow must contain at least one TableColumn")
        for ch in el.children:
            if ch.name != "TableColumn":
                raise NwikiError(
                    f"TableRow direct child must be TableColumn, got {ch.name}"
                )
    if el.name == "Box":
        display = el.attrs.get("display")
        is_flex = False
        if display is not None:
            from .ast import EnumRef

            name = display.name if isinstance(display, EnumRef) else str(display).lstrip(".")
            is_flex = name in ("flex", "inlineFlex")
        for flex_attr in ("alignItems", "justifyContent", "flexDirection"):
            if el.attrs.get(flex_attr) is not None and not is_flex:
                raise NwikiError(
                    f"{flex_attr} requires display=.flex or .inlineFlex"
                )
    if el.name == "Folding":
        title = el.attrs.get("title")
        if not isinstance(title, str) or not title:
            raise NwikiError("Folding requires title string")
    if el.name == "Heading":
        title = el.attrs.get("title")
        if not isinstance(title, str) or not title:
            raise NwikiError("Heading requires title string")
        level = el.attrs.get("level", 2)
        if isinstance(level, float) and level.is_integer():
            level = int(level)
        if not isinstance(level, int) or level < 1 or level > 6:
            raise NwikiError("Heading level must be integer 1...6")
    for ch in el.children:
        _walk(ch, el)
