"""Lookahead-greedy action labels from realized Kp. Costs are estimates."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from oof_forecasts import OUT as OOF_PATH

COSTS = json.loads((ML_DIR / "policy_costs.json").read_text())
ACTIONS = ("continue", "checkpoint", "throttle", "safe mode")
ORBITS = (
    {"altitude_km": 500.0, "saa": 0.22, "auroral": 0.02, "eclipse": 0.28},
    {"altitude_km": 1100.0, "saa": 0.12, "auroral": 0.08, "eclipse": 0.22},
    {"altitude_km": 2000.0, "saa": 0.05, "auroral": 0.15, "eclipse": 0.12},
)
CHIPS = (
    {"name": "ai1-spacex", "sigma_bits": 1.0, "shielding": 5.0, "ecc": 1.0},
    {"name": "orin-agx", "sigma_bits": 2.0, "shielding": 2.0, "ecc": 0.7},
    {"name": "h100-starcloud", "sigma_bits": 1.4, "shielding": 3.0, "ecc": 0.8},
)


def action_cost(uncorrectable: float, action: str) -> float:
    row = COSTS["actions"][action]
    return (
        float(row["downtime_hours"]) * float(COSTS["downtime_cost_per_hour"])
        + float(row["uncorrectable_weight"]) * uncorrectable
        + float(row["switch_cost"])
    )


def uncorrectable(kp: float, saa: float, sigma_bits: float) -> float:
    return max(0.0, kp - 2.0) * saa * sigma_bits


def label_for_window(kps: np.ndarray, saa: float, sigma_bits: float) -> int:
    totals = []
    for action in ACTIONS:
        total = 0.0
        for kp in kps:
            total += action_cost(uncorrectable(float(kp), saa, sigma_bits), action)
        totals.append(total)
    return int(np.argmin(totals))


def build_table(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.reset_index(drop=True)
    keep = (frame["kp"] >= 5) | (frame.index % 24 == 0)
    base = frame.loc[keep].copy()
    rows: list[dict[str, float | str | int]] = []
    kp_values = frame["kp"].to_numpy()
    times = frame["time"]
    index_by_time = {value: position for position, value in enumerate(times)}
    for record in base.itertuples(index=False):
        start = index_by_time[record.time]
        window = kp_values[start : start + 8]
        if len(window) < 8:
            continue
        quiet = float(record.kp) < 5 and int(record.year) % 5 != 0
        chips = CHIPS if not quiet else CHIPS[:1]
        for chip in chips:
            for orbit in ORBITS:
                rows.append(
                    {
                        "time": record.time,
                        "year": int(record.year),
                        "split": record.split,
                        "kp": float(record.kp),
                        "dst": float(record.dst) if record.dst == record.dst else 0.0,
                        "kp_p10": float(record.kp_p10),
                        "kp_p50": float(record.kp_p50),
                        "kp_p90": float(record.kp_p90),
                        "oof_fold": int(record.oof_fold),
                        "altitude_km": orbit["altitude_km"],
                        "saa": orbit["saa"],
                        "auroral": orbit["auroral"],
                        "eclipse": orbit["eclipse"],
                        "chip": chip["name"],
                        "sigma_bits": chip["sigma_bits"],
                        "shielding": chip["shielding"],
                        "ecc": chip["ecc"],
                        "label": label_for_window(window, orbit["saa"], chip["sigma_bits"]),
                    }
                )
    return pd.DataFrame(rows)


def main() -> None:
    frame = pd.read_parquet(OOF_PATH)
    table = build_table(frame)
    path = ROOT / "ml" / "data" / "policy_table.parquet"
    table.to_parquet(path, index=False)
    print(f"rows {len(table)} -> {path}")


if __name__ == "__main__":
    main()
