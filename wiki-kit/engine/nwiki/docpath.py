"""Resolve toDocument paths relative to document(\"…\")."""

from __future__ import annotations

import re

from .ast import Document
from .errors import NwikiError

# Document part + namuwiki TOC section anchor (#s-1, #s-2, …)
_SECTION_ANCHOR = re.compile(r"^(.*)#(s-\d+)$")


def bind_document_name(doc: Document) -> None:
    """Collect document(\"…\") / frame(\"…\") into doc.document_name; leave stmt for render to skip."""
    name: str | None = None
    for s in doc.stmts:
        if s.name == "document":
            if not s.args or not isinstance(s.args[0], str) or not s.args[0]:
                raise NwikiError('document() requires a non-empty string')
            if name is not None:
                raise NwikiError("duplicate document() / frame() call")
            name = s.args[0]
        elif s.name == "frame":
            if not s.args or not isinstance(s.args[0], str) or not s.args[0]:
                raise NwikiError('frame() requires a non-empty string')
            if name is not None:
                raise NwikiError("duplicate document() / frame() call")
            title = s.args[0]
            name = title if title.startswith("틀:") else f"틀:{title}"
    doc.document_name = name


def parent_document(name: str) -> str:
    if "/" not in name:
        raise NwikiError(
            f"cannot resolve ../ from document without a parent path: {name!r}"
        )
    return name.rsplit("/", 1)[0]


def split_section_anchor(path: str) -> tuple[str, str | None]:
    """
    Split optional `#s-N` suffix from toDocument.
    Returns (document_part, anchor_without_hash_or_None).
    Bare `#s-N` → (\"\", \"s-N\"). Invalid `#…` → NwikiError.
    """
    if "#" not in path:
        return path, None
    m = _SECTION_ANCHOR.fullmatch(path)
    if not m:
        raise NwikiError(
            f"invalid section anchor in toDocument {path!r}; use #s-N "
            f'(e.g. "문서#s-4" or "#s-4")'
        )
    return m.group(1), m.group(2)


def needs_document_context(path: str) -> bool:
    """True if path uses ./ , ../ , or bare #s-N (not an escaped literal)."""
    if path.startswith("\\"):
        return False
    try:
        doc_part, _anchor = split_section_anchor(path)
    except NwikiError:
        return False
    if doc_part == "":
        return True
    return doc_part.startswith("./") or doc_part.startswith("../")


def _resolve_document_part(path: str, current: str | None) -> str:
    """Resolve document title part (no section anchor)."""
    if path == "":
        if not current:
            raise NwikiError(
                'toDocument "#s-N" requires document("…") at top level'
            )
        return current

    if path.startswith("\\"):
        rest = path[1:]
        if rest.startswith("./") or rest.startswith("../"):
            return rest
        if rest.startswith("\\./") or rest.startswith("\\../"):
            return rest
        return path

    if path.startswith("./"):
        if not current:
            raise NwikiError(
                'toDocument "./…" requires document("…") at top level'
            )
        return current + path[1:]

    if path.startswith("../"):
        if not current:
            raise NwikiError(
                'toDocument "../…" requires document("…") at top level'
            )
        return parent_document(current) + path[2:]

    return path


def resolve_to_document(path: str, current: str | None) -> str:
    """
    Resolve toDocument string against current document name (parsed string value).

    Optional namuwiki section anchor `#s-N` is stripped, the document part is
    resolved, then reattached (`김마리(가수)#s-4`). Bare `#s-4` → current + anchor.

    Escape (strip one leading backslash, no relative resolve):
    - \\./… → ./…     (source typically \"\\\\./…\")
    - \\\\./… → \\./… (source typically \"\\\\\\\\./…\")
    Relative:
    - ./… → current + path[1:]
    - ../… → parent(current) + path[2:]
    Else as-is.
    """
    if not isinstance(path, str):
        raise NwikiError("toDocument must be string")

    doc_part, anchor = split_section_anchor(path)
    resolved = _resolve_document_part(doc_part, current)
    if anchor is None:
        return resolved
    return f"{resolved}#{anchor}"
