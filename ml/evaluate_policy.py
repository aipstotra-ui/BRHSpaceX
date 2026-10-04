"""Score the policy once on the test split. Refuses a second --final run."""

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

from build_oracle import ACTIONS, action_cost, uncorrectable
from train_policy import FEATURES, matrix

LOG = ROOT / "data" / "validation" / "test-runs.log"
POLICY_JSON = ROOT / "data" / "validation" / "policy.json"
VERSION = "policy-v2"


def costs_for(frame: pd.DataFrame, labels: np.ndarray) -> float:
    total = 0.0
    for row, label in zip(frame.itertuples(index=False), labels):
        total += action_cost(uncorrectable(float(row.kp), float(row.saa), float(row.sigma_bits)), ACTIONS[int(label)])
    return total


def main() -> None:
    final = "--final" in sys.argv
    if final and VERSION in LOG.read_text():
        raise SystemExit(f"refusing second --final for {VERSION}")
    frame = pd.read_parquet(ROOT / "ml" / "data" / "policy_table.parquet")
    test = frame.loc[frame["split"] == "test"].reset_index(drop=True)
    import onnxruntime as ort

    session = ort.InferenceSession(str(ROOT / "public" / "models" / "policy.onnx"), providers=["CPUExecutionProvider"])
    probs = session.run(["probabilities"], {"features": matrix(test)})[0]
    raw = np.argmax(np.asarray(probs), axis=1)
    policy = []
    for row, guess in zip(test.itertuples(index=False), raw):
        costs = [
            action_cost(uncorrectable(float(row.kp_p50), float(row.saa), float(row.sigma_bits)), action)
            for action in ACTIONS
        ]
        best = int(np.argmin(costs))
        if costs[int(guess)] > costs[best] * 1.15:
            policy.append(best)
        else:
            policy.append(int(guess))
    policy = np.asarray(policy)
    always = np.zeros(len(test), dtype=int)
    threshold = np.where(test["kp"].to_numpy() >= 7, 3, 0)
    oracle = test["label"].to_numpy()
    policy_cost = costs_for(test, policy)
    always_cost = costs_for(test, always)
    threshold_cost = costs_for(test, threshold)
    oracle_cost = costs_for(test, oracle)
    gap = always_cost - oracle_cost
    closed = 0.0 if gap == 0 else 100.0 * (always_cost - policy_cost) / gap
    payload = {
        "version": VERSION,
        "split": "test 2023+",
        "policy_cost": policy_cost,
        "always_on_cost": always_cost,
        "threshold_cost": threshold_cost,
        "oracle_cost": oracle_cost,
        "oracle_gap_closed_percent": closed,
        "pass": bool(policy_cost < threshold_cost and policy_cost < always_cost),
        "rows": int(len(test)),
        "feature_names": FEATURES,
    }
    POLICY_JSON.write_text(json.dumps(payload, indent=2) + "\n")
    if final:
        with LOG.open("a") as handle:
            handle.write(f"2026-10-04 {VERSION} policy --final\n")
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
