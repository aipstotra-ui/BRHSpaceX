"""Train Kp and Dst quantile models. Validation only. Does not score the test set."""

from __future__ import annotations

import sys
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

# Estimates, except num_leaves and the tree cap, which follow the milestone rule.
NUM_LEAVES = 15
N_ESTIMATORS = 150
LEARNING_RATE = 0.05
MIN_CHILD_SAMPLES = 20
EARLY_STOPPING_ROUNDS = 30
RANDOM_STATE = 0
CANDIDATE_STARTS = (1963, 1995)


def fit_quantile(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_eval: np.ndarray,
    y_eval: np.ndarray,
    alpha: float,
) -> lgb.LGBMRegressor:
    model = lgb.LGBMRegressor(
        objective="quantile",
        alpha=alpha,
        num_leaves=NUM_LEAVES,
        n_estimators=N_ESTIMATORS,
        learning_rate=LEARNING_RATE,
        min_child_samples=MIN_CHILD_SAMPLES,
        random_state=RANDOM_STATE,
        n_jobs=4,
        verbose=-1,
    )
    model.fit(
        x_train,
        y_train,
        eval_set=[(x_eval, y_eval)],
        callbacks=[
            lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False),
            lgb.log_evaluation(period=0),
        ],
    )
    return model


def finite_target(frame: pd.DataFrame, column: str) -> pd.DataFrame:
    return frame.loc[np.isfinite(frame[column].to_numpy(dtype=float))]


def matrix(frame: pd.DataFrame) -> np.ndarray:
    return frame.loc[:, features.FEATURE_COLUMNS].to_numpy(dtype=np.float64)


def p50_mae(
    model: lgb.LGBMRegressor,
    frame: pd.DataFrame,
    target: str,
    horizon: int,
) -> float:
    column = f"y_{target}_h{horizon:02d}"
    rows = finite_target(frame, column)
    pred = model.predict(matrix(rows))
    y = rows[column].to_numpy(dtype=float)
    if target == "kp":
        pred = common.clip_kp(np.asarray(pred, dtype=float))
    return common.mae(y, np.asarray(pred, dtype=float))


def val_slices(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train = frame.loc[frame["split"] == "train"]
    val = frame.loc[frame["split"] == "val"]
    early = val.loc[val.index < splits.EARLY_STOP_END]
    diagnostic = val.loc[val.index >= splits.EARLY_STOP_END]
    if train.empty or early.empty or diagnostic.empty:
        raise RuntimeError("train, early-stop, or 2022 diagnostic slice is empty")
    if train.index.max() >= pd.Timestamp("2023-01-01T00:00:00Z"):
        raise RuntimeError("train slice crossed into the test period")
    if diagnostic.index.max() >= splits.TEST_START:
        raise RuntimeError("diagnostic slice crossed into the test period")
    return train, early, diagnostic


def compare_starts(frame: pd.DataFrame) -> tuple[int, dict[str, float]]:
    train, early, diagnostic = val_slices(frame)
    scores: dict[str, float] = {}
    for year in CANDIDATE_STARTS:
        subset = train.loc[splits.start_mask(train.index, year).to_numpy()]
        task_maes: list[float] = []
        for target in common.TARGETS:
            for horizon in common.HORIZONS:
                column = f"y_{target}_h{horizon:02d}"
                rows = finite_target(subset, column)
                early_rows = finite_target(early, column)
                model = fit_quantile(
                    matrix(rows),
                    rows[column].to_numpy(dtype=float),
                    matrix(early_rows),
                    early_rows[column].to_numpy(dtype=float),
                    0.5,
                )
                task_maes.append(p50_mae(model, diagnostic, target, horizon))
                print(
                    f"start {year} {target} +{horizon}h 2022 MAE(P50) {task_maes[-1]:.4f}",
                    flush=True,
                )
        scores[str(year)] = float(np.mean(task_maes))
        print(f"start {year} mean 2022 MAE(P50) {scores[str(year)]:.4f}", flush=True)
    winner = min(CANDIDATE_STARTS, key=lambda year: scores[str(year)])
    return winner, scores


def predict_three(
    models: dict[float, lgb.LGBMRegressor],
    frame: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    x = matrix(frame)
    return (
        np.asarray(models[0.1].predict(x), dtype=float),
        np.asarray(models[0.5].predict(x), dtype=float),
        np.asarray(models[0.9].predict(x), dtype=float),
    )


def train_all(frame: pd.DataFrame, start_year: int) -> tuple[dict[str, dict[float, lgb.LGBMRegressor]], dict[str, float]]:
    train, early, diagnostic = val_slices(frame)
    train = train.loc[splits.start_mask(train.index, start_year).to_numpy()]
    models: dict[str, dict[float, lgb.LGBMRegressor]] = {}
    deltas: dict[str, float] = {}
    for target in common.TARGETS:
        for horizon in common.HORIZONS:
            column = f"y_{target}_h{horizon:02d}"
            tag = common.model_tag(target, horizon, 0.5).rsplit("_", 1)[0]
            rows = finite_target(train, column)
            early_rows = finite_target(early, column)
            fitted: dict[float, lgb.LGBMRegressor] = {}
            for alpha in common.QUANTILES:
                fitted[alpha] = fit_quantile(
                    matrix(rows),
                    rows[column].to_numpy(dtype=float),
                    matrix(early_rows),
                    early_rows[column].to_numpy(dtype=float),
                    alpha,
                )
                print(
                    f"fit {target} +{horizon}h q{alpha} trees {fitted[alpha].best_iteration_}",
                    flush=True,
                )
            models[tag] = fitted
            cal_rows = finite_target(early, column)
            p10, p50, p90 = predict_three(fitted, cal_rows)
            delta, cov = common.choose_delta(
                target,
                cal_rows[column].to_numpy(dtype=float),
                p10,
                p50,
                p90,
            )
            deltas[tag] = delta
            print(f"conformal {tag} delta {delta} early coverage {cov:.4f}", flush=True)
            diag_rows = finite_target(diagnostic, column)
            d10, d50, d90 = predict_three(fitted, diag_rows)
            scored = common.score_rows(
                target,
                diag_rows[column].to_numpy(dtype=float),
                d10,
                d50,
                d90,
                diag_rows[persistence_column(target)].to_numpy(dtype=float),
                delta,
            )
            print(f"2022 {tag} {scored}", flush=True)
    return models, deltas


def persistence_column(target: str) -> str:
    if target == "kp":
        return "kp_block_lag0"
    if target == "dst":
        return "dst_lag0"
    raise KeyError(target)


def diagnostic_table(
    frame: pd.DataFrame,
    models: dict[str, dict[float, lgb.LGBMRegressor]],
    deltas: dict[str, float],
) -> list[dict[str, object]]:
    _, _, diagnostic = val_slices(frame)
    rows: list[dict[str, object]] = []
    for target in common.TARGETS:
        for horizon in common.HORIZONS:
            column = f"y_{target}_h{horizon:02d}"
            tag = f"{target}_h{horizon:02d}"
            diag_rows = finite_target(diagnostic, column)
            fitted = models[tag]
            p10, p50, p90 = predict_three(fitted, diag_rows)
            scored = common.score_rows(
                target,
                diag_rows[column].to_numpy(dtype=float),
                p10,
                p50,
                p90,
                diag_rows[persistence_column(target)].to_numpy(dtype=float),
                deltas[tag],
            )
            rows.append(
                {
                    "target": target,
                    "horizon_h": horizon,
                    "split": "val_2022",
                    **scored,
                }
            )
    return rows


def gates_pass(rows: list[dict[str, object]]) -> bool:
    ok = True
    for row in rows:
        horizon = int(row["horizon_h"])
        skill = float(row["skill"])
        cov = float(row["coverage_p10_p90"])
        if horizon in (6, 12, 24) and not (skill > 0.0):
            ok = False
        if not (0.70 <= cov <= 0.90):
            ok = False
    return ok


def save_models(
    start_year: int,
    start_scores: dict[str, float],
    models: dict[str, dict[float, lgb.LGBMRegressor]],
    deltas: dict[str, float],
    diagnostic: list[dict[str, object]],
) -> None:
    version = f"forecast-{start_year}-v1"
    common.ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    model_dir = common.ARTIFACT_DIR / "models"
    model_dir.mkdir(parents=True, exist_ok=True)
    saved: list[dict[str, object]] = []
    for target in common.TARGETS:
        for horizon in common.HORIZONS:
            tag = f"{target}_h{horizon:02d}"
            for alpha, model in models[tag].items():
                name = common.model_tag(target, horizon, alpha)
                path = model_dir / f"{name}.txt"
                iteration = int(model.best_iteration_ or N_ESTIMATORS)
                model.booster_.save_model(str(path), num_iteration=iteration)
                saved.append(
                    {
                        "file": path.name,
                        "target": target,
                        "horizon_h": horizon,
                        "quantile": alpha,
                        "best_iteration": int(model.best_iteration_ or 0),
                    }
                )
    meta = {
        "model_version": version,
        "training_start_year": start_year,
        "start_year_2022_mean_mae_p50": start_scores,
        "feature_names": features.FEATURE_COLUMNS,
        "feature_specs": features.FEATURE_SPECS,
        "calibration": deltas,
        "models": saved,
        "diagnostic_2022": diagnostic,
        "diagnostic_gates_pass": gates_pass(diagnostic),
        "hyperparameters": {
            "objective": "quantile",
            "alphas": list(common.QUANTILES),
            "num_leaves": NUM_LEAVES,
            "n_estimators_max": N_ESTIMATORS,
            "learning_rate": LEARNING_RATE,
            "min_child_samples": MIN_CHILD_SAMPLES,
            "early_stopping_rounds": EARLY_STOPPING_ROUNDS,
            "random_state": RANDOM_STATE,
            "early_stop_period": "2020-01-01 through 2021-12-31 issue times",
            "conformal_period": "2020-01-01 through 2021-12-31 issue times",
            "conformal_target_coverage": common.COVERAGE_TARGET,
            "notes": (
                "learning_rate, min_child_samples, early_stopping_rounds, "
                "and the conformal delta grids are estimates. "
                "num_leaves and the 150-tree cap follow the milestone rule."
            ),
        },
        "splits": {
            "train_exclusive_end": "2019-12-30T00:00:00Z",
            "val_start": "2020-01-01T00:00:00Z",
            "val_exclusive_end": "2022-12-30T00:00:00Z",
            "test_start": "2023-01-01T00:00:00Z",
            "embargo_hours": 48,
        },
        "goes_xray_used": False,
        "test_scored": False,
    }
    common.write_json(common.ARTIFACT_DIR / "meta.json", meta)


def build_table() -> pd.DataFrame:
    raw = features.load_omni()
    print("computing features", flush=True)
    frame = features.compute_features(raw)
    frame["split"] = splits.assign_splits(frame.index)
    keep = frame["split"].isin(["train", "val"])
    # Test rows stay out of the training frame so this script cannot score them.
    return frame.loc[keep].copy()


def main() -> int:
    frame = build_table()
    print(f"train/val issue rows {len(frame)}", flush=True)
    start_year, scores = compare_starts(frame)
    print(f"selected start {start_year}", flush=True)
    models, deltas = train_all(frame, start_year)
    diagnostic = diagnostic_table(frame, models, deltas)
    save_models(start_year, scores, models, deltas, diagnostic)
    passed = gates_pass(diagnostic)
    print(f"2022 gates pass {passed}", flush=True)
    return 0 if passed else 2


if __name__ == "__main__":
    raise SystemExit(main())
