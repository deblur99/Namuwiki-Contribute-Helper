"""Resolve import() / import from and merge props / JSON data into template trees."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from .ast import (
    CallExpr,
    CallStmt,
    Document,
    Element,
    EnumRef,
    InterpPart,
    InterpString,
    MemberAccess,
    PropDecl,
)
from .data_load import (
    component_import_names,
    is_nwiki_import_arg,
    resolve_asset_imports,
    resolve_json_imports,
    resolve_json_path,
)
from .errors import NwikiError
from .parser import parse_file


def default_search_dirs(entry: Path) -> list[Path]:
    dirs: list[Path] = [entry.parent]
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
    asset_bindings: dict[str, str] | None = None,
) -> Document:
    """Expand imported components + <Name .../> into inlined template elements."""
    entry = Path(doc.path) if doc.path else Path(".")
    dirs = search_dirs or default_search_dirs(entry)
    namespaces = (
        data_namespaces
        if data_namespaces is not None
        else dict(doc.data_namespaces)
    )
    assets = (
        asset_bindings
        if asset_bindings is not None
        else dict(doc.asset_bindings)
    )

    out = Document(
        path=doc.path,
        stmts=[s for s in doc.stmts if s.name != "import"],
        template=[],
        data_namespaces=dict(namespaces),
        asset_bindings=dict(assets),
        document_name=doc.document_name,
        prop_decls=dict(doc.prop_decls),
    )

    imports = component_import_names(doc)
    loaded: dict[str, Document] = {}

    def load_component(name: str, stmt: CallStmt) -> Document:
        if name in loaded:
            return loaded[name]
        arg = stmt.args[0] if stmt.args else None
        if isinstance(arg, str) and is_nwiki_import_arg(arg):
            path = resolve_json_path(arg, entry=entry)
            if not path.is_file():
                raise NwikiError(
                    f"cannot resolve import {name} from {arg!r} "
                    f"(resolved {path}; relative to {entry.parent})"
                )
            comp = parse_file(str(path))
            comp = resolve_asset_imports(comp)
            loaded[name] = resolve_json_imports(comp)
            return loaded[name]
        # Legacy: search dirs for Name.nwiki
        for d in dirs:
            candidate = d / f"{name}.nwiki"
            if candidate.is_file():
                comp = parse_file(str(candidate))
                comp = resolve_asset_imports(comp)
                loaded[name] = resolve_json_imports(comp)
                return loaded[name]
        raise NwikiError(f"cannot resolve import({name})")

    for el in doc.template:
        if el.name in imports:
            stmt = imports[el.name]
            comp = load_component(el.name, stmt)
            props = _bind_component_props(comp.prop_decls, el)
            merged_ns = {**namespaces, **comp.data_namespaces}
            merged_assets = {**assets, **comp.asset_bindings}
            tree = deepcopy(comp.template)
            for node in tree:
                _apply_bindings(node, props, merged_ns, merged_assets)
            out.template.extend(tree)
        else:
            out.template.append(deepcopy(el))

    # Page-level namespaces. Component docs seed declared props so
    # ${props.x} is valid when resolving the file alone (IDE / self-build).
    page_props = {name: "" for name in out.prop_decls}
    for node in out.template:
        _apply_bindings(node, page_props, namespaces, assets)

    return out


def _bind_component_props(
    decls: dict[str, PropDecl], el: Element
) -> dict[str, str]:
    """Map call-site attrs to props; validate against props { } when present."""
    props: dict[str, str] = {}
    for k, v in el.attrs.items():
        props[k] = _attr_to_prop_str(v)

    if not decls:
        return props

    for k in props:
        if k not in decls:
            raise NwikiError(
                f"unknown prop {k!r} on <{el.name}> (not in props {{ }})"
            )
    for name, decl in decls.items():
        if not decl.optional and name not in props:
            raise NwikiError(
                f"missing required prop {name!r} on <{el.name}>"
            )
    return props


def resolve_document(doc: Document) -> Document:
    """Asset + JSON imports then component imports + substitution."""
    doc = resolve_asset_imports(doc)
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
    asset_bindings: dict[str, str],
) -> None:
    for k, v in list(el.attrs.items()):
        el.attrs[k] = _subst_value(v, props, data_namespaces, asset_bindings)
    for child in el.children:
        _apply_bindings(child, props, data_namespaces, asset_bindings)


def _subst_value(
    val,
    props: dict[str, str],
    data_namespaces: dict[str, dict[str, str]],
    asset_bindings: dict[str, str],
):
    if isinstance(val, InterpString):
        parts: list[InterpPart] = []
        for p in val.parts:
            if p.kind == "literal":
                parts.append(p)
            else:
                resolved = _subst_expr(
                    p.value, props, data_namespaces, asset_bindings
                )
                if isinstance(resolved, str):
                    parts.append(InterpPart(kind="literal", value=resolved))
                else:
                    parts.append(InterpPart(kind="expr", value=resolved))
        if parts and all(p.kind == "literal" for p in parts):
            return "".join(p.value for p in parts)
        return InterpString(parts=parts)
    if isinstance(val, (MemberAccess, EnumRef)):
        return _subst_expr(val, props, data_namespaces, asset_bindings)
    if isinstance(val, CallExpr):
        return CallExpr(
            name=val.name,
            args=[
                _subst_value(a, props, data_namespaces, asset_bindings)
                for a in val.args
            ],
            kwargs={
                k: _subst_value(v, props, data_namespaces, asset_bindings)
                for k, v in val.kwargs.items()
            },
        )
    if isinstance(val, list):
        return [
            _subst_value(x, props, data_namespaces, asset_bindings) for x in val
        ]
    return val


def _subst_expr(
    expr,
    props: dict[str, str],
    data_namespaces: dict[str, dict[str, str]],
    asset_bindings: dict[str, str],
):
    # fileName=Logo → EnumRef; ${Logo} → EnumRef inside interp
    if isinstance(expr, EnumRef) and expr.name in asset_bindings:
        return asset_bindings[expr.name]
    if isinstance(expr, MemberAccess) and len(expr.parts) == 1:
        name = expr.parts[0]
        if name in asset_bindings:
            return asset_bindings[name]
    if isinstance(expr, MemberAccess) and len(expr.parts) == 2:
        root, key = expr.parts[0], expr.parts[1]
        if root == "props":
            if key not in props:
                raise NwikiError(f"unknown prop {key!r}")
            return props[key]
        if root == "HexColor":
            return expr
        if root in data_namespaces:
            ns = data_namespaces[root]
            if key not in ns:
                raise NwikiError(f"unknown data key {root}.{key}")
            return ns[key]
        raise NwikiError(
            f"unknown data namespace {root!r} "
            f'(import {root} from "….json" or use DesignSystem.*)'
        )
    if isinstance(expr, InterpString):
        return _subst_value(expr, props, data_namespaces, asset_bindings)
    if isinstance(expr, CallExpr):
        return _subst_value(expr, props, data_namespaces, asset_bindings)
    return expr
