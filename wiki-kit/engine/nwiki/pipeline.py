"""High-level parse / build entrypoints for .nwiki files."""

from __future__ import annotations

from pathlib import Path

from .parser import parse_file
from .render import render_document
from .resolve import resolve_imports
from .validate import validate_document


def parse_nwiki_file(path: str | Path):
    return parse_file(str(path))


def build_nwiki(path: str | Path) -> str:
    p = Path(path)
    doc = parse_file(str(p))
    resolved = resolve_imports(doc)
    validate_document(resolved)
    return render_document(resolved)
