"""May 2024 replay window. SEP onset is 2024-05-10 13:35 UT, not May 9."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "replays" / "may2024.json"


def g_level(kp: float) -> str:
    for level, minimum in ((5, 9), (4, 8), (3, 7), (2, 6), (1, 5)):
        if kp >= minimum:
            return f"G{level}"
    return "G0"


def main() -> None:
    omni = pq.read_table(ROOT / "ml" / "data" / "omni_hourly.parquet", columns=["time", "kp", "dst"]).to_pandas()
    omni["time"] = pd.to_datetime(omni["time"], utc=True)
    start = pd.Timestamp("2024-05-05T00:00:00Z")
    end = pd.Timestamp("2024-05-16T23:00:00Z")
    window = omni.loc[(omni["time"] >= start) & (omni["time"] <= end)].copy()
    forecasts = pd.read_parquet(ROOT / "ml" / "data" / "oof_forecasts.parquet")
    forecasts["time"] = pd.to_datetime(forecasts["time"], utc=True)
    merged = window.merge(forecasts[["time", "kp_p50"]], on="time", how="left")
    protons = pq.read_table(
        ROOT / "data" / "history" / "goes_protons_202405.parquet",
        columns=["time", "flux"],
    ).to_pandas()
    protons["time"] = pd.to_datetime(protons["time"], utc=True)
    protons = protons.loc[(protons["time"] >= start) & (protons["time"] <= end)]
    hourly_flux = protons.groupby(protons["time"].dt.floor("h"))["flux"].mean()
    hours = []
    for row in merged.itertuples(index=False):
        stamp = row.time.floor("h")
        flux = hourly_flux.get(stamp)
        hours.append(
            {
                "time": row.time.isoformat().replace("+00:00", "Z"),
                "kp": None if row.kp != row.kp else float(row.kp),
                "dst": None if row.dst != row.dst else float(row.dst),
                "dstLabel": "WDC Kyoto provisional",
                "gLevel": None if row.kp != row.kp else g_level(float(row.kp)),
                "forecastKpP50": None if row.kp_p50 != row.kp_p50 else float(row.kp_p50),
                "goesProtonFlux": None if flux is None or flux != flux else float(flux),
            }
        )
    payload = {
        "label": "test period",
        "window": ["2024-05-05T00:00:00Z", "2024-05-16T23:00:00Z"],
        "markers": {
            "sepOnset": ["2024-05-10T13:35:00Z", "2024-05-11T02:10:00Z"],
            "kp9": ["2024-05-11T00:00:00Z", "2024-05-11T09:00:00Z"],
        },
        "hours": hours,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"bytes {OUT.stat().st_size} hours {len(hours)}")


if __name__ == "__main__":
    main()
