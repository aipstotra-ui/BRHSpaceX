"""ml/build_replay.py reproduces the committed replays.

The ONNX forecaster can differ in the last printed digit between machines (seen: 8.772 vs 8.771), so AI forecast
quantiles are compared to 0.002; everything else must match exactly.
"""

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


build_replay = load("build_replay", ROOT / "ml" / "build_replay.py")


def _same(built, committed, path="", tolerance=0.002):
    if isinstance(built, dict):
        assert built.keys() == committed.keys(), path
        for key in built:
            _same(built[key], committed[key], f"{path}.{key}")
    elif isinstance(built, list):
        assert len(built) == len(committed), path
        for index, (a, b) in enumerate(zip(built, committed)):
            _same(a, b, f"{path}[{index}]")
    elif isinstance(built, float) and path.startswith(".aiForecast.rows") and path.rsplit(".", 1)[-1] in {"p10", "p50", "p90"}:
        assert built == pytest.approx(committed, abs=tolerance), path
    else:
        assert built == committed, path


@pytest.mark.parametrize("event", sorted(build_replay.EVENTS))
def test_build_matches_committed_replay(event):
    committed = json.loads((ROOT / "data" / "replays" / f"{event}.json").read_text())
    _same(build_replay.build(event), committed)


def test_every_event_names_window_protons_label_and_markers():
    for event, spec in build_replay.EVENTS.items():
        assert set(spec) >= {"window", "protons", "label", "markers"}, event
        start, end = spec["window"]
        assert start < end, event
