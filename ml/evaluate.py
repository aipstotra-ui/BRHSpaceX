"""Score the frozen forecaster on the test set.

`--final` writes data/validation/forecast.json and appends one log line.
It refuses a model version that is already in the log. Without `--final`
it does not read test labels.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import features
import forecast_common as common
import splits


def version_already_logged(version: str, log_path: Path | None = None) -> bool:
    path = log_path or common.TEST_RUNS_LOG
    if not path.exists():
        return False
    for line in path.read_text().splitlines():
        parts = line.split()
        if len(parts) >= 4 and parts[1] == version and parts[2] == "forecast" and parts[3] == "--final":
            return True
    return False


def append_log(version: str, when: datetime) -> None:
    common.TEST_RUNS_LOG.parent.mkdir(parents=True, exist_ok=True)
    line = f"{when.strftime('%Y-%m-%d')} {version} forecast --final\n"
    with common.TEST_RUNS_LOG.open("a") as handle:
        handle.write(line)


def load_boosters(meta: dict[str, object]) -> dict[str, dict[float, lgb.Booster]]:
    model_dir = common.ARTIFACT_DIR / "models"
    loaded: dict[str, dict[float, lgb.Booster]] = {}
    models = meta["models"]
    if not isinstance(models, list):
        raise TypeError("meta models")
    for row in models:
        if not isinstance(row, dict):
            raise TypeError("model row")
        target = str(row["target"])
        horizon = int(row["horizon_h"])
        quantile = float(row["quantile"])
        tag = f"{target}_h{horizon:02d}"
        path = model_dir / str(row["file"])
        loaded.setdefault(tag, {})[quantile] = lgb.Booster(model_file=str(path))
    return loaded


def score_test(frame: pd.DataFrame, meta: dict[str, object]) -> list[dict[str, object]]:
    boosters = load_boosters(meta)
    calibration = meta["calibration"]
    if not isinstance(calibration, dict):
        raise TypeError("calibration")
    test = frame.loc[frame["split"] == "test"]
    if test.empty:
        raise RuntimeError("test split is empty")
    if test.index.min() < splits.TEST_START:
        raise RuntimeError("test split starts before 2023-01-01")
    rows: list[dict[str, object]] = []
    x = test.loc[:, features.FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    for target in common.TARGETS:
        for horizon in common.HORIZONS:
            tag = f"{target}_h{horizon:02d}"
            column = f"y_{target}_h{horizon:02d}"
            p10 = np.asarray(boosters[tag][0.1].predict(x), dtype=float)
            p50 = np.asarray(boosters[tag][0.5].predict(x), dtype=float)
            p90 = np.asarray(boosters[tag][0.9].predict(x), dtype=float)
            y = test[column].to_numpy(dtype=float)
            if target == "kp":
                persist = test["kp_block_lag0"].to_numpy(dtype=float)
            else:
                persist = test["dst_lag0"].to_numpy(dtype=float)
            delta = float(calibration[tag])
            scored = common.score_rows(target, y, p10, p50, p90, persist, delta)
            finite_y = np.isfinite(y)
            last_time = test.index[finite_y].max() if finite_y.any() else None
            rows.append(
                {
                    "target": target,
                    "horizon_h": horizon,
                    "delta": delta,
                    "test_end": None if last_time is None else last_time.isoformat(),
                    **scored,
                }
            )
    return rows


def last_valid_hours(raw: pd.DataFrame) -> dict[str, str | None]:
    found: dict[str, str | None] = {}
    for column in ("bz_gsm", "by_gsm", "speed", "density", "pdyn", "kp", "dst", "f107"):
        finite = raw.index[np.isfinite(raw[column].to_numpy(dtype=float))]
        found[column] = None if len(finite) == 0 else finite.max().isoformat()
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--final", action="store_true")
    args = parser.parse_args()
    if not args.final:
        print("test labels are read only with --final")
        return 0

    meta_path = common.ARTIFACT_DIR / "meta.json"
    meta = common.read_json(meta_path)
    version = str(meta["model_version"])
    if version_already_logged(version):
        raise SystemExit(f"refusing: {version} is already in {common.TEST_RUNS_LOG}")
    if meta.get("test_scored") is True:
        raise SystemExit(f"refusing: {version} meta already marks the test set scored")

    raw = features.load_omni()
    frame = features.compute_features(raw)
    frame["split"] = splits.assign_splits(frame.index)
    scored = score_test(frame, meta)
    when = datetime.now(timezone.utc)
    payload = {
        "model_version": version,
        "evaluated_at": when.strftime("%Y-%m-%d"),
        "training_start_year": meta["training_start_year"],
        "last_valid_omni_hour": last_valid_hours(raw),
        "rows": scored,
        "literature_reference": common.LITERATURE_REFERENCE,
        "literature_note": "different datasets and periods; not a head-to-head score",
        "gates": {
            "skill_gt_0_horizons_h": [6, 12, 24],
            "coverage_min": 0.70,
            "coverage_max": 0.90,
            "plus_3h_reported_whatever_sign": True,
        },
    }
    common.write_json(common.FORECAST_JSON, payload)
    append_log(version, when)
    meta["test_scored"] = True
    common.write_json(meta_path, meta)
    print(f"wrote {common.FORECAST_JSON} {version}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
