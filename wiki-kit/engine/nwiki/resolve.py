"""Resolve import() and merge props into template trees."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from .ast import CallExpr, Document, Element, InterpPart, InterpString, MemberAccess
from .errors import NwikiError
from .parser import parse_file


def default_search_dirs(entry: Path) -> list[Path]:
    dirs = [entry.parent]
    # wiki-kit/examples → also wiki-kit/examples
    root = entry.resolve()
    for p in root.parents:
        if (p / "examples").is_dir():
            dirs.append(p / "examples")
            break
    return dirs


def resolve_imports(doc: Document, *, search_dirs: list[Path] | None = None) -> Document:
    """Expand import(Name) + <Name .../> into inlined template elements."""
    entry = Path(doc.path) if doc.path else Path(".")
    dirs = search_dirs or default_search_dirs(entry)

    out = Document(
        path=doc.path,
        stmts=[s for s in doc.stmts if s.name != "import"],
        script_props=dict(doc.script_props),
        template=[],
    )

    imports = {s.args[0]: s for s in doc.stmts if s.name == "import"}
    loaded: dict[str, Document] = {}

    def load_component(name: str) -> Document:
        if name in loaded:
            return loaded[name]
        for d in dirs:
            candidate = d / f"{name}.nwiki"
            if candidate.is_file():
                loaded[name] = parse_file(str(candidate))
                return loaded[name]
        raise NwikiError(f"cannot resolve import({name})")

    for el in doc.template:
        if el.name in imports:
            comp = load_component(el.name)
            props = dict(comp.script_props)
            # component invocation attrs override
            for k, v in el.attrs.items():
                props[k] = _attr_to_prop_str(v)
            tree = deepcopy(comp.template)
            for node in tree:
                _apply_props(node, props)
            out.template.extend(tree)
        else:
            out.template.append(deepcopy(el))

    # 단독 .nwiki 빌드: <script> props 를 자기 template 에 적용
    if out.script_props:
        for node in out.template:
            _apply_props(node, out.script_props)

    return out


def _attr_to_prop_str(val) -> str:
    if isinstance(val, str):
        return val
    if isinstance(val, InterpString):
        # only literals for top-level invoke attrs expected
        return "".join(
            p.value if p.kind == "literal" else "" for p in val.parts
        )
    return str(val)


def _apply_props(el: Element, props: dict[str, str]) -> None:
    for k, v in list(el.attrs.items()):
        el.attrs[k] = _subst_value(v, props)
    for child in el.children:
        _apply_props(child, props)


def _subst_value(val, props: dict[str, str]):
    if isinstance(val, InterpString):
        parts: list[InterpPart] = []
        for p in val.parts:
            if p.kind == "literal":
                parts.append(p)
            else:
                resolved = _subst_expr(p.value, props)
                if isinstance(resolved, str):
                    parts.append(InterpPart(kind="literal", value=resolved))
                else:
                    parts.append(InterpPart(kind="expr", value=resolved))
        if parts and all(p.kind == "literal" for p in parts):
            return "".join(p.value for p in parts)
        return InterpString(parts=parts)
    if isinstance(val, MemberAccess):
        return _subst_expr(val, props)
    if isinstance(val, CallExpr):
        return CallExpr(
            name=val.name,
            args=[_subst_expr(a, props) for a in val.args],
            kwargs={k: _subst_expr(v, props) for k, v in val.kwargs.items()},
        )
    if isinstance(val, list):
        return [_subst_value(x, props) for x in val]
    return val


def _subst_expr(expr, props: dict[str, str]):
    if isinstance(expr, MemberAccess) and expr.parts[0] == "props" and len(expr.parts) == 2:
        key = expr.parts[1]
        if key not in props:
            raise NwikiError(f"unknown prop {key!r}")
        return props[key]
    if isinstance(expr, CallExpr):
        return CallExpr(
            name=expr.name,
            args=[_subst_expr(a, props) for a in expr.args],
            kwargs={k: _subst_expr(v, props) for k, v in expr.kwargs.items()},
        )
    return expr
