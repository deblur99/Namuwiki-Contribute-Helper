"""Load flat string JSON maps via import(\"….json\")."""

from __future__ import annotations

import json
from pathlib import Path

from .ast import CallStmt, Document
from .errors import NwikiError


def is_json_import_arg(arg: object) -> bool:
    return isinstance(arg, str) and arg.lower().endswith(".json")


def resolve_json_path(path_arg: str, *, entry: Path) -> Path:
    """Resolve relative path against the .nwiki file directory; absolute as-is."""
    p = Path(path_arg)
    if p.is_absolute():
        return p
    base = entry.parent if entry.suffix else entry
    return (base / p).resolve()


def load_flat_string_json(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise NwikiError(f"cannot load import({str(path)!r}): file not found")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise NwikiError(f"cannot parse JSON {path}: {exc}") from exc
    if not isinstance(raw, dict):
        raise NwikiError(f"JSON root must be an object: {path}")
    out: dict[str, str] = {}
    for k, v in raw.items():
        if not isinstance(k, str):
            raise NwikiError(f"JSON key must be string in {path}: {k!r}")
        if not isinstance(v, str):
            raise NwikiError(
                f"JSON value for {k!r} must be string in {path} (got {type(v).__name__})"
            )
        out[k] = v
    return out


def json_import_stmts(doc: Document) -> list[CallStmt]:
    out: list[CallStmt] = []
    for s in doc.stmts:
        if s.name != "import" or not s.args:
            continue
        if is_json_import_arg(s.args[0]):
            out.append(s)
    return out


def component_import_names(doc: Document) -> dict[str, CallStmt]:
    """Bare Ident or non-.json string → component name."""
    names: dict[str, CallStmt] = {}
    for s in doc.stmts:
        if s.name != "import" or not s.args:
            continue
        arg = s.args[0]
        if is_json_import_arg(arg):
            continue
        if isinstance(arg, str):
            names[arg] = s
    return names


def resolve_json_imports(doc: Document) -> Document:
    """
    Load import(\"….json\") into doc.data_namespaces (stem → flat string map).
    Leaves component import stmts on the document for resolve_imports.
    """
    entry = Path(doc.path) if doc.path else Path(".")
    namespaces: dict[str, dict[str, str]] = {}
    kept_stmts: list[CallStmt] = []

    for s in doc.stmts:
        if s.name == "import" and s.args and is_json_import_arg(s.args[0]):
            path_arg = s.args[0]
            assert isinstance(path_arg, str)
            resolved = resolve_json_path(path_arg, entry=entry)
            ns = resolved.stem
            if ns in namespaces:
                raise NwikiError(f"duplicate JSON import namespace {ns!r}")
            namespaces[ns] = load_flat_string_json(resolved)
            # drop json import stmt from remaining (like component imports are dropped later)
            continue
        kept_stmts.append(s)

    doc.stmts = kept_stmts
    doc.data_namespaces = namespaces
    return doc
