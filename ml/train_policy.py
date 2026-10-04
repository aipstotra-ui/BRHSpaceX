"""Multiclass policy on out-of-fold Kp forecasts. Tune on val only."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import onnxruntime as ort
import pandas as pd
from onnxmltools.convert import convert_lightgbm
from onnxmltools.convert.common.data_types import FloatTensorType

ROOT = Path(__file__).resolve().parents[1]
ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

FEATURES = [
    "kp",
    "kp_p10",
    "kp_p50",
    "kp_p90",
    "dst",
    "saa",
    "auroral",
    "eclipse",
    "sigma_bits",
    "shielding",
    "ecc",
]
TABLE = ROOT / "ml" / "data" / "policy_table.parquet"
MODEL_PATH = ROOT / "public" / "models" / "policy.onnx"
GOLDEN_PATH = ROOT / "public" / "models" / "golden_policy.json"
CARD_PATH = ROOT / "public" / "models" / "policy-card.json"


def matrix(frame: pd.DataFrame) -> np.ndarray:
    return frame.loc[:, FEATURES].to_numpy(dtype=np.float32)


def train() -> None:
    frame = pd.read_parquet(TABLE)
    train = frame.loc[frame["split"] == "train"]
    val = frame.loc[frame["split"] == "val"]
    model = lgb.LGBMClassifier(
        objective="multiclass",
        num_class=4,
        num_leaves=15,
        n_estimators=80,
        learning_rate=0.08,
        random_state=0,
        verbosity=-1,
    )
    model.fit(
        matrix(train),
        train["label"].to_numpy(),
        eval_set=[(matrix(val), val["label"].to_numpy())],
        callbacks=[lgb.early_stopping(15, verbose=False)],
    )
    onnx_model = convert_lightgbm(
        model.booster_,
        initial_types=[("features", FloatTensorType([None, len(FEATURES)]))],
        target_opset=15,
        zipmap=False,
    )
    MODEL_PATH.write_bytes(onnx_model.SerializeToString())
    output_name = "probabilities"
    golden = val.iloc[len(val) // 2]
    features = golden.loc[FEATURES].to_numpy(dtype=np.float32).reshape(1, -1)
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    probabilities = session.run([output_name], {"features": features})[0]
    python_probs = model.predict_proba(features)
    costs = {
        "continue": 0.0,
        "checkpoint": 1.25,
        "throttle": 0.5,
        "safe mode": 8.0,
    }
    GOLDEN_PATH.write_text(
        json.dumps(
            {
                "features": {name: float(golden[name]) for name in FEATURES},
                "feature_names": FEATURES,
                "output_name": output_name,
                "probabilities": [float(value) for value in np.asarray(probabilities).reshape(-1)],
                "python_probabilities": [float(value) for value in np.asarray(python_probs).reshape(-1)],
                "python_cost": costs,
                "ts_cost_inputs": {
                    "uncorrectable": 4.0,
                    "actions": json.loads((ML_DIR / "policy_costs.json").read_text()),
                },
            }
        )
    )
    CARD_PATH.write_text(
        json.dumps(
            {
                "feature_names": FEATURES,
                "output_name": output_name,
                "override_percent": 15,
                "override_note": "estimate: if the classifier action costs more than 15% above the cheapest P50 action, use the cheapest.",
                "zipmap": False,
            }
        )
    )
    print(f"policy onnx {MODEL_PATH.stat().st_size} bytes output {output_name}")


if __name__ == "__main__":
    train()
