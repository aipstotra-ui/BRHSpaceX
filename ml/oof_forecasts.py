"""Out-of-fold Kp quantile forecasts. Not used as a forecast-skill claim."""

from __future__ import annotations

import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

PARQUET = ROOT / "ml" / "data" / "omni_hourly.parquet"
OUT = ROOT / "ml" / "data" / "oof_forecasts.parquet"

# Expanding windows inside the training years. The last block is predicted, never trained on.
FOLDS = (
    (2003, 2006),
    (2006, 2009),
    (2009, 2012),
    (2012, 2015),
    (2015, 2020),
)
TRAIN_END = 2019
VAL_END = 2022


def load_frame() -> pd.DataFrame:
    table = pq.read_table(PARQUET, columns=["time", "kp", "dst"])
    frame = table.to_pandas()
    frame["time"] = pd.to_datetime(frame["time"], utc=True)
    frame = frame.dropna(subset=["kp"]).sort_values("time")
    frame["year"] = frame["time"].dt.year
    for lag in (3, 6, 12, 24):
        frame[f"kp_lag_{lag}"] = frame["kp"].shift(lag // 3)
    frame["kp_ahead"] = frame["kp"].shift(-2)
    return frame.dropna(subset=["kp_lag_24", "kp_ahead"]).reset_index(drop=True)


def _booster(frame: pd.DataFrame, alpha: float) -> lgb.Booster:
    names = ["kp_lag_3", "kp_lag_6", "kp_lag_12", "kp_lag_24"]
    train = lgb.Dataset(frame.loc[:, names], label=frame["kp_ahead"])
    return lgb.train(
        {
            "objective": "quantile",
            "alpha": alpha,
            "num_leaves": 8,
            "learning_rate": 0.08,
            "verbosity": -1,
            "seed": 0,
        },
        train,
        num_boost_round=40,
    )


def predict(model: lgb.Booster, frame: pd.DataFrame) -> np.ndarray:
    names = ["kp_lag_3", "kp_lag_6", "kp_lag_12", "kp_lag_24"]
    return np.asarray(model.predict(frame.loc[:, names]), dtype=float)


def build() -> pd.DataFrame:
    frame = load_frame()
    frame["kp_p10"] = np.nan
    frame["kp_p50"] = np.nan
    frame["kp_p90"] = np.nan
    frame["oof_fold"] = -1
    frame["split"] = "drop"
    frame.loc[frame["year"] <= TRAIN_END, "split"] = "train"
    frame.loc[(frame["year"] > TRAIN_END) & (frame["year"] <= VAL_END), "split"] = "val"
    frame.loc[frame["year"] > VAL_END, "split"] = "test"

    for fold, (train_end, predict_end) in enumerate(FOLDS):
        train = frame.loc[frame["year"] <= train_end]
        predict_rows = frame.loc[(frame["year"] > train_end) & (frame["year"] <= predict_end) & (frame["year"] <= TRAIN_END)]
        if train.empty or predict_rows.empty:
            continue
        models = {name: _booster(train, alpha) for name, alpha in (("p10", 0.1), ("p50", 0.5), ("p90", 0.9))}
        index = predict_rows.index
        frame.loc[index, "kp_p10"] = predict(models["p10"], predict_rows)
        frame.loc[index, "kp_p50"] = predict(models["p50"], predict_rows)
        frame.loc[index, "kp_p90"] = predict(models["p90"], predict_rows)
        frame.loc[index, "oof_fold"] = fold

    frozen = frame.loc[frame["year"] <= TRAIN_END]
    models = {name: _booster(frozen, alpha) for name, alpha in (("p10", 0.1), ("p50", 0.5), ("p90", 0.9))}
    future = frame.loc[frame["year"] > TRAIN_END]
    frame.loc[future.index, "kp_p10"] = predict(models["p10"], future)
    frame.loc[future.index, "kp_p50"] = predict(models["p50"], future)
    frame.loc[future.index, "kp_p90"] = predict(models["p90"], future)
    frame.loc[future.index, "oof_fold"] = -2
    return frame.dropna(subset=["kp_p50"])


def main() -> None:
    frame = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(OUT, index=False)
    print(f"rows {len(frame)} -> {OUT}")


if __name__ == "__main__":
    main()
