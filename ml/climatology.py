"""Storm climatology from OMNI Kp and the NCEI SEP table.

This is not a forecast and must not be cited as forecast skill.
Solar-cycle phase uses F10.7 bands because sunspot R (OMNI word 40) is not
in the parsed hourly table. Those bands are an estimate.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))
from gscale import gscale  # noqa: E402
PARQUET = ROOT / "ml" / "data" / "omni_hourly.parquet"
SEP_CSV = ROOT / "data" / "history" / "sep_events.csv"
OUT = ROOT / "data" / "orbit" / "climatology.json"

# estimate: F10.7 sfu bands standing in for solar-cycle phase.
# Sunspot number was not parsed (OMNI word 40).
F107_LOW = 80.0
F107_HIGH = 150.0
LEVELS = ("G0", "G1", "G2", "G3", "G4", "G5")


def phase_of(f107: float | None) -> str:
    if f107 is None or f107 != f107:
        return "unknown"
    if f107 < F107_LOW:
        return "low"
    if f107 >= F107_HIGH:
        return "high"
    return "mid"


def _empty_levels() -> dict[str, dict[str, int]]:
    return {level: {"blocks": 0, "hours": 0} for level in LEVELS}


def build() -> dict[str, object]:
    table = pq.read_table(PARQUET, columns=["time", "kp", "f107"])
    times = table.column("time").to_pylist()
    kps = table.column("kp").to_pylist()
    f107s = table.column("f107").to_pylist()

    blocks: dict[tuple[int, int], dict[str, float | None]] = {}
    years: set[int] = set()
    for when in times:
        if when is None:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        years.add(when.year)
    for when, kp, f107 in zip(times, kps, f107s):
        if when is None or kp is None or kp != kp:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        years.add(when.year)
        # One Kp block is three hours. The hour is the block start.
        block_hour = (when.hour // 3) * 3
        key = (int(when.strftime("%Y%m%d")), block_hour)
        current = blocks.get(key)
        if current is None or when >= current["when"]:  # type: ignore[operator]
            blocks[key] = {"when": when, "kp": float(kp), "f107": None if f107 != f107 else float(f107)}

    by_year: dict[str, dict[str, dict[str, int]]] = defaultdict(_empty_levels)
    by_phase: dict[str, dict[str, dict[str, int]]] = defaultdict(_empty_levels)
    f107_by_phase: dict[str, list[float]] = defaultdict(list)

    for row in blocks.values():
        when = row["when"]
        assert isinstance(when, datetime)
        level = gscale(float(row["kp"]))  # type: ignore[arg-type]
        year = str(when.year)
        phase = phase_of(row["f107"] if isinstance(row["f107"], float) else None)
        for bucket in (by_year[year], by_phase[phase]):
            bucket[level]["blocks"] += 1
            bucket[level]["hours"] += 3
        if isinstance(row["f107"], float):
            f107_by_phase[phase].append(row["f107"])

    sep_by_year: dict[str, int] = defaultdict(int)
    with SEP_CSV.open() as handle:
        for row in csv.DictReader(handle):
            start = row["start_ut"].strip()
            if len(start) < 4:
                continue
            sep_by_year[start[:4]] += 1

    def pack_levels(source: dict[str, dict[str, int]]) -> dict[str, dict[str, int]]:
        return {level: {"blocks": source[level]["blocks"], "hours": source[level]["hours"]} for level in LEVELS}

    phases = {}
    for name, levels in sorted(by_phase.items()):
        values = sorted(f107_by_phase.get(name, []))
        mid = values[len(values) // 2] if values else None
        phases[name] = {
            "levels": pack_levels(levels),
            "f107Count": len(values),
            "f107Median": mid,
        }

    year_list = sorted(years)
    return {
        "years": year_list,
        "yearCount": len(year_list),
        "blockHours": 3,
        "phaseMethod": "estimate: F10.7 < 80 low, 80–150 mid, >= 150 high. Sunspot R was not in the parsed OMNI table.",
        "sources": {
            "kp": "https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni/omni2.text",
            "gscale": "https://www.spaceweather.gov/noaa-scales-explanation",
            "sep": "NOAA NCEI SEP table via data/history/sep_events.csv",
        },
        "byYear": {year: pack_levels(levels) for year, levels in sorted(by_year.items())},
        "byPhase": phases,
        "sepEventsByYear": dict(sorted(sep_by_year.items())),
        "sepEventTotal": sum(sep_by_year.values()),
        "notForecastSkill": True,
    }


def main() -> None:
    payload = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"years {payload['yearCount']} sep {payload['sepEventTotal']} -> {OUT}")


if __name__ == "__main__":
    main()
