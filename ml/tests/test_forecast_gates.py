"""Read the frozen test report. Do not score the test set again."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "data" / "validation" / "forecast.json"
LOG = ROOT / "data" / "validation" / "test-runs.log"


def test_forecast_gates_and_single_log_line():
    report = json.loads(REPORT.read_text())
    lines = [line for line in LOG.read_text().splitlines() if line.strip()]
    versions = [line.split()[1] for line in lines]
    assert len(lines) == len(set(versions)) == 1
    assert versions[0] == report["model_version"]
    assert lines[0].endswith("forecast --final")
    for row in report["rows"]:
        coverage = row["coverage_p10_p90"]
        assert 0.70 <= coverage <= 0.90
        if row["horizon_h"] in (6, 12, 24):
            assert row["skill"] > 0.0


def test_second_final_is_refused():
    before = LOG.read_text()
    result = subprocess.run(
        [sys.executable, str(ROOT / "ml" / "evaluate.py"), "--final"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "refusing" in result.stderr or "refusing" in result.stdout
    assert LOG.read_text() == before
