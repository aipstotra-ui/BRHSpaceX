"""ranges.json matches a fresh read of the OMNI table."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_ranges_are_reproducible() -> None:
    spec = importlib.util.spec_from_file_location("scenario_ranges", ROOT / "ml" / "scenario_ranges.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    saved = json.loads((ROOT / "data" / "scenario" / "ranges.json").read_text())
    fresh = module.build_ranges()
    assert saved == fresh
