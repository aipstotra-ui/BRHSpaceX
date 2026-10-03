"""Leakage checks for features and the 48-hour embargo."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


features = load_module("features", ROOT / "ml" / "features.py")
splits = load_module("splits", ROOT / "ml" / "splits.py")


def test_embargo_48h():
    raw = features.load_omni()
    labels = splits.assign_splits(raw.index)
    train_t = raw.index[labels.to_numpy() == "train"]
    val_t = raw.index[labels.to_numpy() == "val"]
    test_t = raw.index[labels.to_numpy() == "test"]
    assert train_t.max() + pd.Timedelta(48, unit="h") < val_t.min()
    assert val_t.max() + pd.Timedelta(48, unit="h") < test_t.min()
    assert train_t.max() < pd.Timestamp("2019-12-30T00:00:00Z")
    assert val_t.min() >= pd.Timestamp("2020-01-01T00:00:00Z")
    assert test_t.min() >= pd.Timestamp("2023-01-01T00:00:00Z")


def test_prefix_and_kp_block():
    raw = features.load_omni()
    computed = features.compute_features(raw)
    issue = computed.index[computed.index.hour % 3 == 0]
    rng = np.random.default_rng(0)
    picked = rng.choice(issue.to_numpy(), size=100, replace=False)
    columns = features.FEATURE_COLUMNS
    kp = raw["kp"].astype(float)
    for stamp in picked:
        t = pd.Timestamp(stamp)
        prefix = features.compute_features(raw.loc[:t])
        full_row = computed.loc[t, columns].to_numpy(dtype=float)
        prefix_row = prefix.loc[t, columns].to_numpy(dtype=float)
        np.testing.assert_allclose(full_row, prefix_row, equal_nan=True)
        boundary = t.floor("3h")
        src = boundary - pd.Timedelta(1, unit="h")
        expected = float(kp.loc[src]) if src in kp.index else np.nan
        got = float(computed.loc[t, "kp_block_lag0"])
        np.testing.assert_allclose(got, expected, equal_nan=True)
