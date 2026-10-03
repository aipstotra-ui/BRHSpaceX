"""Train, validation, and test issue times with a 48-hour embargo."""

from __future__ import annotations

import pandas as pd

TRAIN_EXCLUSIVE_END = pd.Timestamp("2019-12-30T00:00:00Z")
VAL_START = pd.Timestamp("2020-01-01T00:00:00Z")
VAL_EXCLUSIVE_END = pd.Timestamp("2022-12-30T00:00:00Z")
TEST_START = pd.Timestamp("2023-01-01T00:00:00Z")
EARLY_STOP_END = pd.Timestamp("2022-01-01T00:00:00Z")
EMBARGO = pd.Timedelta(48, unit="h")


def issue_mask(index: pd.DatetimeIndex) -> pd.Series:
    hours = index.hour
    return pd.Series(
        (index.minute == 0) & (index.second == 0) & (hours % 3 == 0),
        index=index,
    )


def assign_splits(index: pd.DatetimeIndex) -> pd.Series:
    """Label 3-hour issue times. Embargo hours stay `none`.

    Train issue times are strictly before 2019-12-30 so the last train time
    plus 48 h is still before the first validation time. Validation ends
    strictly before 2022-12-30 for the same reason ahead of the test set.
    """
    if index.tz is None:
        raise ValueError("split index must be UTC")
    labels = pd.Series("none", index=index, dtype="object")
    issue = issue_mask(index)
    labels.loc[issue & (index < TRAIN_EXCLUSIVE_END)] = "train"
    labels.loc[issue & (index >= VAL_START) & (index < VAL_EXCLUSIVE_END)] = "val"
    labels.loc[issue & (index >= TEST_START)] = "test"
    assert_embargo(labels)
    return labels


def assert_embargo(labels: pd.Series) -> None:
    index = labels.index
    train_t = index[labels.to_numpy() == "train"]
    val_t = index[labels.to_numpy() == "val"]
    test_t = index[labels.to_numpy() == "test"]
    if len(train_t) == 0 or len(val_t) == 0 or len(test_t) == 0:
        raise AssertionError("train, val, and test must all be non-empty")
    if not (train_t.max() + EMBARGO < val_t.min()):
        raise AssertionError("max(train)+48h must be < min(val)")
    if not (val_t.max() + EMBARGO < test_t.min()):
        raise AssertionError("max(val)+48h must be < min(test)")


def start_mask(index: pd.DatetimeIndex, year: int) -> pd.Series:
    start = pd.Timestamp(f"{year}-01-01T00:00:00Z")
    return pd.Series(index >= start, index=index)
