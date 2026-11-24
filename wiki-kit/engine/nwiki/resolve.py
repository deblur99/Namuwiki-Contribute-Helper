"""Resolve import() and merge props / JSON data into template trees."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from .ast import CallExpr, Document, Element, InterpPart, InterpString, MemberAccess
from .data_load import component_import_names, resolve_json_imports
from .errors import NwikiError
from .parser import parse_file


def default_search_dirs(entry: Path) -> list[Path]:
    dirs: list[Path] = [entry.parent]
    # sibling components/ (e.g. 김마리/pages → 김마리/components)
    sibling_components = entry.parent / "components"
    if sibling_components.is_dir():
        dirs.append(sibling_components)
    parent_components = entry.parent.parent / "components"
    if parent_components.is_dir() and parent_components not in dirs:
        dirs.append(parent_components)

    root = entry.resolve()
    for p in root.parents:
        if (p / "examples").is_dir():
            dirs.append(p / "examples")
            break
        if (p / "components").is_dir() and (p / "components") not in dirs:
            dirs.append(p / "components")
            break
    # dedupe preserving order
    seen: set[Path] = set()
    out: list[Path] = []
    for d in dirs:
        rp = d.resolve()
        if rp not in seen:
            seen.add(rp)
            out.append(d)
    return out


def resolve_imports(
    doc: Document,
    *,
    search_dirs: list[Path] | None = None,
    data_namespaces: dict[str, dict[str, str]] | None = None,
) -> Document:
    """Expand import(Name) + <Name .../> into inlined template elements."""
    entry = Path(doc.path) if doc.path else Path(".")
    dirs = search_dirs or default_search_dirs(entry)
    namespaces = (
        data_namespaces
        if data_namespaces is not None
        else dict(doc.data_namespaces)
    )

    out = Document(
        path=doc.path,
        stmts=[s for s in doc.stmts if s.name != "import"],
        script_props=dict(doc.script_props),
        template=[],
        data_namespaces=dict(namespaces),
        document_name=doc.document_name,
    )

    imports = component_import_names(doc)
    loaded: dict[str, Document] = {}

    def load_component(name: str) -> Document:
        if name in loaded:
            return loaded[name]
        for d in dirs:
            candidate = d / f"{name}.nwiki"
            if candidate.is_file():
                comp = parse_file(str(candidate))
                loaded[name] = resolve_json_imports(comp)
                return loaded[name]
        raise NwikiError(f"cannot resolve import({name})")

    for el in doc.template:
        if el.name in imports:
            comp = load_component(el.name)
            props = dict(comp.script_props)
            for k, v in el.attrs.items():
                props[k] = _attr_to_prop_str(v)
            # component JSON namespaces + parent (component wins on stem clash)
            merged = {**namespaces, **comp.data_namespaces}
            tree = deepcopy(comp.template)
            for node in tree:
                _apply_bindings(node, props, merged)
            out.template.extend(tree)
        else:
            out.template.append(deepcopy(el))

    # Apply page-level script props + data namespaces to remaining / all roots
    for node in out.template:
        _apply_bindings(node, out.script_props, namespaces)

    return out


def resolve_document(doc: Document) -> Document:
    """JSON imports then component imports + substitution."""
    doc = resolve_json_imports(doc)
    return resolve_imports(doc)


def _attr_to_prop_str(val) -> str:
    if isinstance(val, str):
        return val
    if isinstance(val, InterpString):
        return "".join(
            p.value if p.kind == "literal" else "" for p in val.parts
        )
    return str(val)


def _apply_bindings(
    el: Element,
    props: dict[str, str],
    data_namespaces: dict[str, dict[str, str]],
) -> None:
    for k, v in list(el.attrs.items()):
        el.attrs[k] = _subst_value(v, props, data_namespaces)
    for child in el.children:
        _apply_bindings(child, props, data_namespaces)


def _subst_value(val, props: dict[str, str], data_namespaces: dict[str, dict[str, str]]):
    if isinstance(val, InterpString):
        parts: list[InterpPart] = []
        for p in val.parts:
            if p.kind == "literal":
                parts.append(p)
            else:
                resolved = _subst_expr(p.value, props, data_namespaces)
                if isinstance(resolved, str):
                    parts.append(InterpPart(kind="literal", value=resolved))
                else:
                    parts.append(InterpPart(kind="expr", value=resolved))
        if parts and all(p.kind == "literal" for p in parts):
            return "".join(p.value for p in parts)
        return InterpString(parts=parts)
    if isinstance(val, MemberAccess):
        return _subst_expr(val, props, data_namespaces)
    if isinstance(val, CallExpr):
        return CallExpr(
            name=val.name,
            args=[_subst_value(a, props, data_namespaces) for a in val.args],
            kwargs={
                k: _subst_value(v, props, data_namespaces) for k, v in val.kwargs.items()
            },
        )
    if isinstance(val, list):
        return [_subst_value(x, props, data_namespaces) for x in val]
    return val


def _subst_expr(expr, props: dict[str, str], data_namespaces: dict[str, dict[str, str]]):
    if isinstance(expr, MemberAccess) and len(expr.parts) == 2:
        root, key = expr.parts[0], expr.parts[1]
        if root == "props":
            if key not in props:
                raise NwikiError(f"unknown prop {key!r}")
            return props[key]
        if root in data_namespaces:
            ns = data_namespaces[root]
            if key not in ns:
                raise NwikiError(f"unknown data key {root}.{key}")
            return ns[key]
        raise NwikiError(
            f"unknown data namespace {root!r} (import a \".json\" file whose stem is {root!r})"
        )
    if isinstance(expr, InterpString):
        return _subst_value(expr, props, data_namespaces)
    if isinstance(expr, CallExpr):
        return _subst_value(expr, props, data_namespaces)
    return expr
