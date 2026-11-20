"""컴포넌트·템플릿 파일 로더.

파일 형식 (.ncomp / .ntpl):

    ---
    name: Infobox
    kind: component   # component | template
    props:
      title:
        type: string
        required: true
      accentColor:
        type: string
        default: "${designSystem.accentColor}"
    ---
    (본문: 나무위키 마크업 + ${props.*} + ${designSystem.*} + [@Child /])
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?(.*)\Z", re.DOTALL)


@dataclass
class PropSpec:
    type: str = "string"
    required: bool = False
    default: Any = None


@dataclass
class Unit:
    """컴포넌트 또는 템플릿 단위."""

    name: str
    kind: str  # component | template
    path: Path
    body: str
    props: dict[str, PropSpec] = field(default_factory=dict)
    description: str = ""


def _parse_simple_yaml(text: str) -> dict[str, Any]:
    """의존성 없이 frontmatter용 최소 YAML 파서 (flat + props 중첩만)."""
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(0, root)]
    pending_key: str | None = None

    for raw in text.splitlines():
        if not raw.strip() or raw.strip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()

        while len(stack) > 1 and indent < stack[-1][0]:
            stack.pop()
        current = stack[-1][1]

        if ":" in line:
            key, _, rest = line.partition(":")
            key = key.strip()
            rest = rest.strip()
            if rest == "":
                nested: dict[str, Any] = {}
                current[key] = nested
                stack.append((indent + 2, nested))
                pending_key = key
            else:
                current[key] = _scalar(rest)
                pending_key = None
        else:
            raise ValueError(f"Unsupported frontmatter line: {raw!r}")

    _ = pending_key
    return root


def _scalar(value: str) -> Any:
    if value in ("true", "True"):
        return True
    if value in ("false", "False"):
        return False
    if value in ("null", "Null", "~"):
        return None
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        pass
    return value


def _props_from_meta(meta: dict[str, Any]) -> dict[str, PropSpec]:
    raw = meta.get("props") or {}
    if not isinstance(raw, dict):
        raise ValueError("props must be a mapping")
    out: dict[str, PropSpec] = {}
    for name, spec in raw.items():
        if isinstance(spec, str):
            out[name] = PropSpec(type=spec)
        elif isinstance(spec, dict):
            out[name] = PropSpec(
                type=str(spec.get("type", "string")),
                required=bool(spec.get("required", False)),
                default=spec.get("default"),
            )
        else:
            raise ValueError(f"Invalid prop spec for {name!r}")
    return out


def load_unit(path: Path) -> Unit:
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER.match(text)
    if not m:
        raise ValueError(f"{path}: missing YAML frontmatter (--- ... ---)")

    meta = _parse_simple_yaml(m.group(1))
    body = m.group(2)
    name = str(meta.get("name") or path.stem)
    kind = str(meta.get("kind") or ("template" if path.suffix == ".ntpl" else "component"))
    if kind not in ("component", "template"):
        raise ValueError(f"{path}: kind must be component|template, got {kind!r}")

    return Unit(
        name=name,
        kind=kind,
        path=path,
        body=body.rstrip("\n") + "\n",
        props=_props_from_meta(meta),
        description=str(meta.get("description") or ""),
    )


class ComponentRegistry:
    def __init__(self) -> None:
        self._units: dict[str, Unit] = {}

    def register(self, unit: Unit) -> None:
        if unit.name in self._units:
            prev = self._units[unit.name].path
            raise ValueError(f"Duplicate unit name {unit.name!r}: {prev} vs {unit.path}")
        self._units[unit.name] = unit

    def load_dir(self, directory: Path, pattern: str = "*.ncomp") -> None:
        if not directory.is_dir():
            return
        for path in sorted(directory.glob(pattern)):
            self.register(load_unit(path))

    def get(self, name: str) -> Unit:
        if name not in self._units:
            raise KeyError(f"Unknown component/template: {name}")
        return self._units[name]

    def names(self) -> list[str]:
        return sorted(self._units)

    def all(self) -> list[Unit]:
        return [self._units[n] for n in self.names()]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))
