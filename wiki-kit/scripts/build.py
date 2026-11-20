#!/usr/bin/env python3
"""wiki-kit 진입점. 예: python3 scripts/build.py validate|build|list"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.cli import main

if __name__ == "__main__":
    # 인자 없으면 build
    argv = sys.argv[1:] or ["build"]
    main(argv)
