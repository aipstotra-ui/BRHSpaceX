"""Map of trapped-proton flux above 10 MeV, for drawing the South Atlantic Anomaly on the globe.

Build (needs SpacePy 0.7.0, see scripts/orbit/requirements.txt):
    scripts/orbit/.venv/bin/python scripts/orbit/saa_map.py

Check (stdlib only):
    python scripts/orbit/saa_map.py --check

Model chain, per grid point (geographic latitude, longitude, altitude):
1. McIlwain L and local B from IRBEM get_Lm, no external field, internal field IGRF at FIELD_DATE.
   The modern field puts the SAA where it is today; AP8's own epoch field (JC 1964) would place it
   about 15-20 degrees further east. Pairing AP8 with a modern field is a known approximation for the
   flux magnitude, so the map is for location and shape first.
2. B/B0 with B0 the dipole equatorial field 0.311653 / L^3 gauss (same as dose_table.py).
3. AP8MIN omnidirectional integral flux above ENERGY_MEV (IRBEM get_ae8_ap8_flux, whatf 3).

Output: data/orbit/proton_flux_map.json. log10 flux per point, quantized to one byte (0 = at or below
LOG_FLOOR), base64, ordered [altitude][latitude][longitude]. Grid steps are display choices.
"""

from __future__ import annotations

import base64
import ctypes
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "orbit" / "proton_flux_map.json"

ENERGY_MEV = 10.0
FIELD_DATE = "2025-01-01T00:00:00"
ALTITUDES_KM = list(range(300, 2001, 100))
LAT_STEP_DEG = 1.0
LON_STEP_DEG = 1.0
EARTH_RADIUS_KM = 6371.2
DIPOLE_B0_NT = 31165.3
# log10 of flux in 1/cm2/s. Bytes 1..255 span LOG_FLOOR..LOG_CEIL.
LOG_FLOOR = -2.0
LOG_CEIL = 6.0
AP8MIN = 3
INTEGRAL = 3


def _grid():
    lats = [-90 + LAT_STEP_DEG / 2 + i * LAT_STEP_DEG for i in range(int(180 / LAT_STEP_DEG))]
    lons = [-180 + LON_STEP_DEG / 2 + i * LON_STEP_DEG for i in range(int(360 / LON_STEP_DEG))]
    return lats, lons


def _field(alt_km, lats, lons):
    import numpy as np
    import spacepy.coordinates as spc
    import spacepy.irbempy as ib
    import spacepy.time as spt

    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")
    radius = np.full(lat_grid.size, (EARTH_RADIUS_KM + alt_km) / EARTH_RADIUS_KM)
    coords = spc.Coords(np.column_stack([radius, lat_grid.ravel(), lon_grid.ravel()]), "GEO", "sph", use_irbem=True)
    ticks = spt.Ticktock([FIELD_DATE] * lat_grid.size, "ISO")
    result = ib.get_Lm(ticks, coords, [90], extMag="0", intMag="IGRF")
    lval = np.abs(np.asarray(result["Lm"], float)[:, 0])
    blocal = np.asarray(result["Blocal"], float)
    ok = np.isfinite(lval) & (lval > 0) & np.isfinite(blocal) & (blocal > 0)
    bb0 = np.ones_like(lval)
    bb0[ok] = np.maximum(1.0, blocal[ok] / (DIPOLE_B0_NT / lval[ok] ** 3))
    lval[~ok] = 0.0
    return bb0, lval


def _ap8_integral(lib, bb0, lval):
    import numpy as np

    real8 = ctypes.c_double
    int4 = ctypes.c_int32
    nt_max, ne_max = 100000, 25
    out = np.zeros(len(bb0))
    for t0 in range(0, len(bb0), nt_max):
        nt = len(bb0[t0 : t0 + nt_max])
        e_arr = np.zeros((2, ne_max), order="F")
        e_arr[0, 0] = ENERGY_MEV
        e_arr[1, 0] = ENERGY_MEV
        b_arr = np.zeros(nt_max)
        b_arr[:nt] = bb0[t0 : t0 + nt_max]
        l_arr = np.zeros(nt_max)
        l_arr[:nt] = lval[t0 : t0 + nt_max]
        flux = np.zeros((nt_max, ne_max), order="F")
        lib.get_ae8_ap8_flux(
            int4(nt),
            int4(AP8MIN),
            int4(INTEGRAL),
            int4(1),
            e_arr.ctypes.data_as(ctypes.POINTER((real8 * 2) * ne_max)),
            b_arr.ctypes.data_as(ctypes.POINTER(real8 * nt_max)),
            l_arr.ctypes.data_as(ctypes.POINTER(real8 * nt_max)),
            flux.ctypes.data_as(ctypes.POINTER((real8 * nt_max) * ne_max)),
        )
        block = flux[:nt, 0]
        block[~np.isfinite(block) | (block < 0)] = 0.0
        out[t0 : t0 + nt] = block
    return out


def _quantize(flux):
    import numpy as np

    logs = np.log10(np.maximum(flux, 10.0**LOG_FLOOR))
    q = np.round(1 + (logs - LOG_FLOOR) / (LOG_CEIL - LOG_FLOOR) * 254)
    q[flux <= 10.0**LOG_FLOOR] = 0
    return np.clip(q, 0, 255).astype(np.uint8)


def build() -> dict:
    import numpy as np
    import spacepy
    import spacepy.irbempy as ib

    spacepy.config["ncpus"] = 1
    lats, lons = _grid()
    layers = []
    for alt in ALTITUDES_KM:
        bb0, lval = _field(alt, lats, lons)
        flux = _ap8_integral(ib.irbemlib, bb0, lval)
        layers.append(_quantize(flux))
        print(f"{alt} km: max {flux.max():.3g} /cm2/s", flush=True)
    packed = np.concatenate(layers).tobytes()
    return {
        "model": "AP8MIN omnidirectional integral proton flux (IRBEM)",
        "energyMeV": ENERGY_MEV,
        "unit": "1/cm2/s",
        "field": {"internal": "IGRF", "external": "none", "date": FIELD_DATE},
        "spacepy": spacepy.__version__,
        "altitudesKm": ALTITUDES_KM,
        "latStartDeg": lats[0],
        "latStepDeg": LAT_STEP_DEG,
        "latCount": len(lats),
        "lonStartDeg": lons[0],
        "lonStepDeg": LON_STEP_DEG,
        "lonCount": len(lons),
        "order": "altitude, latitude (south to north), longitude (west to east)",
        "encoding": {"byte0": "at or below floor", "logFloor": LOG_FLOOR, "logCeil": LOG_CEIL, "steps": 254},
        "log10FluxBase64": base64.b64encode(packed).decode("ascii"),
        "notes": [
            "Trapped protons only, solar-minimum model. Solar-maximum fluxes at low altitude are lower.",
            "B and L from a 2025 field so the SAA sits where it is today; AP8 itself is a 1960s model, so "
            "flux magnitudes with a modern field are an approximation.",
            "AP8 gives no flux beyond its B/B0 cutoff, so the SAA edge is a cliff, not a gradual fall-off. "
            "The 1 degree grid sets how finely that edge is drawn.",
            "Grid steps and the byte encoding are display choices.",
        ],
    }


def _decode(table: dict):
    raw = base64.b64decode(table["log10FluxBase64"])
    enc = table["encoding"]
    per = table["latCount"] * table["lonCount"]

    def flux(alt_index: int, lat_index: int, lon_index: int) -> float:
        q = raw[alt_index * per + lat_index * table["lonCount"] + lon_index]
        if q == 0:
            return 0.0
        return 10 ** (enc["logFloor"] + (q - 1) / enc["steps"] * (enc["logCeil"] - enc["logFloor"]))

    return flux


def check(table: dict) -> int:
    """Sanity: at each altitude the maximum sits in the South Atlantic, and flux grows with altitude."""
    flux = _decode(table)
    lat_n, lon_n = table["latCount"], table["lonCount"]
    previous = 0.0
    failures = 0
    for a, alt in enumerate(table["altitudesKm"]):
        best = max(((flux(a, i, j), i, j) for i in range(lat_n) for j in range(lon_n)))
        value, i, j = best
        lat = table["latStartDeg"] + i * table["latStepDeg"]
        lon = table["lonStartDeg"] + j * table["lonStepDeg"]
        in_atlantic = -45 <= lat <= 0 and -90 <= lon <= 0
        grows = value >= previous
        previous = value
        flag = "ok" if in_atlantic and grows else "CHECK"
        failures += flag != "ok"
        print(f"{alt:5d} km: max {value:9.3g} /cm2/s at {lat:6.1f}, {lon:7.1f}  {flag}")
    return 1 if failures else 0


def main() -> None:
    if "--check" in sys.argv:
        raise SystemExit(check(json.loads(OUT.read_text())))
    table = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(table, separators=(",", ":")) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
    raise SystemExit(check(table))


if __name__ == "__main__":
    main()
