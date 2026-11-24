"""Structural validation for nwiki AST."""

from __future__ import annotations

from .ast import Document, Element
from .docpath import needs_document_context, resolve_to_document
from .errors import NwikiError


def validate_document(doc: Document) -> None:
    for el in doc.template:
        _walk(el, parent=None, heading_depth=None, document_name=doc.document_name)


def _walk(
    el: Element,
    parent: Element | None,
    heading_depth: int | None,
    document_name: str | None,
) -> None:
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
    if el.name == "Link":
        _validate_link_targets(el, document_name)
    if el.name == "Heading":
        depth = 2 if heading_depth is None else heading_depth
        _validate_heading(el, depth=depth, document_name=document_name)
        for ch in el.children:
            if ch.name == "Heading":
                _walk(ch, el, heading_depth=depth + 1, document_name=document_name)
            else:
                _walk(ch, el, heading_depth=None, document_name=document_name)
        return
    for ch in el.children:
        _walk(ch, el, heading_depth=None, document_name=document_name)


def _check_to_document(path: str, document_name: str | None) -> None:
    if needs_document_context(path) and not document_name:
        raise NwikiError(
            'toDocument "./…" / "../…" requires document("…") at top level'
        )
    # Dry-run resolve (also catches ../ without parent)
    resolve_to_document(path, document_name)


def _validate_link_targets(el: Element, document_name: str | None) -> None:
    to_doc = el.attrs.get("toDocument")
    to_ext = el.attrs.get("toExternal")
    if to_doc is not None and to_ext is not None:
        raise NwikiError("Link cannot take both toDocument and toExternal")
    if to_doc is not None:
        if not isinstance(to_doc, str):
            raise NwikiError("Link toDocument must be string")
        _check_to_document(to_doc, document_name)
    if to_ext is not None and not isinstance(to_ext, str):
        raise NwikiError("Link toExternal must be string")


def _validate_heading(
    el: Element, *, depth: int, document_name: str | None
) -> None:
    if el.attrs.get("level") is not None:
        raise NwikiError(
            "Heading no longer takes level=…; nest <Heading> for deeper sections"
        )
    title = el.attrs.get("title")
    if not isinstance(title, str) or not title:
        raise NwikiError("Heading requires title string")
    if depth < 1 or depth > 6:
        raise NwikiError(
            f"Heading nesting exceeds max depth 6 (got {depth}); flatten sections"
        )
    to_doc = el.attrs.get("toDocument")
    to_ext = el.attrs.get("toExternal")
    if to_doc is not None and to_ext is not None:
        raise NwikiError("Heading cannot take both toDocument and toExternal")
    if to_doc is not None:
        if not isinstance(to_doc, str):
            raise NwikiError("Heading toDocument must be string")
        _check_to_document(to_doc, document_name)
    if to_ext is not None and not isinstance(to_ext, str):
        raise NwikiError("Heading toExternal must be string")
