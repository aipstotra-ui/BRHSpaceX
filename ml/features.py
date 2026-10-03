"""Causal hourly features for the Kp and Dst forecasters.

Solar-wind columns are forward-filled with limit 3, then trailing windows
use center=False. Kp enters only as the last completed 3-hour block.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OMNI_PATH = ROOT / "ml" / "data" / "omni_hourly.parquet"

HORIZONS = (3, 6, 12, 24)
KP_BLOCK_LAGS = (0, 1, 2, 4, 8)
DST_LAGS = (0, 1, 3, 6, 12, 24)
SOLAR_COLUMNS = ("bz_gsm", "by_gsm", "speed", "density", "pdyn")
SOLAR_WINDOWS = (3, 6, 12, 24)
SOLAR_UNITS = {
    "bz_gsm": "nT",
    "by_gsm": "nT",
    "speed": "km/s",
    "density": "1/cm^3",
    "pdyn": "nPa",
}

# Fill note stored on every spec. Solar values below are after ffill(limit=3).
# Remaining gaps stay missing and are passed through as NaN.
FILL_NONE = "no fill; missing stays NaN"
FILL_SOLAR = "ffill(limit=3) then trailing window; remaining gaps stay NaN"


def _spec(
    name: str,
    unit: str,
    kind: str,
    fill: str,
    **extra: object,
) -> dict[str, object]:
    row: dict[str, object] = {
        "name": name,
        "unit": unit,
        "kind": kind,
        "fill": fill,
    }
    row.update(extra)
    return row


def feature_specs() -> list[dict[str, object]]:
    specs: list[dict[str, object]] = []
    for blocks in KP_BLOCK_LAGS:
        specs.append(
            _spec(
                f"kp_block_lag{blocks}",
                "1",
                "kp_block",
                FILL_NONE,
                lag_blocks=blocks,
                lag_hours=1 + 3 * blocks,
            )
        )
    for lag in DST_LAGS:
        specs.append(
            _spec(
                f"dst_lag{lag}",
                "nT",
                "dst_lag",
                FILL_NONE,
                lag_hours=lag,
            )
        )
    specs.append(
        _spec(
            "f107_lag24",
            "sfu",
            "f107_lag",
            FILL_NONE,
            lag_hours=24,
        )
    )
    for column in SOLAR_COLUMNS:
        unit = SOLAR_UNITS[column]
        specs.append(
            _spec(column, unit, "solar", FILL_SOLAR, column=column, window_hours=1)
        )
        for window in SOLAR_WINDOWS:
            specs.append(
                _spec(
                    f"{column}_mean{window}",
                    unit,
                    "solar_mean",
                    FILL_SOLAR,
                    column=column,
                    window_hours=window,
                )
            )
    specs.append(_spec("bz_gsm_min3", "nT", "solar_min", FILL_SOLAR, column="bz_gsm", window_hours=3))
    specs.append(_spec("bz_gsm_min6", "nT", "solar_min", FILL_SOLAR, column="bz_gsm", window_hours=6))
    for column in SOLAR_COLUMNS:
        specs.append(
            _spec(
                f"{column}_missing",
                "1",
                "missing",
                FILL_NONE,
                column=column,
            )
        )
    specs.append(_spec("kp_block_missing", "1", "missing", FILL_NONE, column="kp"))
    specs.append(_spec("dst_missing", "1", "missing", FILL_NONE, column="dst"))
    specs.append(_spec("f107_lag24_missing", "1", "missing", FILL_NONE, column="f107"))
    specs.append(
        _spec(
            "bz_gsm_missing_mean24",
            "1",
            "missing_mean",
            FILL_NONE,
            column="bz_gsm",
            window_hours=24,
        )
    )
    return specs


FEATURE_SPECS = feature_specs()
FEATURE_COLUMNS = [str(spec["name"]) for spec in FEATURE_SPECS]


def load_omni(path: Path | None = None) -> pd.DataFrame:
    frame = pd.read_parquet(path or OMNI_PATH)
    frame["time"] = pd.to_datetime(frame["time"], utc=True)
    frame = frame.set_index("time").sort_index()
    if not isinstance(frame.index, pd.DatetimeIndex):
        raise TypeError("omni index must be datetimes")
    if frame.index.has_duplicates:
        raise ValueError("duplicate omni hours")
    return frame


def _as_hourly(frame: pd.DataFrame) -> pd.DataFrame:
    if len(frame.index) == 0:
        return frame
    start = frame.index.min()
    end = frame.index.max()
    hourly = pd.date_range(start, end, freq="h", tz="UTC")
    if len(hourly) == len(frame.index) and frame.index.equals(hourly):
        return frame
    return frame.reindex(hourly)


def _lookup(series: pd.Series, when: pd.DatetimeIndex) -> np.ndarray:
    return series.reindex(when).to_numpy(dtype=float)


def compute_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Features at each hour. Only rows with hour % 3 == 0 are model issue times.

    `frame` must contain the raw OMNI columns. A prefix that ends at t uses no
    later row. Target columns look forward and are not model inputs.
    """
    hourly = _as_hourly(frame)
    index = hourly.index
    out = pd.DataFrame(index=index)

    kp = hourly["kp"].astype(float)
    boundary = index.floor("3h")
    for blocks in KP_BLOCK_LAGS:
        src = boundary - pd.Timedelta(1 + 3 * blocks, unit="h")
        out[f"kp_block_lag{blocks}"] = _lookup(kp, src)

    dst = hourly["dst"].astype(float)
    for lag in DST_LAGS:
        out[f"dst_lag{lag}"] = dst.shift(lag)

    f107 = hourly["f107"].astype(float)
    out["f107_lag24"] = f107.shift(24)

    filled: dict[str, pd.Series] = {}
    for column in SOLAR_COLUMNS:
        raw = hourly[column].astype(float)
        out[f"{column}_missing"] = raw.isna().astype(float)
        filled[column] = raw.ffill(limit=3)
        out[column] = filled[column]
        for window in SOLAR_WINDOWS:
            out[f"{column}_mean{window}"] = filled[column].rolling(
                window, center=False, min_periods=1
            ).mean()

    out["bz_gsm_min3"] = filled["bz_gsm"].rolling(3, center=False, min_periods=1).min()
    out["bz_gsm_min6"] = filled["bz_gsm"].rolling(6, center=False, min_periods=1).min()

    out["kp_block_missing"] = out["kp_block_lag0"].isna().astype(float)
    out["dst_missing"] = dst.isna().astype(float)
    out["f107_lag24_missing"] = out["f107_lag24"].isna().astype(float)
    bz_missing = hourly["bz_gsm"].astype(float).isna().astype(float)
    out["bz_gsm_missing_mean24"] = bz_missing.rolling(
        24, center=False, min_periods=1
    ).mean()

    # Labels only. Kp at horizon h is the block that ends at t+h, stored on hour
    # t+h-1. Dst at horizon h is the hourly value at t+h.
    for horizon in HORIZONS:
        out[f"y_kp_h{horizon:02d}"] = kp.shift(-(horizon - 1))
        out[f"y_dst_h{horizon:02d}"] = dst.shift(-horizon)

    return out
