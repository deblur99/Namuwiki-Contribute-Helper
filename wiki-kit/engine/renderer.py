"""컴포넌트 트리를 나무위키 날것 마크업으로 렌더."""

from __future__ import annotations

import re
from typing import Any

from .loader import ComponentRegistry, Unit
from .tags import find_matching_close, iter_tags

PLACEHOLDER = re.compile(r"\$\{(props|designSystem)\.(\w+)\}")


class RenderError(Exception):
    pass


def render(
    unit: Unit,
    props: dict[str, Any],
    *,
    registry: ComponentRegistry,
    design_system: dict[str, Any],
    _depth: int = 0,
) -> str:
    if _depth > 32:
        raise RenderError(f"Component nesting too deep at {unit.name}")

    scope = _merge_props(unit, props)

    # 초안용 내장 조건부: value가 비면 출력 없음
    if unit.name == "IfTruthy":
        if not str(scope.get("value") or "").strip():
            return ""

    result = _render_body(unit.body, scope, registry, design_system, _depth)

    leftover = PLACEHOLDER.findall(result)
    if leftover:
        shown = [f"${{{kind}.{key}}}" for kind, key in leftover]
        raise RenderError(f"{unit.name}: unresolved placeholders {shown}")
    return result


def _merge_props(unit: Unit, props: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for name, spec in unit.props.items():
        if name in props:
            merged[name] = props[name]
        elif spec.default is not None:
            merged[name] = spec.default
        elif name == "children":
            merged[name] = props.get("children", "")
        elif spec.required:
            raise RenderError(f"{unit.name}: missing required prop {name!r}")
        else:
            merged[name] = ""
    if "children" in props and "children" not in merged:
        merged["children"] = props["children"]
    return merged


def _resolve_placeholders(
    text: str,
    props: dict[str, Any],
    design_system: dict[str, Any],
    *,
    allow_missing_props: bool = False,
) -> str:
    """props → designSystem 순으로 최대 몇 회 풀어, 값 안의 중첩 토큰도 처리."""

    def repl(m: re.Match[str]) -> str:
        kind, key = m.group(1), m.group(2)
        if kind == "props":
            if key not in props:
                if allow_missing_props:
                    return m.group(0)
                raise RenderError(f"Unknown prop: {key}")
            return str(props[key])
        if key not in design_system:
            raise RenderError(f"Unknown designSystem key: {key}")
        return str(design_system[key])

    current = text
    for _ in range(8):
        nxt = PLACEHOLDER.sub(repl, current)
        if nxt == current:
            return nxt
        current = nxt
    return current


def _render_body(
    body: str,
    props: dict[str, Any],
    registry: ComponentRegistry,
    design_system: dict[str, Any],
    depth: int,
) -> str:
    out: list[str] = []
    pos = 0
    tokens = list(iter_tags(body))
    i = 0

    while i < len(tokens):
        tok = tokens[i]
        out.append(
            _resolve_placeholders(body[pos : tok.start], props, design_system)
        )

        if tok.kind == "self":
            child_props = {
                k: _resolve_placeholders(v, props, design_system)
                for k, v in tok.attrs.items()
            }
            child_unit = registry.get(tok.name)
            out.append(
                render(
                    child_unit,
                    child_props,
                    registry=registry,
                    design_system=design_system,
                    _depth=depth + 1,
                )
            )
            pos = tok.end
            i += 1
            continue

        if tok.kind == "open":
            close = find_matching_close(body, tok)
            if close is None:
                raise RenderError(f"Unclosed tag [@{tok.name}]")
            inner = body[tok.end : close.start]
            inner_rendered = _render_body(
                inner, props, registry, design_system, depth + 1
            )
            child_props = {
                k: _resolve_placeholders(v, props, design_system)
                for k, v in tok.attrs.items()
            }
            child_props["children"] = inner_rendered
            child_unit = registry.get(tok.name)
            out.append(
                render(
                    child_unit,
                    child_props,
                    registry=registry,
                    design_system=design_system,
                    _depth=depth + 1,
                )
            )
            pos = close.end
            while i < len(tokens) and tokens[i].start < close.end:
                i += 1
            continue

        out.append(tok.raw)
        pos = tok.end
        i += 1

    out.append(_resolve_placeholders(body[pos:], props, design_system))
    return "".join(out)
