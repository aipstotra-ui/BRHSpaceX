#!/usr/bin/env python3
"""Precompute the |B| < 25,000 nT SAA contour from IGRF-14.

Heirtzler (2002) calls the 25,000 nT contour critical up to 1,000 km:
https://ntrs.nasa.gov/api/citations/20000013569/downloads/20000013569.pdf

Coefficients: IAGA IGRF-14 (data/orbit/igrf14coeffs.txt).
The synthesis is the IGRF geodetic routine (WGS 84 spheroid, Schmidt
quasi-normal Legendre functions), evaluated on a grid. Runtime code
reads the polygons and does not evaluate IGRF.
"""

from __future__ import annotations

import base64
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
COEFFS = ROOT / "data" / "orbit" / "igrf14coeffs.txt"
OUT = ROOT / "data" / "orbit" / "saa_igrf14.json"

THRESHOLD_NT = 25000.0
EPOCH_YEAR = 2026.0 + (276.0 / 365.25)  # 2026-10-03
NMAX = 13
ALTITUDES_KM = [400, 450, 500, 600, 700, 800, 1000, 1200, 1500, 1800, 2000]
A_KM = 6371.2


def load_epoch(path: Path, year: float) -> list[float]:
    """Flat gh list in IGRF order: g10, g11, h11, g20, g21, h21, ..."""
    header: list[str] | None = None
    rows: list[tuple[str, int, int, list[float]]] = []
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split()
        if parts[0] in {"g/h", "c/s"}:
            header = parts
            continue
        kind, n_s, m_s, *vals = parts
        rows.append((kind, int(n_s), int(m_s), [float(v) for v in vals]))
    if header is None:
        raise SystemExit(f"no epoch header in {path}")
    years = header[3:]
    if "2025.0" not in years:
        raise SystemExit(f"IGRF-14 2025.0 column missing: {years[-4:]}")
    i2025 = years.index("2025.0")
    isv = years.index("2025-30")
    dt = year - 2025.0
    gh = [0.0]
    for n in range(1, NMAX + 1):
        for m in range(0, n + 1):
            g = _coeff(rows, "g", n, m, i2025, isv, dt)
            gh.append(g)
            if m > 0:
                h = _coeff(rows, "h", n, m, i2025, isv, dt)
                gh.append(h)
    return gh


def _coeff(
    rows: list[tuple[str, int, int, list[float]]],
    kind: str,
    n: int,
    m: int,
    i_main: int,
    i_sv: int,
    dt: float,
) -> float:
    for row_kind, rn, rm, vals in rows:
        if row_kind == kind and rn == n and rm == m:
            main = vals[i_main]
            sv = vals[i_sv] if n <= 8 else 0.0
            return main + dt * sv
    raise SystemExit(f"missing {kind} {n} {m}")


def total_field_nt(lat_deg: float, lon_deg: float, alt_km: float, gh: list[float]) -> float:
    """|B| in nT. Port of the IGRF geodetic synthesis (itype = 1)."""
    colat = (90.0 - lat_deg) * 0.017453292
    elong = lon_deg * 0.017453292
    st = math.sin(colat)
    ct = math.cos(colat)
    a2 = 40680631.6
    b2 = 40408296.0
    one = a2 * st * st
    two = b2 * ct * ct
    three = one + two
    rho = math.sqrt(three)
    radius = math.sqrt(alt_km * (alt_km + 2.0 * rho) + (a2 * one + b2 * two) / three)
    cd = (alt_km + rho) / radius
    sd = (a2 - b2) / rho * ct * st / radius
    ct_g = ct * cd - st * sd
    st_g = st * cd + ct * sd
    ct = ct_g
    st = st_g

    ratio = A_KM / radius
    rr = ratio * ratio
    nmx = NMAX
    kmx = (nmx + 1) * (nmx + 2) // 2
    p = [0.0] * (kmx + 1)
    q = [0.0] * (kmx + 1)
    cl = [0.0] * (nmx + 1)
    sl = [0.0] * (nmx + 1)
    p[1] = 1.0
    p[3] = st
    q[1] = 0.0
    q[3] = ct
    cl[1] = math.cos(elong)
    sl[1] = math.sin(elong)
    x = 0.0
    y = 0.0
    z = 0.0
    n = 0
    m = 1
    ell = 1
    fn = 0.0
    for k in range(2, kmx + 1):
        if n < m:
            m = 0
            n += 1
            rr *= ratio
            fn = float(n)
            gn = float(n - 1)
        fm = float(m)
        if m == n:
            if k != 3:
                one = math.sqrt(1.0 - 0.5 / fm)
                j = k - n - 1
                p[k] = one * st * p[j]
                q[k] = one * (st * q[j] + ct * p[j])
                cl[m] = cl[m - 1] * cl[1] - sl[m - 1] * sl[1]
                sl[m] = sl[m - 1] * cl[1] + cl[m - 1] * sl[1]
        else:
            gmm = fm * fm
            one = math.sqrt(fn * fn - gmm)
            two = math.sqrt(gn * gn - gmm) / one
            three = (fn + gn) / one
            i = k - n
            j = i - n + 1
            p[k] = three * ct * p[i] - two * p[j]
            q[k] = three * (ct * q[i] - st * p[i]) - two * q[j]
        if m == 0:
            one = gh[ell] * rr
            x += one * q[k]
            z -= (fn + 1.0) * one * p[k]
            ell += 1
        else:
            one = gh[ell] * rr
            two = gh[ell + 1] * rr
            three = one * cl[m] + two * sl[m]
            x += three * q[k]
            z -= (fn + 1.0) * three * p[k]
            if st == 0.0:
                y += (one * sl[m] - two * cl[m]) * q[k] * ct
            else:
                y += (one * sl[m] - two * cl[m]) * fm * p[k] / st
            ell += 2
        m += 1
    bx = x * cd + z * sd
    bz = z * cd - x * sd
    return math.sqrt(bx * bx + y * y + bz * bz)


def grid_field(gh: list[float], alt_km: float, step: float = 1.0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    lats = np.arange(-90.0, 90.0 + step * 0.5, step)
    lons = np.arange(-180.0, 180.0 + step * 0.5, step)
    field = np.empty((lats.size, lons.size), dtype=np.float64)
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            field[i, j] = total_field_nt(float(lat), float(lon), alt_km, gh)
    return lats, lons, field


def split_dateline(vertices: np.ndarray) -> list[list[list[float]]]:
    """Drop antimeridian stitches. ±180° at the same latitude are one meridian."""
    parts: list[list[list[float]]] = []
    current: list[list[float]] = [[round(float(vertices[0, 0]), 3), round(float(vertices[0, 1]), 3)]]
    for previous, nxt in zip(vertices, vertices[1:]):
        point = [round(float(nxt[0]), 3), round(float(nxt[1]), 3)]
        if abs(float(nxt[0]) - float(previous[0])) > 90.0:
            if len(current) > 2:
                parts.append(current)
            current = [point]
        else:
            current.append(point)
    if len(current) > 2:
        parts.append(current)
    return parts


def rings_from_field(lats: np.ndarray, lons: np.ndarray, field: np.ndarray) -> list[list[list[float]]]:
    figure = plt.figure()
    contour = plt.contour(lons, lats, field, levels=[THRESHOLD_NT])
    plt.close(figure)
    rings: list[list[list[float]]] = []
    for path in contour.get_paths():
        if len(path.vertices) < 8:
            continue
        rings.extend(split_dateline(path.vertices))
    return rings


def inside_rings(lat: float, lon: float, rings: list[list[list[float]]]) -> bool:
    """Even-odd ray cast. Edges that jump the antimeridian are already removed."""
    if not rings:
        return False
    inside = False
    for ring in rings:
        count = len(ring)
        if count < 3:
            continue
        j = count - 1
        for i in range(count):
            lon_i, lat_i = ring[i]
            lon_j, lat_j = ring[j]
            if abs(lon_i - lon_j) > 90.0:
                j = i
                continue
            crosses = (lat_i > lat) != (lat_j > lat)
            if crosses:
                x_cross = (lon_j - lon_i) * (lat - lat_i) / (lat_j - lat_i) + lon_i
                if lon < x_cross:
                    inside = not inside
            j = i
    return inside


def main() -> None:
    gh = load_epoch(COEFFS, EPOCH_YEAR)
    # Order-of-magnitude anchors. Equatorial |B| is tens of thousands of nT;
    # the SAA minimum at LEO is the weak region.
    greenwich = total_field_nt(51.5, 0.0, 0.0, gh)
    saa = total_field_nt(-30.0, -40.0, 500.0, gh)
    pole = total_field_nt(90.0, 0.0, 0.0, gh)
    print(f"epoch {EPOCH_YEAR:.4f} greenwich0 {greenwich:.0f} saa500 {saa:.0f} pole0 {pole:.0f}")
    if not (35000 < greenwich < 55000 and 15000 < saa < 25000 and pole > 50000):
        raise SystemExit("IGRF-14 magnitude check failed; contour not written")

    altitudes = []
    for alt in ALTITUDES_KM:
        lats, lons, field = grid_field(gh, alt, step=1.0)
        low = field < THRESHOLD_NT
        min_i = np.unravel_index(int(np.argmin(field)), field.shape)
        rings = rings_from_field(lats, lons, field)
        # Matplotlib's closed contour is the boundary. Even-odd containment
        # matches the low-field side for a single blob; if it matches the
        # high-field side, reverse the test by flipping a stored flag.
        probe_lat = float(lats[min_i[0]])
        probe_lon = float(lons[min_i[1]])
        contains_minimum = inside_rings(probe_lat, probe_lon, rings)
        sample_ok = 0
        sample_n = 0
        for i in range(0, lats.size, 10):
            for j in range(0, lons.size, 10):
                sample_n += 1
                inside = inside_rings(float(lats[i]), float(lons[j]), rings)
                if not contains_minimum:
                    inside = not inside
                if inside == bool(low[i, j]):
                    sample_ok += 1
        fraction = sample_ok / sample_n
        print(
            f"alt {alt} min {field.min():.0f} nT at {probe_lat:.0f},{probe_lon:.0f} "
            f"rings {len(rings)} low {low.mean():.3f} agree {fraction:.3f}"
        )
        # 2° mask is the inside-test. The rings are the drawn contour.
        mask = low[::2, ::2]
        packed = base64.b64encode(np.packbits(mask.astype(np.uint8), bitorder="big")).decode("ascii")
        altitudes.append(
            {
                "altitudeKm": alt,
                "minNt": round(float(field.min()), 1),
                "minLatDeg": round(probe_lat, 3),
                "minLonDeg": round(probe_lon, 3),
                "interiorIsInside": contains_minimum,
                "polygonAgreement": round(fraction, 4),
                "gridStepDeg": 2,
                "gridLat0": -90,
                "gridLon0": -180,
                "gridNLat": int(mask.shape[0]),
                "gridNLon": int(mask.shape[1]),
                "mask": packed,
                "rings": rings,
            }
        )

    def mask_hit(altitude_km: float, lat: float, lon: float) -> bool:
        layer = min(altitudes, key=lambda row: abs(row["altitudeKm"] - altitude_km))
        step = layer["gridStepDeg"]
        i = int(round((lat - layer["gridLat0"]) / step))
        j = int(round((lon - layer["gridLon0"]) / step))
        i = max(0, min(layer["gridNLat"] - 1, i))
        j = max(0, min(layer["gridNLon"] - 1, j))
        raw = np.frombuffer(base64.b64decode(layer["mask"]), dtype=np.uint8)
        bits = np.unpackbits(raw, bitorder="big")
        return bool(bits[i * layer["gridNLon"] + j])

    inside = {"latDeg": -40.0, "lonDeg": -40.0, "altitudeKm": 500}
    outside = {"latDeg": 51.5, "lonDeg": 0.0, "altitudeKm": 500}
    if not mask_hit(500, -40, -40) or mask_hit(500, 51.5, 0):
        raise SystemExit("SAA fixture is not inside the 25,000 nT region")
    # Fermi's polygon stops at 30°S. This fixture is south of that.
    if inside["latDeg"] > -30:
        raise SystemExit("fixture must lie south of the Fermi 30°S cutoff")

    payload = {
        "model": "IGRF-14",
        "thresholdNt": THRESHOLD_NT,
        "epochYear": round(EPOCH_YEAR, 4),
        "epochDate": "2026-10-03",
        "referenceRadiusKm": A_KM,
        "citation": "Heirtzler 2002, JASTP 64:1701",
        "citationUrl": "https://ntrs.nasa.gov/api/citations/20000013569/downloads/20000013569.pdf",
        "coefficients": "data/orbit/igrf14coeffs.txt",
        "coefficientsUrl": "https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt",
        "note": "Nearest-altitude 2° mask of |B| < 25,000 nT, plus contour rings for drawing. Do not evaluate IGRF per frame.",
        "fixtures": {"inside": inside, "outside": outside},
        "altitudes": altitudes,
    }
    OUT.write_text(json.dumps(payload))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
