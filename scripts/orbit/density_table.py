"""Precompute an NRLMSIS 2.0 density grid with pymsis 0.12.0.

Grid steps are estimates recorded in docs/research/orbit-model.md.
No density number is taken from the pymsis documentation.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
from pymsis import Variable, calculate

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "orbit" / "density_table.json"

ALTITUDES_KM = list(range(100, 2001, 25))
F107 = [70, 100, 150, 200, 250]
AP = [4, 15, 40, 80, 154, 236, 400]
DATE = datetime(2020, 6, 21)


def main() -> None:
    # density[alt][f107][ap]
    columns: dict[tuple[int, int], list[float]] = {}
    for f107 in F107:
        for ap in AP:
            out = calculate(
                DATE,
                0.0,
                0.0,
                ALTITUDES_KM,
                f107,
                f107,
                np.array([[ap] * 7], dtype=float),
                version=2.0,
            )
            values = np.asarray(out)[..., Variable.MASS_DENSITY].reshape(-1)
            if values.shape[0] != len(ALTITUDES_KM):
                raise SystemExit(f"unexpected density shape {values.shape}")
            if not np.all(np.isfinite(values)) or np.any(values < 0):
                raise SystemExit(f"non-finite density at F10.7={f107}, Ap={ap}")
            columns[(f107, ap)] = [float(value) for value in values]
            print(f"F10.7 {f107} Ap {ap}", flush=True)

    density = [
        [[columns[(f107, ap)][i] for ap in AP] for f107 in F107]
        for i in range(len(ALTITUDES_KM))
    ]

    payload = {
        "model": "NRLMSIS 2.0",
        "pymsis": "0.12.0",
        "version": 2.0,
        "date": "2020-06-21",
        "latitudeDeg": 0,
        "longitudeDeg": 0,
        "f107aEqualsF107": True,
        "apSlots": "all seven slots set to the daily Ap",
        "unit": "kg/m3",
        "altitudesKm": ALTITUDES_KM,
        "f107": F107,
        "ap": AP,
        "density": density,
        "label": "estimate",
        "notes": [
            "Grid steps, the fixed date, the equator point, F10.7a = F10.7, and the seven equal Ap slots are estimates.",
            "pymsis 0.12.0 calculate(..., version=2.0). Output index 0 is total mass density in kg/m^3.",
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
