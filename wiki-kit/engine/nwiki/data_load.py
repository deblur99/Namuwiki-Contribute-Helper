"""Load flat string JSON maps via import / import Name from \"….json\"."""

from __future__ import annotations

import json
from pathlib import Path

from .ast import CallStmt, Document
from .errors import NwikiError
# Stem aliases that merge into DesignSystem
_DESIGN_STEMS = frozenset({"design-system", "designSystem", "DesignSystem"})


def is_json_import_arg(arg: object) -> bool:
    return isinstance(arg, str) and arg.lower().endswith(".json")


def is_nwiki_import_arg(arg: object) -> bool:
    return isinstance(arg, str) and arg.lower().endswith(".nwiki")


_ASSET_SUFFIXES = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")


def is_asset_import_arg(arg: object) -> bool:
    if not isinstance(arg, str):
        return False
    lower = arg.lower()
    return any(lower.endswith(suf) for suf in _ASSET_SUFFIXES)


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


def import_binding(stmt: CallStmt) -> str | None:
    """Explicit `as` from `import Name from`, else None."""
    raw = stmt.kwargs.get("as")
    return raw if isinstance(raw, str) and raw else None


def component_import_names(doc: Document) -> dict[str, CallStmt]:
    """
    Tag name → import stmt for components.
    - import Name from \"….nwiki\" → Name
    - import(Name) / import(\"Name\") → Name (legacy search)
    """
    names: dict[str, CallStmt] = {}
    for s in doc.stmts:
        if s.name != "import" or not s.args:
            continue
        arg = s.args[0]
        if is_json_import_arg(arg) or is_asset_import_arg(arg):
            continue
        binding = import_binding(s)
        if binding:
            if is_nwiki_import_arg(arg) or isinstance(arg, str):
                names[binding] = s
            continue
        if is_nwiki_import_arg(arg):
            # path without as — use stem
            assert isinstance(arg, str)
            names[Path(arg).stem] = s
            continue
        if isinstance(arg, str):
            names[arg] = s
    return names


def resolve_asset_imports(doc: Document) -> Document:
    """
    import Logo from \"….png\" → doc.asset_bindings[Logo] = basename.
    Requires the file to exist on disk. Drops those import stmts.
    """
    entry = Path(doc.path) if doc.path else Path(".")
    bindings: dict[str, str] = dict(doc.asset_bindings)
    kept: list[CallStmt] = []

    for s in doc.stmts:
        if s.name == "import" and s.args and is_asset_import_arg(s.args[0]):
            path_arg = s.args[0]
            assert isinstance(path_arg, str)
            resolved = resolve_json_path(path_arg, entry=entry)
            if not resolved.is_file():
                raise NwikiError(
                    f"cannot load image import {path_arg!r}: file not found "
                    f"(resolved {resolved})"
                )
            name = import_binding(s) or resolved.stem
            if name in bindings:
                raise NwikiError(f"duplicate asset import {name!r}")
            bindings[name] = resolved.name  # wiki [[파일:basename]]
            continue
        kept.append(s)

    doc.stmts = kept
    doc.asset_bindings = bindings
    return doc


def resolve_json_imports(doc: Document) -> Document:
    """
    Load JSON imports into doc.data_namespaces.
    Named: import DesignSystem from \"….json\" → key DesignSystem.
    Legacy: import(\"….json\") → stem.
    Leaves component import stmts for resolve_imports.
    """
    entry = Path(doc.path) if doc.path else Path(".")
    namespaces: dict[str, dict[str, str]] = {}
    kept_stmts: list[CallStmt] = []

    for s in doc.stmts:
        if s.name == "import" and s.args and is_json_import_arg(s.args[0]):
            path_arg = s.args[0]
            assert isinstance(path_arg, str)
            resolved = resolve_json_path(path_arg, entry=entry)
            ns = import_binding(s) or resolved.stem
            if ns in namespaces:
                raise NwikiError(f"duplicate JSON import namespace {ns!r}")
            namespaces[ns] = load_flat_string_json(resolved)
            continue
        kept_stmts.append(s)

    doc.stmts = kept_stmts
    doc.data_namespaces = namespaces
    merge_design_system(doc)
    return doc


def merge_design_system(doc: Document) -> None:
    """Normalize DesignSystem stem aliases to one map (keys come from JSON only)."""
    namespaces = doc.data_namespaces

    ds: dict[str, str] = {}
    found = False
    for key in list(namespaces.keys()):
        if key in _DESIGN_STEMS or key == "DesignSystem":
            ds.update(namespaces[key])
            found = True

    if not found:
        return

    namespaces["DesignSystem"] = dict(ds)
    for alias in ("design-system", "designSystem"):
        if alias in namespaces or found:
            namespaces[alias] = dict(ds)
