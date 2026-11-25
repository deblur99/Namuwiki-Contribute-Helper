#!/usr/bin/env node
/**
 * Copy nwiki engine + build entry into vscode-nwiki/runtime/
 * so builds work when only a document project folder is open.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, "..");
const wikiKit = path.resolve(extRoot, "..");
const runtime = path.join(extRoot, "runtime");

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  mkdirp(dest);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

rmrf(runtime);
mkdirp(path.join(runtime, "scripts"));
mkdirp(path.join(runtime, "engine", "nwiki"));
mkdirp(path.join(runtime, "docs"));
mkdirp(path.join(runtime, "outputs"));

// Minimal engine package (avoid legacy loader imports in engine/__init__.py)
fs.writeFileSync(
  path.join(runtime, "engine", "__init__.py"),
  '"""Bundled nwiki engine for the vscode-nwiki extension."""\n',
  "utf8"
);

copyFile(
  path.join(wikiKit, "engine", "nwiki_cli.py"),
  path.join(runtime, "engine", "nwiki_cli.py")
);
copyDir(
  path.join(wikiKit, "engine", "nwiki"),
  path.join(runtime, "engine", "nwiki")
);

const buildPy = `#!/usr/bin/env python3
"""Bundled nwiki build entry (extension runtime)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.nwiki_cli import cmd_nwiki_build


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    # Extension calls: build.py build <path>
    if args and args[0] == "build":
        args = args[1:]
    if not args:
        print("usage: build.py build <file.nwiki>", file=sys.stderr)
        return 2
    ns = argparse.Namespace(path=args[0], output=None, check_golden=False)
    return cmd_nwiki_build(ns)


if __name__ == "__main__":
    raise SystemExit(main())
`;
fs.writeFileSync(path.join(runtime, "scripts", "build.py"), buildPy, "utf8");

const spec = path.join(wikiKit, "docs", "SPEC.nwiki");
if (fs.existsSync(spec)) {
  copyFile(spec, path.join(runtime, "docs", "SPEC.nwiki"));
}

console.log(`synced runtime → ${runtime}`);
