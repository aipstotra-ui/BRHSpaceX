"""Policy features for training years come from out-of-fold forecasts."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]


def test_train_rows_use_oof_folds() -> None:
    frame = pd.read_parquet(ROOT / "ml" / "data" / "policy_table.parquet")
    train = frame.loc[frame["split"] == "train"]
    assert not train.empty
    assert (train["oof_fold"] >= 0).all()
    assert (frame.loc[frame["split"] == "test", "oof_fold"] == -2).all()
