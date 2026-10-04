"""Observed input bounds for storm scenarios. Nothing is widened."""

from __future__ import annotations

import json
from pathlib import Path

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "scenario" / "ranges.json"
OMNI = "https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni/omni2.text"


def build_ranges() -> dict[str, object]:
    table = pq.read_table(
        ROOT / "ml" / "data" / "omni_hourly.parquet",
        columns=["time", "speed", "density", "bz_gsm", "kp"],
    )
    frame = table.to_pandas()
    frame["time"] = frame["time"].dt.tz_convert("UTC")
    frame = frame.loc[frame["time"].dt.year >= 1995]

    def bounds(column: str) -> dict[str, float | int | str]:
        values = frame[column].dropna()
        return {
            "min": float(values.min()),
            "max": float(values.max()),
            "count": int(values.shape[0]),
            "source": OMNI,
            "years": "1995+",
        }

    runs: list[int] = []
    run = 0
    for kp in frame["kp"].tolist():
        if kp == kp and kp >= 5:
            run += 1
        elif run:
            runs.append(run)
            run = 0
    if run:
        runs.append(run)

    payload = {
        "speedKmS": bounds("speed"),
        "densityCm3": bounds("density"),
        "bzNt": bounds("bz_gsm"),
        "cmeSpeedKmS": {
            **bounds("speed"),
            "note": "DONKI CME speeds are not in the repo. This bound is the OMNI solar-wind speed extreme, used as the CME speed limit.",
        },
        "durationH": {
            "min": 1,
            "max": int(max(runs) if runs else 1),
            "source": "Consecutive OMNI hours with Kp >= 5, 1995+",
            "years": "1995+",
        },
    }
    return payload


def main() -> None:
    payload = build_ranges()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(OUT, "duration max", payload["durationH"]["max"])


if __name__ == "__main__":
    main()
