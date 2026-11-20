"""wiki-kit CLI: validate / build."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .loader import ComponentRegistry, load_json
from .renderer import RenderError, render
from .validator import validate_page_props, validate_unit

ROOT = Path(__file__).resolve().parent.parent


def build_registry() -> ComponentRegistry:
    reg = ComponentRegistry()
    reg.load_dir(ROOT / "components", "*.ncomp")
    reg.load_dir(ROOT / "templates", "*.ntpl")
    # templates도 이름으로 참조 가능하게 등록
    return reg


def cmd_validate(_: argparse.Namespace) -> int:
    reg = build_registry()
    ds_path = ROOT / "data" / "designSystem.json"
    ds_keys = set(load_json(ds_path)) if ds_path.is_file() else None

    errors: list[str] = []
    warnings: list[str] = []

    for unit in reg.all():
        result = validate_unit(unit, reg, design_system_keys=ds_keys)
        errors.extend(result.errors)
        warnings.extend(result.warnings)
        status = "ok" if result.ok else "FAIL"
        print(f"[{status}] {unit.kind} {unit.name} ({unit.path.relative_to(ROOT)})")

    pages_dir = ROOT / "pages"
    if pages_dir.is_dir():
        for page in sorted(pages_dir.glob("*.json")):
            data = load_json(page)
            template_name = data.get("template")
            props = data.get("props") or {}
            if not template_name:
                errors.append(f"{page.name}: missing template")
                continue
            try:
                unit = reg.get(template_name)
            except KeyError:
                errors.append(f"{page.name}: unknown template {template_name!r}")
                continue
            result = validate_page_props(unit, props)
            errors.extend(f"{page.name}: {e}" for e in result.errors)
            warnings.extend(f"{page.name}: {w}" for w in result.warnings)
            status = "ok" if result.ok else "FAIL"
            print(f"[{status}] page {page.stem} → {template_name}")

    for w in warnings:
        print(f"warn: {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"error: {e}", file=sys.stderr)
        return 1
    print("validate: all good")
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    reg = build_registry()
    ds = load_json(ROOT / "data" / "designSystem.json")
    out_dir = ROOT / "outputs"
    out_dir.mkdir(exist_ok=True)

    pages_dir = ROOT / "pages"
    pages = sorted(pages_dir.glob("*.json"))
    if args.page:
        pages = [p for p in pages if p.stem == args.page]
        if not pages:
            print(f"No page named {args.page!r}", file=sys.stderr)
            return 1

    if not pages:
        print("No pages in pages/*.json", file=sys.stderr)
        return 1

    # 빌드 전 검증
    v_code = cmd_validate(argparse.Namespace())
    if v_code != 0 and not args.force:
        print("build aborted (use --force to override)", file=sys.stderr)
        return v_code

    for page in pages:
        data = load_json(page)
        template_name = data["template"]
        props = data.get("props") or {}
        unit = reg.get(template_name)
        try:
            markup = render(unit, props, registry=reg, design_system=ds)
        except (RenderError, KeyError) as exc:
            print(f"render failed for {page.name}: {exc}", file=sys.stderr)
            return 1
        dest_name = data.get("output") or f"{page.stem}.md"
        dest = out_dir / dest_name
        dest.write_text(markup, encoding="utf-8")
        print(f"wrote outputs/{dest_name}")

    return 0


def cmd_list(_: argparse.Namespace) -> int:
    reg = build_registry()
    for unit in reg.all():
        props = ", ".join(unit.props) or "(none)"
        print(f"{unit.kind:10} {unit.name:24} props=[{props}]")
    return 0


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="wiki-kit", description="Namuwiki component kit")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_val = sub.add_parser("validate", help="Validate components, templates, pages")
    p_val.set_defaults(func=cmd_validate)

    p_build = sub.add_parser("build", help="Build pages into outputs/")
    p_build.add_argument("page", nargs="?", help="Optional page stem to build")
    p_build.add_argument("--force", action="store_true", help="Build even if validate fails")
    p_build.set_defaults(func=cmd_build)

    p_list = sub.add_parser("list", help="List registered units")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args(argv)
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
