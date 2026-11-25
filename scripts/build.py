#!/usr/bin/env python3
"""Build project outputs: {project}/templates + data/design-system.json → {project}/outputs/"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLACEHOLDER = re.compile(r"\$\{(?:designSystem|DesignSystem)\.(\w+)\}")


def design_system_path(project: Path) -> Path | None:
    for name in ("design-system.json", "designSystem.json"):
        p = project / "data" / name
        if p.is_file():
            return p
    return None


def is_project(path: Path) -> bool:
    return (path / "templates").is_dir() and design_system_path(path) is not None


def discover_projects() -> list[str]:
    return sorted(
        p.name
        for p in ROOT.iterdir()
        if p.is_dir() and not p.name.startswith(".") and p.name != "scripts" and is_project(p)
    )


def apply_rules(text: str, ds: dict) -> str:
    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        if key not in ds:
            raise KeyError(f"Unknown designSystem key: {key}")
        return str(ds[key])

    return PLACEHOLDER.sub(repl, text)


def build_project(name: str) -> None:
    project = ROOT / name
    if not is_project(project):
        raise SystemExit(
            f"Not a project (need templates/ and data/design-system.json): {name}"
        )

    ds_path = design_system_path(project)
    assert ds_path is not None
    templates = project / "templates"
    outputs = project / "outputs"
    ds = json.loads(ds_path.read_text(encoding="utf-8"))
    outputs.mkdir(exist_ok=True)

    files = sorted(templates.glob("*.md"))
    if not files:
        raise SystemExit(f"No templates in {templates}")

    for src in files:
        raw = src.read_text(encoding="utf-8")
        out = apply_rules(raw, ds)
        unresolved = PLACEHOLDER.findall(out)
        if unresolved:
            raise RuntimeError(f"{name}/{src.name}: unresolved placeholders {unresolved}")
        (outputs / src.name).write_text(out, encoding="utf-8")
        print(f"wrote {name}/outputs/{src.name}")


def main(argv: list[str] | None = None) -> None:
    args = list(argv if argv is not None else sys.argv[1:])
    projects = args if args else discover_projects()
    if not projects:
        raise SystemExit(
            "No projects found. Pass a name or add <name>/templates + data/design-system.json."
        )

    for name in projects:
        build_project(name)


if __name__ == "__main__":
    main()
