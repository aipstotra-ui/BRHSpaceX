"""Orbit-averaged trapped-radiation dose grid (R1).

Build (needs SpacePy 0.7.0, see scripts/orbit/requirements.txt):
    python scripts/orbit/dose_table.py --jobs 8

Check (stdlib only, runs in ml/.venv):
    python scripts/orbit/dose_table.py --check

Model chain, per circular orbit and solar phase:
1. Positions: argument of latitude u uniform over one orbit, longitude uniform
   over Earth rotation. Latitude = asin(sin i * sin u). Retrograde inclinations
   fold to 180 - i in the app.
2. McIlwain L and B/B0 from IRBEM get_Lm with no external field and the
   internal field paired with the AP8/AE8 epoch (FIELD_BY_PHASE). B0 is the
   dipole equatorial field 0.311653 / L^3 gauss (UNILIB row in orbit-model.md).
3. AP8/AE8 omnidirectional differential flux at each position, averaged.
4. SHIELDOSE-2 (Si detector, nucmeth 1) on the averaged spectra for one year.
   The solid-sphere column is used, times SPHERE_FACTOR.

Grid steps, the position sampling and the year length are estimates recorded in
docs/research/orbit-model.md.
"""

from __future__ import annotations

import ctypes
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "orbit" / "dose_table.json"

ALTITUDES_KM = list(range(300, 2001, 50))
INCLINATIONS_DEG = list(range(0, 91, 10))
DEPTHS_MM_AL = [0.5, 1.0, 1.5, 2.0, 2.54, 3.0, 4.0, 5.0, 7.0, 10.0, 15.0, 20.0]
PHASES = ["min", "max"]
# Internal field and epoch paired with each AP8/AE8 phase. Sourced in R1 L2.
FIELD_BY_PHASE = {
    "min": {"intMag": "JC", "date": "1964-01-01T00:00:00"},
    "max": {"intMag": "GSFC", "date": "1970-01-01T00:00:00"},
}
# SHIELDOSE-2 solid-sphere normalization. Sourced in R1 L2 (Q3b).
SPHERE_FACTOR = 1.0
SPHERE_COLUMN = 2

LAT_STEP_DEG = 0.5
LON_STEP_DEG = 5.0
U_SAMPLES = 1440
PROTON_MEV = (0.1, 400.0, 120)
ELECTRON_MEV = (0.04, 7.0, 60)
UPSET_THRESHOLD_MEV = 70.0
SECONDS_PER_YEAR = 365.25 * 86400
EARTH_RADIUS_KM = 6371.2
DIPOLE_B0_NT = 31165.3
FLOOR = 1e-30

# Published reference points, filled from the R1 L2 researcher table.
REFERENCES: list[dict] = []


def _aep8(lib, energies, bb0, lval, which):
    """AP8/AE8 differential omni flux, shape (points, energies). Bad values are 0."""
    import numpy as np

    real8 = ctypes.c_double
    int4 = ctypes.c_int32
    nt_max, ne_max = 100000, 25
    out = np.zeros((len(bb0), len(energies)))
    for e0 in range(0, len(energies), ne_max):
        es = energies[e0 : e0 + ne_max]
        ne = len(es)
        e_arr = np.zeros((2, ne_max), order="F")
        e_arr[0, :ne] = es
        e_arr[1, :ne] = es
        for t0 in range(0, len(bb0), nt_max):
            nt = len(bb0[t0 : t0 + nt_max])
            b_arr = np.zeros(nt_max)
            b_arr[:nt] = bb0[t0 : t0 + nt_max]
            l_arr = np.zeros(nt_max)
            l_arr[:nt] = lval[t0 : t0 + nt_max]
            flux = np.zeros((nt_max, ne_max), order="F")
            lib.get_ae8_ap8_flux(
                int4(nt),
                int4(which),
                int4(1),
                int4(ne),
                e_arr.ctypes.data_as(ctypes.POINTER((real8 * 2) * ne_max)),
                b_arr.ctypes.data_as(ctypes.POINTER(real8 * nt_max)),
                l_arr.ctypes.data_as(ctypes.POINTER(real8 * nt_max)),
                flux.ctypes.data_as(ctypes.POINTER((real8 * nt_max) * ne_max)),
            )
            block = flux[:nt, :ne]
            block[~np.isfinite(block) | (block < 0)] = 0.0
            out[t0 : t0 + nt, e0 : e0 + ne] = block
    return out


def _field_lines(alt_km, lats, lons, phase):
    import numpy as np
    import spacepy.coordinates as spc
    import spacepy.irbempy as ib
    import spacepy.time as spt

    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    radius = np.full(lat_grid.size, (EARTH_RADIUS_KM + alt_km) / EARTH_RADIUS_KM)
    coords = spc.Coords(
        np.column_stack([radius, lat_grid.ravel(), lon_grid.ravel()]), "GEO", "sph", use_irbem=True
    )
    field = FIELD_BY_PHASE[phase]
    ticks = spt.Ticktock([field["date"]] * lat_grid.size, "ISO")
    result = ib.get_Lm(ticks, coords, [90], extMag="0", intMag=field["intMag"])
    lval = np.abs(np.asarray(result["Lm"], float)[:, 0])
    blocal = np.asarray(result["Blocal"], float)
    ok = np.isfinite(lval) & (lval > 0) & np.isfinite(blocal) & (blocal > 0)
    bb0 = np.ones_like(lval)
    bb0[ok] = np.maximum(1.0, blocal[ok] / (DIPOLE_B0_NT / lval[ok] ** 3))
    lval[~ok] = 0.0
    return bb0, lval, lat_grid.shape


def _dose_years(proton_e, proton_flux, electron_e, electron_flux):
    import numpy as np
    import spacepy.irbempy as ib

    model = ib.Shieldose2()
    model.set_shielding(depths=DEPTHS_MM_AL, units="mm")
    # SpacePy reads the trapped-proton grid length from the untrapped grid, so both share one grid.
    model.set_flux(np.maximum(electron_flux, FLOOR), electron_e, "e", tau=SECONDS_PER_YEAR)
    model.set_flux(np.full_like(proton_e, FLOOR), proton_e, "p_un", tau=SECONDS_PER_YEAR)
    model.set_flux(np.maximum(proton_flux, FLOOR), proton_e, "p_tr", tau=SECONDS_PER_YEAR)
    model.get_dose(detector=3, nucmeth=1)
    res = model.results

    def column(key):
        return [float(v) * SPHERE_FACTOR for v in np.asarray(res[key])[:, SPHERE_COLUMN]]

    proton = column("dose_proton_trapped")
    electron = [a + b for a, b in zip(column("dose_electron"), column("dose_bremsstrahlung"))]
    return proton, electron


def _single_cpu():
    """SpacePy's own get_Lm pool deadlocked on macOS, so each process traces field lines alone."""
    import spacepy

    spacepy.config["ncpus"] = 1


def _energies():
    import numpy as np

    proton_e = np.logspace(np.log10(PROTON_MEV[0]), np.log10(PROTON_MEV[1]), PROTON_MEV[2])
    electron_e = np.logspace(np.log10(ELECTRON_MEV[0]), np.log10(ELECTRON_MEV[1]), ELECTRON_MEV[2])
    return proton_e, electron_e


def _altitude_rows(job):
    """Dose, proton share and upset flux for one (phase, altitude) across all inclinations."""
    import numpy as np
    import spacepy.irbempy as ib

    _single_cpu()
    phase, alt = job
    lib = ib.irbemlib
    proton_e, electron_e = _energies()
    lats = np.arange(-90 + LAT_STEP_DEG / 2, 90, LAT_STEP_DEG)
    lons = np.arange(0, 360, LON_STEP_DEG)
    u = (np.arange(U_SAMPLES) + 0.5) * 2 * np.pi / U_SAMPLES
    which_p = 3 if phase == "min" else 4
    which_e = 1 if phase == "min" else 2
    bb0, lval, shape = _field_lines(alt, lats, lons, phase)
    p_flux = _aep8(lib, proton_e, bb0, lval, which_p).reshape(*shape, -1).mean(axis=1)
    e_flux = _aep8(lib, electron_e, bb0, lval, which_e).reshape(*shape, -1).mean(axis=1)
    above = proton_e >= UPSET_THRESHOLD_MEV
    p_upset = np.trapezoid(p_flux[:, above], proton_e[above], axis=1)
    rows_total, rows_share, rows_upset = [], [], []
    for inc in INCLINATIONS_DEG:
        lat_path = np.degrees(np.arcsin(np.sin(np.radians(inc)) * np.sin(u)))
        p_avg = np.array([np.interp(lat_path, lats, p_flux[:, k]).mean() for k in range(len(proton_e))])
        e_avg = np.array([np.interp(lat_path, lats, e_flux[:, k]).mean() for k in range(len(electron_e))])
        proton, electron = _dose_years(proton_e, p_avg, electron_e, e_avg)
        sums = [p + e for p, e in zip(proton, electron)]
        rows_total.append([float(f"{v:.4g}") for v in sums])
        rows_share.append([float(f"{p / s:.3f}") if s > 0 else 0.0 for p, s in zip(proton, sums)])
        rows_upset.append(float(f"{np.interp(lat_path, lats, p_upset).mean():.4g}"))
    return phase, alt, rows_total, rows_share, rows_upset


def build(jobs: int = 1) -> dict:
    import spacepy
    from concurrent.futures import ProcessPoolExecutor

    _single_cpu()
    work = [(phase, alt) for phase in PHASES for alt in ALTITUDES_KM]
    done = {}
    if jobs > 1:
        with ProcessPoolExecutor(jobs) as pool:
            for phase, alt, *rows in pool.map(_altitude_rows, work):
                done[(phase, alt)] = rows
                print(f"{phase} {alt} km done", flush=True)
    else:
        for job in work:
            phase, alt, *rows = _altitude_rows(job)
            done[(phase, alt)] = rows
            print(f"{phase} {alt} km done", flush=True)

    # [phase][alt][inc] and [phase][alt][inc][depth]
    total = {phase: [done[(phase, alt)][0] for alt in ALTITUDES_KM] for phase in PHASES}
    proton_share = {phase: [done[(phase, alt)][1] for alt in ALTITUDES_KM] for phase in PHASES}
    upset_flux = {phase: [done[(phase, alt)][2] for alt in ALTITUDES_KM] for phase in PHASES}

    return {
        "mode": "computed",
        "model": "AP8/AE8 (IRBEM) + SHIELDOSE-2, solid-sphere centre, Si",
        "spacepy": spacepy.__version__,
        "fieldByPhase": FIELD_BY_PHASE,
        "sphereFactor": SPHERE_FACTOR,
        "unit": "rad(Si)/yr",
        "upsetUnit": "1/cm2/s",
        "upsetThresholdMeV": UPSET_THRESHOLD_MEV,
        "phases": PHASES,
        "altitudesKm": ALTITUDES_KM,
        "inclinationsDeg": INCLINATIONS_DEG,
        "depthsMmAl": DEPTHS_MM_AL,
        "doseRadSiPerYear": total,
        "protonShare": proton_share,
        "protonFluxAboveThreshold": upset_flux,
        "references": REFERENCES,
        "notes": [
            "Trapped particles only. Solar energetic protons and galactic cosmic rays are not in this grid.",
            "Orbit average over uniform argument of latitude and uniform longitude. Grid steps are estimates.",
            "B0 is the dipole equatorial field 0.311653 / L^3 gauss.",
            "AP8/AE8 are static models of their epochs. The SAA has drifted since then.",
        ],
    }


def _lookup(table: dict, phase: str, alt: float, inc: float, depth: float) -> float:
    """Trilinear in altitude, folded inclination, and depth. Log-linear in dose."""
    import math

    def hit(axis, value):
        value = min(max(value, axis[0]), axis[-1])
        for i in range(len(axis) - 1):
            if axis[i] <= value <= axis[i + 1]:
                span = axis[i + 1] - axis[i]
                return i, i + 1, 0.0 if span == 0 else (value - axis[i]) / span
        return len(axis) - 1, len(axis) - 1, 0.0

    inc = 180 - inc if inc > 90 else inc
    grid = table["doseRadSiPerYear"][phase]
    a0, a1, ta = hit(table["altitudesKm"], alt)
    i0, i1, ti = hit(table["inclinationsDeg"], inc)
    d0, d1, td = hit(table["depthsMmAl"], depth)
    acc = 0.0
    for ai, wa in ((a0, 1 - ta), (a1, ta)):
        for ii, wi in ((i0, 1 - ti), (i1, ti)):
            for di, wd in ((d0, 1 - td), (d1, td)):
                w = wa * wi * wd
                if w:
                    acc += w * math.log(max(grid[ai][ii][di], FLOOR))
    return math.exp(acc)


def check(table: dict) -> int:
    rows = table.get("references") or []
    if table.get("mode") != "computed" or not rows:
        print("no reference: estimate")
        print("leave-one-out is not computed because there are no reference rows")
        return 0
    print(f"{len(rows)} reference rows, model {table['model']}")
    for row in rows:
        model = _lookup(table, row["phase"], row["altitudeKm"], row["inclinationDeg"], row["depthMmAl"])
        ref = row["referenceRadSiPerYear"]
        err = 100 * (model - ref) / ref
        print(
            f"alt {row['altitudeKm']} inc {row['inclinationDeg']} depth {row['depthMmAl']} mm "
            f"phase {row['phase']}: reference {ref:.4g} model {model:.4g} rad(Si)/yr "
            f"error {err:+.1f}% ({row['source']})"
        )
    return 0


def main() -> None:
    if "--check" in sys.argv:
        raise SystemExit(check(json.loads(OUT.read_text())))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    jobs = 1
    if "--jobs" in sys.argv:
        jobs = int(sys.argv[sys.argv.index("--jobs") + 1])
    table = build(jobs)
    OUT.write_text(json.dumps(table, separators=(",", ":")) + "\n")
    print(f"wrote {OUT}")
    check(table)


if __name__ == "__main__":
    main()
