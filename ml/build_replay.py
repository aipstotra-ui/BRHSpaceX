"""Build a storm replay for the timeline: data/replays/<event>.json.

    ml/.venv/bin/python ml/build_replay.py --event may2024 [--out PATH]

Each event in EVENTS names its window, its proton source, its split label and its chart markers. Hourly Kp and Dst
come from ml/data/omni_hourly.parquet, the out-of-fold Kp P50 from ml/data/oof_forecasts.parquet, and the AI
forecast rows from the exported browser models. The app reads the files through lib/events/registry.ts.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import sys

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
REPLAY_DIR = ROOT / "data" / "replays"
MODEL_DIR = ROOT / "public" / "models"
ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

# A G3 storm starts at Kp 7 (NOAA scale). The warning looks for the first AI issue whose P90 reaches it.
WARN_KP = 7.0

AI_NOTE = "Browser forecaster (public/models) run on {label} inputs. Display only: nothing was fitted or tuned on it."

# One entry per replay. "protons" says how to get the >10 MeV integral: "sgps" integrates GOES-R SGPS differential
# channels (integral_above_10mev); new kinds are added with the events that need them.
EVENTS: dict[str, dict] = {
    "may2024": {
        "window": ("2024-05-05T00:00:00Z", "2024-05-16T23:00:00Z"),
        "protons": {"kind": "sgps", "file": "goes_protons_202405.parquet"},
        # The model split puts 2023 onward in the test period.
        "label": "test period",
        # SEP onset is 2024-05-10 13:35 UT, not May 9.
        "markers": {
            "sepOnset": ["2024-05-10T13:35:00Z", "2024-05-11T02:10:00Z"],
            "kp9": ["2024-05-11T00:00:00Z", "2024-05-11T09:00:00Z"],
        },
    },
}


INTEGRAL_FLOOR_KEV = 10_000.0


def integral_above_10mev(protons: pd.DataFrame) -> pd.Series:
    """GOES-16 SGPS differential channels -> integral flux above 10 MeV, pfu (1/cm2/s/sr), per timestamp.

    Differential flux is per keV. Per sensor, each channel spans from its lower edge to that sensor's next lower
    edge (estimate: SGPS upper edges are not in the parquet). The slice from 10 MeV to the first channel above it
    is priced at that channel's flux, a slight underestimate on a falling spectrum. The >500 MeV integral channel
    is added as is. Sensors are averaged.
    """
    parts = []
    for sensor, rows in protons.groupby("sensor"):
        diff = rows.loc[rows["flux_kind"] == "differential"]
        top = rows.loc[rows["flux_kind"] != "differential"]
        edges = sorted(diff["energy_low_kev"].unique())
        last = float(top["energy_low_kev"].min()) if len(top) else edges[-1] * 2
        upper = dict(zip(edges, edges[1:] + [last]))
        above = [edge for edge in edges if edge >= INTEGRAL_FLOOR_KEV]
        first = above[0] if above else None
        width = diff["energy_low_kev"].map(
            lambda low: (upper[low] - low) + (low - INTEGRAL_FLOOR_KEV if low == first else 0.0)
            if low >= INTEGRAL_FLOOR_KEV
            else 0.0
        )
        flux = (diff["flux"].clip(lower=0) * width).groupby(diff["time"]).sum()
        flux = flux.add(top.groupby("time")["flux"].sum(), fill_value=0.0)
        parts.append(flux.rename(sensor))
    return pd.concat(parts, axis=1).mean(axis=1)


def ai_forecasts(start: pd.Timestamp, end: pd.Timestamp) -> list[dict]:
    """Run the exported browser forecaster (public/models/*.onnx) on the replay window.

    Same features (ml/features.py) and calibration (forecast_common.apply_interval) as training and the
    browser. Issue times are hours divisible by 3. No test label is read and nothing is fitted.
    """
    import onnxruntime as ort

    import features
    import forecast_common as common

    card = json.loads((MODEL_DIR / "model-card.json").read_text())
    names = card["feature_names"]
    omni = features.load_omni()
    feats = features.compute_features(omni)
    issue = feats.index[(feats.index >= start - pd.Timedelta(hours=24)) & (feats.index <= end) & (feats.index.hour % 3 == 0)]
    x = feats.loc[issue, names].to_numpy(dtype=np.float32)
    rows = []
    for horizon in (3, 6, 12, 24):
        quantiles = {}
        for model in card["models"]:
            if model["target"] != "kp" or model["horizon_h"] != horizon:
                continue
            session = ort.InferenceSession(str(MODEL_DIR / model["file"]), providers=["CPUExecutionProvider"])
            out = session.run([model["output_name"]], {card["input_name"]: x})[0]
            quantiles[model["quantile"]] = np.asarray(out, dtype=float).reshape(-1)
        delta = float(card["calibration"][f"kp_h{horizon:02d}"])
        low, mid, high = common.apply_interval("kp", quantiles[0.1], quantiles[0.5], quantiles[0.9], delta)
        for i, stamp in enumerate(issue):
            # Kp at horizon h is the 3-hour block that ends at t+h, stored on hour t+h-1 (features.py).
            target = stamp + pd.Timedelta(hours=horizon - 1)
            lo, hi = sorted((float(low[i]), float(high[i])))
            rows.append(
                {
                    "issued": stamp.isoformat().replace("+00:00", "Z"),
                    "horizonH": horizon,
                    "target": target.isoformat().replace("+00:00", "Z"),
                    "p10": round(lo, 3),
                    "p50": round(float(mid[i]), 3),
                    "p90": round(hi, 3),
                }
            )
    return rows


def first_warning(forecasts: list[dict], hours: list[dict]) -> dict | None:
    """Earliest issue whose P90 reaches G3 (Kp 7), and the first observed Kp 7 block.

    An issue at t uses OMNI rows through t+59 min, so it is usable from t+1 h. Lead time counts from then.
    """
    observed = next((h["time"] for h in hours if h["kp"] is not None and h["kp"] >= WARN_KP), None)
    hits = sorted((f for f in forecasts if f["p90"] >= WARN_KP), key=lambda f: (f["issued"], f["horizonH"]))
    if not hits or observed is None:
        return None
    first = hits[0]
    usable = pd.Timestamp(first["issued"]) + pd.Timedelta(hours=1)
    lead = (pd.Timestamp(observed) - usable).total_seconds() / 3600
    return {"kp": WARN_KP, "issued": first["issued"], "usableAt": usable.isoformat().replace("+00:00", "Z"),
            "horizonH": first["horizonH"], "p90": first["p90"], "firstObservedAt": observed, "leadHours": lead}


def g_level(kp: float) -> str:
    for level, minimum in ((5, 9), (4, 8), (3, 7), (2, 6), (1, 5)):
        if kp >= minimum:
            return f"G{level}"
    return "G0"


def hourly_protons(source: dict, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """>10 MeV integral flux per hour, pfu. The mean of [T-1h, T) is stamped T, so hour T sees no later minute."""
    if source["kind"] != "sgps":
        raise ValueError(f"unknown proton source kind {source['kind']!r}")
    protons = pq.read_table(
        ROOT / "data" / "history" / source["file"],
        columns=["time", "sensor", "energy_low_kev", "flux", "flux_kind"],
    ).to_pandas()
    protons["time"] = pd.to_datetime(protons["time"], utc=True)
    protons = protons.loc[(protons["time"] >= start) & (protons["time"] <= end)]
    integral = integral_above_10mev(protons)
    # SGPS avg1m stamps are the start of each minute.
    return integral.groupby(integral.index.floor("h") + pd.Timedelta(hours=1)).mean()


def build(event: str) -> dict:
    spec = EVENTS[event]
    omni = pq.read_table(ROOT / "ml" / "data" / "omni_hourly.parquet", columns=["time", "kp", "dst"]).to_pandas()
    omni["time"] = pd.to_datetime(omni["time"], utc=True)
    start = pd.Timestamp(spec["window"][0])
    end = pd.Timestamp(spec["window"][1])
    window = omni.loc[(omni["time"] >= start) & (omni["time"] <= end)].copy()
    forecasts = pd.read_parquet(ROOT / "ml" / "data" / "oof_forecasts.parquet")
    forecasts["time"] = pd.to_datetime(forecasts["time"], utc=True)
    merged = window.merge(forecasts[["time", "kp_p50"]], on="time", how="left")
    hourly_flux = hourly_protons(spec["protons"], start, end)
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
    forecasts = ai_forecasts(start, end)
    return {
        "label": spec["label"],
        "aiForecast": {
            "note": AI_NOTE.format(label=spec["label"].replace(" ", "-")),
            "rows": forecasts,
            "firstWarning": first_warning(forecasts, hours),
        },
        "window": list(spec["window"]),
        "markers": spec["markers"],
        "hours": hours,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--event", required=True, choices=sorted(EVENTS))
    parser.add_argument("--out", type=Path, default=None, help="default data/replays/<event>.json")
    args = parser.parse_args()
    out = args.out or REPLAY_DIR / f"{args.event}.json"
    payload = build(args.event)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"{args.event}: bytes {out.stat().st_size} hours {len(payload['hours'])}")


if __name__ == "__main__":
    main()
