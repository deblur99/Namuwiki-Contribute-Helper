"""CLI helpers for nwiki build/parse (kept separate from legacy [@] CLI)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .nwiki.errors import NwikiError
from .nwiki.pipeline import build_nwiki, parse_nwiki_file

ROOT = Path(__file__).resolve().parent.parent


def cmd_nwiki_build(args: argparse.Namespace) -> int:
    target = Path(args.path)
    if not target.is_file():
        # allow examples/introduce.nwiki relative to wiki-kit root
        alt = ROOT / args.path
        if alt.is_file():
            target = alt
        else:
            print(f"file not found: {args.path}", file=sys.stderr)
            return 1
    try:
        markup = build_nwiki(target)
    except NwikiError as exc:
        print(f"nwiki error: {exc}", file=sys.stderr)
        return 1

    out_dir = ROOT / "outputs"
    out_dir.mkdir(exist_ok=True)
    dest_name = args.output or f"{target.stem}.md"
    dest = out_dir / dest_name
    dest.write_text(markup + ("\n" if not markup.endswith("\n") else ""), encoding="utf-8")
    print(f"wrote outputs/{dest.name}")

    if args.check_golden:
        golden = ROOT / "fixtures" / f"{target.stem}.golden.md"
        if not golden.is_file():
            print(f"golden not found: {golden}", file=sys.stderr)
            return 1
        got = dest.read_text(encoding="utf-8").rstrip("\n")
        exp = golden.read_text(encoding="utf-8").rstrip("\n")
        if got != exp:
            print("GOLDEN MISMATCH", file=sys.stderr)
            _print_diff(exp, got)
            return 1
        print("golden ok")
    return 0


def cmd_nwiki_parse(args: argparse.Namespace) -> int:
    target = Path(args.path)
    if not target.is_file():
        alt = ROOT / args.path
        if alt.is_file():
            target = alt
        else:
            print(f"file not found: {args.path}", file=sys.stderr)
            return 1
    try:
        doc = parse_nwiki_file(target)
    except NwikiError as exc:
        print(f"nwiki error: {exc}", file=sys.stderr)
        return 1
    print(f"path={doc.path}")
    print(f"stmts={[(s.name, s.args) for s in doc.stmts]}")
    print(f"props={doc.script_props}")
    print(f"template_roots={[e.name for e in doc.template]}")
    return 0


def _print_diff(exp: str, got: str) -> None:
    import difflib

    for line in difflib.unified_diff(
        exp.splitlines(), got.splitlines(), fromfile="golden", tofile="got", lineterm=""
    ):
        print(line, file=sys.stderr)


def register_nwiki_commands(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("nwiki-build", help="Build a .nwiki file to outputs/")
    p.add_argument("path", help="Path to .nwiki (e.g. examples/introduce.nwiki)")
    p.add_argument("-o", "--output", help="Output filename under outputs/")
    p.add_argument(
        "--check-golden",
        action="store_true",
        help="Compare with fixtures/<stem>.golden.md",
    )
    p.set_defaults(func=cmd_nwiki_build)

    p2 = sub.add_parser("nwiki-parse", help="Parse .nwiki and print summary")
    p2.add_argument("path", help="Path to .nwiki")
    p2.set_defaults(func=cmd_nwiki_parse)
