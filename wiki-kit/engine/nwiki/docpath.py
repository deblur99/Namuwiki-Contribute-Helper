"""Resolve toDocument paths relative to document(\"…\")."""

from __future__ import annotations

from .ast import Document
from .errors import NwikiError


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


def needs_document_context(path: str) -> bool:
    """True if path uses ./ or ../ special form (not an escaped literal)."""
    if path.startswith("\\"):
        return False
    return path.startswith("./") or path.startswith("../")


def resolve_to_document(path: str, current: str | None) -> str:
    """
    Resolve toDocument string against current document name (parsed string value).

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
