"""Export the validation-frozen boosters to ONNX and write the model card."""

from __future__ import annotations

import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import onnxruntime as ort
import pandas as pd
from onnxmltools.convert import convert_lightgbm
from skl2onnx.common.data_types import FloatTensorType

ML_DIR = Path(__file__).resolve().parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import features
import forecast_common as common
import splits


def convert_booster(booster: lgb.Booster, n_features: int):
    return convert_lightgbm(
        booster,
        initial_types=[("features", FloatTensorType([None, n_features]))],
        target_opset=15,
        zipmap=False,
    )


def output_name(model) -> str:
    return str(model.graph.output[0].name)


def main() -> int:
    meta = common.read_json(common.ARTIFACT_DIR / "meta.json")
    if meta.get("test_scored") is True:
        raise SystemExit("refusing to export after the test set was scored")
    names = [str(name) for name in meta["feature_names"]]
    n_features = len(names)
    common.PUBLIC_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    raw = features.load_omni()
    frame = features.compute_features(raw)
    frame["split"] = splits.assign_splits(frame.index)
    val = frame.loc[frame["split"] == "val"]
    finite_val = val.loc[np.isfinite(val.loc[:, names].to_numpy(dtype=float)).all(axis=1)]
    if finite_val.empty:
        raise RuntimeError("no finite validation row for the golden vector")
    golden_row = finite_val.iloc[len(finite_val) // 2]
    golden_x = golden_row.loc[names].to_numpy(dtype=np.float32).reshape(1, -1)

    shipped: list[dict[str, object]] = []
    golden_outputs: dict[str, list[float]] = {}
    models = meta["models"]
    if not isinstance(models, list):
        raise TypeError("models")
    for row in models:
        if not isinstance(row, dict):
            raise TypeError("model row")
        booster = lgb.Booster(model_file=str(common.ARTIFACT_DIR / "models" / str(row["file"])))
        onnx_model = convert_booster(booster, n_features)
        out_name = output_name(onnx_model)
        filename = f"forecast_{row['file'].replace('.txt', '')}.onnx"
        path = common.PUBLIC_MODEL_DIR / filename
        path.write_bytes(onnx_model.SerializeToString())
        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        result = session.run([out_name], {"features": golden_x})[0]
        golden_outputs[filename] = [float(value) for value in np.asarray(result).reshape(-1)]
        shipped.append(
            {
                "file": filename,
                "target": row["target"],
                "horizon_h": row["horizon_h"],
                "quantile": row["quantile"],
                "output_name": out_name,
                "best_iteration": row["best_iteration"],
            }
        )
        print(f"exported {filename} bytes {path.stat().st_size}", flush=True)

    test = frame.loc[frame["split"] == "test"]
    test_ends: dict[str, str | None] = {}
    for target in common.TARGETS:
        for horizon in common.HORIZONS:
            column = f"y_{target}_h{horizon:02d}"
            finite = test.index[np.isfinite(test[column].to_numpy(dtype=float))]
            test_ends[f"{target}_h{horizon:02d}"] = (
                None if len(finite) == 0 else pd.Timestamp(finite.max()).isoformat()
            )
    last_inputs: dict[str, str | None] = {}
    for column in ("bz_gsm", "by_gsm", "speed", "density", "pdyn", "kp", "dst", "f107"):
        finite = raw.index[np.isfinite(raw[column].to_numpy(dtype=float))]
        last_inputs[column] = None if len(finite) == 0 else pd.Timestamp(finite.max()).isoformat()

    card = {
        "model_version": meta["model_version"],
        "training_start_year": meta["training_start_year"],
        "input_name": "features",
        "feature_names": names,
        "features": meta["feature_specs"],
        "splits": meta["splits"],
        "test_end_by_target": test_ends,
        "last_valid_omni_hour": last_inputs,
        "hyperparameters": meta["hyperparameters"],
        "calibration": meta["calibration"],
        "kp_clip": [common.KP_MIN, common.KP_MAX],
        "models": shipped,
        "goes_xray": {
            "used": False,
            "reason": (
                "GOES 0.1–0.8 nm history in this repo is only "
                "goes_xrays_200301, goes_xrays_202202, and goes_xrays_202405. "
                "That does not cover train and validation, so X-ray was not added."
            ),
        },
        "omni_vs_live": (
            "Test rows end at the last OMNI hour that still has a target. "
            "OMNI final/quicklook lags real time. Live inference uses recent "
            "SWPC RTSW L1 solar wind, quicklook Kp, Kyoto Dst, and F10.7. "
            "Training dynamic pressure uses the OMNI Na/Np branch when alpha "
            "density is present. Live RTSW uses P=(2.0/10**6)*Np*V**2 because "
            "alpha density is not in that feed. A partial current hour can enter "
            "the live trailing windows."
        ),
        "fill_handling": (
            "Solar-wind inputs use ffill(limit=3) before trailing windows. "
            "Kp, Dst, and F10.7 are not filled. Remaining gaps stay NaN so the "
            "trees can use their missing-value split."
        ),
    }
    common.write_json(common.PUBLIC_MODEL_DIR / "model-card.json", card)
    golden = {
        "model_version": meta["model_version"],
        "issue_time": pd.Timestamp(golden_row.name).isoformat(),
        "split": "val",
        "feature_order": "model-card.json feature_names",
        "features": {name: float(golden_row[name]) for name in names},
        "outputs": golden_outputs,
    }
    common.write_json(common.PUBLIC_MODEL_DIR / "golden_forecast.json", golden)

    fixture_end = pd.Timestamp(golden_row.name)
    fixture_start = fixture_end - pd.Timedelta(96, unit="h")
    prefix = raw.loc[fixture_start:fixture_end]
    short = features.compute_features(prefix)
    full_vec = golden_row.loc[names].to_numpy(dtype=float)
    short_vec = short.loc[fixture_end, names].to_numpy(dtype=float)
    if not np.allclose(full_vec, short_vec, equal_nan=True):
        raise RuntimeError("96 h prefix does not match the full-series golden features")
    raw_columns = ["bz_gsm", "by_gsm", "speed", "density", "pdyn", "kp", "dst", "f107"]
    fixture = {
        "issue_time": fixture_end.isoformat(),
        "times": [pd.Timestamp(ts).isoformat() for ts in prefix.index],
        "columns": {
            column: [
                None if not np.isfinite(value) else float(value)
                for value in prefix[column].to_numpy(dtype=float)
            ]
            for column in raw_columns
        },
        "expected_features": {name: float(golden_row[name]) for name in names},
    }
    common.write_json(common.PUBLIC_MODEL_DIR / "feature_fixture.json", fixture)
    print(f"golden issue {fixture_end.isoformat()}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
