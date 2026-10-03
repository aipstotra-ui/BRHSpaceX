"""Shared metrics, calibration, and artifact paths for the forecaster."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "ml" / "artifacts" / "forecast"
VALIDATION_DIR = ROOT / "data" / "validation"
PUBLIC_MODEL_DIR = ROOT / "public" / "models"
TEST_RUNS_LOG = VALIDATION_DIR / "test-runs.log"
FORECAST_JSON = VALIDATION_DIR / "forecast.json"

HORIZONS = (3, 6, 12, 24)
TARGETS = ("kp", "dst")
QUANTILES = (0.1, 0.5, 0.9)

# Estimate grids. The coverage target 0.80 is the middle of the 0.70–0.90 gate.
COVERAGE_TARGET = 0.80
KP_DELTAS = np.round(np.arange(-1.0, 2.0 + 1e-9, 0.05), 2)
DST_DELTAS = np.round(np.arange(-15.0, 30.0 + 1e-9, 0.5), 1)

# NOAA Kp is defined on 0–9. Clipping to that interval is a fixed postprocess.
KP_MIN = 0.0
KP_MAX = 9.0


def model_tag(target: str, horizon: int, quantile: float) -> str:
    q = int(round(quantile * 100))
    return f"{target}_h{horizon:02d}_p{q:02d}"


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def pearson(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if y_true.size < 2:
        return float("nan")
    if float(np.std(y_true)) == 0.0 or float(np.std(y_pred)) == 0.0:
        return float("nan")
    return float(np.corrcoef(y_true, y_pred)[0, 1])


def skill(model_mae: float, persist_mae: float) -> float:
    if persist_mae == 0.0:
        return float("nan")
    return float(1.0 - model_mae / persist_mae)


def clip_kp(values: np.ndarray) -> np.ndarray:
    return np.clip(values, KP_MIN, KP_MAX)


def apply_interval(
    target: str,
    p10: np.ndarray,
    p50: np.ndarray,
    p90: np.ndarray,
    delta: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Calibrate the outer quantiles. The 0.5 prediction is not replaced."""
    low = np.array(p10, dtype=float, copy=True)
    mid = np.array(p50, dtype=float, copy=True)
    high = np.array(p90, dtype=float, copy=True)
    if target == "kp":
        low = clip_kp(low)
        mid = clip_kp(mid)
        high = clip_kp(high)
    lo = np.minimum(low, high) - delta
    hi = np.maximum(low, high) + delta
    if target == "kp":
        lo = clip_kp(lo)
        hi = clip_kp(hi)
    ordered_lo = np.minimum(lo, hi)
    ordered_hi = np.maximum(lo, hi)
    return ordered_lo, mid, ordered_hi


def coverage(y_true: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> float:
    inside = (y_true >= lo) & (y_true <= hi)
    return float(np.mean(inside))


def choose_delta(
    target: str,
    y_true: np.ndarray,
    p10: np.ndarray,
    p50: np.ndarray,
    p90: np.ndarray,
) -> tuple[float, float]:
    grid = KP_DELTAS if target == "kp" else DST_DELTAS
    best_key: tuple[float, float, float] | None = None
    best_delta = 0.0
    best_cov = float("nan")
    for delta in grid:
        lo, _, hi = apply_interval(target, p10, p50, p90, float(delta))
        cov = coverage(y_true, lo, hi)
        key = (abs(cov - COVERAGE_TARGET), abs(float(delta)), float(delta))
        if best_key is None or key < best_key:
            best_key = key
            best_delta = float(delta)
            best_cov = cov
    return best_delta, best_cov


def score_rows(
    target: str,
    y_true: np.ndarray,
    p10: np.ndarray,
    p50: np.ndarray,
    p90: np.ndarray,
    persist: np.ndarray,
    delta: float,
) -> dict[str, float | int]:
    finite = (
        np.isfinite(y_true)
        & np.isfinite(p50)
        & np.isfinite(persist)
        & np.isfinite(p10)
        & np.isfinite(p90)
    )
    y = y_true[finite]
    lo, mid, hi = apply_interval(
        target, p10[finite], p50[finite], p90[finite], delta
    )
    base = persist[finite]
    model_mae = mae(y, mid)
    base_mae = mae(y, base)
    return {
        "n": int(y.size),
        "mae_p50": model_mae,
        "mae_persist": base_mae,
        "skill": skill(model_mae, base_mae),
        "rmse_p50": rmse(y, mid),
        "rmse_persist": rmse(y, base),
        "cc_p50": pearson(y, mid),
        "cc_persist": pearson(y, base),
        "coverage_p10_p90": coverage(y, lo, hi),
    }


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text())


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


LITERATURE_REFERENCE = [
    {
        "target": "kp",
        "horizon_h": 3,
        "label": "Zhelavskaya 2019 GB",
        "rmse": 0.674,
        "cc": 0.872,
        "note": "different dataset and period; not a head-to-head score",
    },
    {
        "target": "kp",
        "horizon_h": 3,
        "label": "Zhelavskaya 2019 persistence",
        "rmse": 0.847,
        "cc": 0.808,
        "note": "different dataset and period; not a head-to-head score",
    },
    {
        "target": "kp",
        "horizon_h": 3,
        "label": "Chakraborty & Morley 2020",
        "rmse": 0.77,
        "cc": 0.83,
        "note": "different dataset and period; not a head-to-head score",
    },
    {
        "target": "kp",
        "horizon_h": 6,
        "label": "Zhelavskaya 2019 GB",
        "rmse": 0.879,
        "cc": 0.770,
        "note": "different dataset and period; not a head-to-head score",
    },
    {
        "target": "kp",
        "horizon_h": 6,
        "label": "Zhelavskaya 2019 persistence",
        "rmse": 1.077,
        "cc": 0.690,
        "note": "different dataset and period; not a head-to-head score",
    },
    {
        "target": "dst",
        "horizon_h": 6,
        "label": "Gruet 2018",
        "rmse": 9.86,
        "cc": 0.873,
        "unit": "nT",
        "note": "different dataset and period; not a head-to-head score",
    },
]
