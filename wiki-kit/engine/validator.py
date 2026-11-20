"""컴포넌트·페이지 props / 참조 검증."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .loader import ComponentRegistry, Unit
from .tags import iter_tags

PROP_REF = re.compile(r"\$\{props\.(\w+)\}")
DS_REF = re.compile(r"\$\{designSystem\.(\w+)\}")


class ValidationError(Exception):
    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("\n".join(errors))


@dataclass
class ValidationResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def validate_unit(
    unit: Unit,
    registry: ComponentRegistry,
    *,
    design_system_keys: set[str] | None = None,
) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []
    declared = set(unit.props)

    for key in PROP_REF.findall(unit.body):
        if key not in declared and key != "children":
            errors.append(f"{unit.name}: body references undeclared prop ${{props.{key}}}")

    # 엔진이 직접 소비하는 props (본문에 ${props.*}가 없을 수 있음)
    engine_consumed = {"IfTruthy": {"value"}}

    for key in declared:
        if key == "children":
            continue
        if key in engine_consumed.get(unit.name, set()):
            continue
        if f"${{props.{key}}}" not in unit.body:
            warnings.append(f"{unit.name}: declared prop {key!r} unused in body")

    if design_system_keys is not None:
        for key in DS_REF.findall(unit.body):
            if key not in design_system_keys:
                errors.append(f"{unit.name}: unknown designSystem key {key!r}")

    stack: list[str] = []
    for tok in iter_tags(unit.body):
        if tok.kind in ("open", "self"):
            _check_child_tag(unit, registry, tok.name, tok.attrs, errors)
            if tok.kind == "open":
                stack.append(tok.name)
        else:
            if not stack:
                errors.append(f"{unit.name}: unexpected close [/@{tok.name}]")
            elif stack[-1] != tok.name:
                errors.append(
                    f"{unit.name}: mismatched close [/@{tok.name}], open was [@{stack[-1]}]"
                )
                stack.pop()
            else:
                stack.pop()

    if stack:
        errors.append(f"{unit.name}: unclosed tag(s): {', '.join('@' + n for n in stack)}")

    return ValidationResult(ok=not errors, errors=errors, warnings=warnings)


def _check_child_tag(
    unit: Unit,
    registry: ComponentRegistry,
    name: str,
    attrs: dict[str, str],
    errors: list[str],
) -> None:
    try:
        child = registry.get(name)
    except KeyError:
        errors.append(f"{unit.name}: unknown child component @{name}")
        return

    given = set(attrs)
    for prop_name, spec in child.props.items():
        if prop_name == "children":
            continue
        if spec.required and prop_name not in given and spec.default is None:
            errors.append(f"{unit.name}: @{name} missing required prop {prop_name!r}")
    for attr in given:
        if attr not in child.props:
            errors.append(f"{unit.name}: @{name} unknown prop {attr!r}")


def validate_page_props(unit: Unit, props: dict[str, Any]) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    for name, spec in unit.props.items():
        if name == "children":
            continue
        if name not in props:
            if spec.required and spec.default is None:
                errors.append(f"missing required prop: {name}")
            continue
        val = props[name]
        if not _type_ok(val, spec.type):
            errors.append(
                f"prop {name!r}: expected {spec.type}, got {type(val).__name__}"
            )

    for name in props:
        if name not in unit.props:
            warnings.append(f"unknown prop passed: {name}")

    return ValidationResult(ok=not errors, errors=errors, warnings=warnings)


def _type_ok(value: Any, type_name: str) -> bool:
    mapping = {
        "string": str,
        "number": (int, float),
        "boolean": bool,
        "object": dict,
        "array": list,
        "any": object,
    }
    expected = mapping.get(type_name, object)
    return isinstance(value, expected)
