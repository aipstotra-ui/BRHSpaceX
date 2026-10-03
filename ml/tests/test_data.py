"""Checks for the M2 training table, SEP labels, and GFZ Kp."""

from __future__ import annotations

import csv
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


gscale_mod = load_module("gscale", ROOT / "ml" / "gscale.py")
scrape_mod = load_module("scrape_sep", ROOT / "ml" / "scrape_sep.py")

FILLS = {
    "by_gsm": 999.9,
    "bz_gsm": 999.9,
    "speed": 9999.0,
    "density": 999.9,
    "kp": 99.0,
    "dst": 99999.0,
    "f107": 999.9,
}


def omni_table():
    return pq.read_table(ROOT / "ml" / "data" / "omni_hourly.parquet")


def test_omni_may_2024_kp_and_dst():
    table = omni_table()
    times = table.column("time").to_numpy()
    window = (times >= np.datetime64("2024-05-10T00:00:00")) & (times < np.datetime64("2024-05-12T00:00:00"))
    kp = table.column("kp").to_numpy()[window]
    dst = table.column("dst").to_numpy()[window]
    finite_kp = kp[np.isfinite(kp)]
    finite_dst = dst[np.isfinite(dst)]
    assert finite_kp.size
    assert float(np.max(finite_kp)) == 9.0

    gfz = json.loads((ROOT / "data" / "snapshots" / "gfz_kp_2024-05.json").read_text())
    block = gfz["datetime"].index("2024-05-11T00:00:00Z")
    assert gfz["status"][block] == "def"
    assert gfz["Kp"][block] == 9.0
    assert float(np.max(finite_kp)) == gfz["Kp"][block]

    # Tolerance is the milestone check: ±20 nT around the provisional −406 nT.
    assert abs(float(np.min(finite_dst)) - (-406)) <= 20


def test_no_parsed_column_contains_its_fill():
    table = omni_table()
    names = set(table.column_names)
    assert not any("proton" in name for name in names)
    for name, fill in FILLS.items():
        values = table.column(name).to_numpy()
        finite = values[np.isfinite(values)]
        assert not np.any(np.abs(finite - fill) <= 1e-6), name


def test_bz_1995_coverage():
    table = omni_table()
    times = table.column("time").to_numpy()
    years = times.astype("datetime64[Y]").astype(int) + 1970
    mask = years == 1995
    bz = table.column("bz_gsm").to_numpy()[mask]
    assert bz.size
    assert float(np.isfinite(bz).mean()) >= 0.95


def test_sep_matches_page_and_known_onsets():
    page_rows = scrape_mod.parse_sep_html(scrape_mod.fetch_sep_html())
    with (ROOT / "data" / "history" / "sep_events.csv").open(newline="") as handle:
        csv_rows = list(csv.DictReader(handle))
    assert len(csv_rows) == len(page_rows)
    assert csv_rows[0]["start_ut"].startswith("1976-04-30")
    starts = {row["start_ut"] for row in csv_rows}
    assert "2024-05-10 13:35" in starts
    assert "2024-05-11 02:10" in starts


def test_gfz_feb_2022_and_gscale():
    gfz = json.loads((ROOT / "data" / "snapshots" / "gfz_kp_2022-02.json").read_text())
    assert max(gfz["Kp"]) == 5.333
    assert gscale_mod.gscale(5.333) == "G1"
    assert gscale_mod.gscale(4.67) == "G0"


def test_goes_may_2024_proton_history_parses():
    path = ROOT / "data" / "history" / "goes_protons_202405.parquet"
    assert path.exists()
    table = pq.read_table(path, columns=["time", "flux"])
    times = table.column("time").to_numpy()
    flux = table.column("flux").to_numpy()
    window = (times >= np.datetime64("2024-05-11T00:00:00")) & (times < np.datetime64("2024-05-12T00:00:00"))
    assert window.any()
    assert np.isfinite(flux[window]).any()
