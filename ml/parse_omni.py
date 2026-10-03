"""Parse OMNI2 hourly files into a fill-cleaned Parquet table.

Layout, fills, and the flow-pressure formula are from
https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni/omni2.text
(see docs/research/data-sources.md). Word numbers below are 1-based in that
file. Word 46 (>10 MeV protons) is not read.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "ml" / "data" / "raw"
OUT_PATH = ROOT / "ml" / "data" / "omni_hourly.parquet"

# 0-based index, fill token from omni2.text.
BY_GSM_I, BY_GSM_FILL = 15, "999.9"  # word 16
BZ_GSM_I, BZ_GSM_FILL = 16, "999.9"  # word 17
DENSITY_I, DENSITY_FILL = 23, "999.9"  # word 24
SPEED_I, SPEED_FILL = 24, "9999."  # word 25
NA_NP_I, NA_NP_FILL = 27, "9.999"  # word 28
KP_I, KP_FILL = 38, "99"  # word 39
DST_I, DST_FILL = 40, "99999"  # word 41
F107_I, F107_FILL = 50, "999.9"  # word 51

COLUMNS = (
    "by_gsm",
    "bz_gsm",
    "speed",
    "density",
    "kp",
    "dst",
    "f107",
    "pdyn",
)


def is_fill(token: str, fill: str) -> bool:
    try:
        return float(token) == float(fill)
    except ValueError:
        return True


def kp_from_tenths(tenths: float) -> float:
    """Kp = round(x*3/10)/3, with x = Kp*10. From data-sources.md."""
    return round(tenths * 3 / 10) / 3


def flow_pressure(density: float, speed: float, na_np: float | None) -> float:
    """OMNI flow pressure, nPa. Both branches are quoted in omni2.text.

    P = (1.67/10**6) * Np * V**2 * (1 + 4*Na/Np) when Na/Np is present.
    P = (2.0/10**6) * Np * V**2 when Na/Np is fill.
    """
    if na_np is None:
        return (2.0 / 10**6) * density * speed**2
    return (1.67 / 10**6) * density * speed**2 * (1 + 4 * na_np)


def parse_line(parts: list[str]) -> dict[str, object] | None:
    if len(parts) < 55:
        return None
    try:
        year = int(parts[0])
        doy = int(parts[1])
        hour = int(parts[2])
        when = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=doy - 1, hours=hour)
    except ValueError:
        return None

    def take(index: int, fill: str) -> float | None:
        if is_fill(parts[index], fill):
            return None
        try:
            return float(parts[index])
        except ValueError:
            return None

    density = take(DENSITY_I, DENSITY_FILL)
    speed = take(SPEED_I, SPEED_FILL)
    na_np = None if is_fill(parts[NA_NP_I], NA_NP_FILL) else take(NA_NP_I, NA_NP_FILL)
    if is_fill(parts[KP_I], KP_FILL):
        kp = None
    else:
        try:
            kp = kp_from_tenths(float(parts[KP_I]))
        except ValueError:
            kp = None
    pdyn = None if density is None or speed is None else flow_pressure(density, speed, na_np)
    values = {
        "by_gsm": take(BY_GSM_I, BY_GSM_FILL),
        "bz_gsm": take(BZ_GSM_I, BZ_GSM_FILL),
        "speed": speed,
        "density": density,
        "kp": kp,
        "dst": take(DST_I, DST_FILL),
        "f107": take(F107_I, F107_FILL),
        "pdyn": pdyn,
    }
    row: dict[str, object] = {"time": when}
    for name in COLUMNS:
        value = values[name]
        row[name] = value
        row[f"{name}_missing"] = value is None
    return row


def iter_raw_files() -> list[Path]:
    return sorted(RAW_DIR.glob("omni2_*.dat"))


def parse_files(paths: list[Path]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for path in paths:
        text = path.read_text(errors="replace")
        for line in text.splitlines():
            if not line.strip():
                continue
            parsed = parse_line(line.split())
            if parsed is not None:
                rows.append(parsed)
    rows.sort(key=lambda row: row["time"])  # type: ignore[arg-type, return-value]
    return rows


def rows_to_table(rows: list[dict[str, object]]) -> pa.Table:
    def floats(name: str) -> pa.Array:
        values = [np.nan if row[name] is None else float(row[name]) for row in rows]  # type: ignore[arg-type]
        return pa.array(values, type=pa.float64())

    arrays: list[pa.Array] = [
        pa.array([row["time"] for row in rows], type=pa.timestamp("us", tz="UTC")),
    ]
    names = ["time"]
    for name in COLUMNS:
        arrays.append(floats(name))
        names.append(name)
        arrays.append(pa.array([bool(row[f"{name}_missing"]) for row in rows], type=pa.bool_()))
        names.append(f"{name}_missing")
    return pa.Table.from_arrays(arrays, names=names)


def write_parquet(table: pa.Table, path: Path = OUT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path, compression="snappy")


def write_data_report(path: Path | None = None) -> None:
    """Write docs/research/data-report.md from parsed artifacts."""
    path = path or (ROOT / "docs" / "research" / "data-report.md")
    table = pq.read_table(OUT_PATH)
    times = table.column("time").to_numpy()
    years = times.astype("datetime64[Y]").astype(int) + 1970
    decades = (years // 10) * 10
    lines = [
        "# Data report",
        "",
        "Computed from `ml/data/omni_hourly.parquet` unless a sentence cites another file.",
        "Word 46 (OMNI >10 MeV protons) is not in this table.",
        "",
        "## Coverage per column per decade",
        "",
        "Fraction of hours with a non-missing value.",
        "",
        "| Decade | " + " | ".join(COLUMNS) + " |",
        "|---|" + "|".join("---" for _ in COLUMNS) + "|",
    ]
    for decade in sorted(set(decades.tolist())):
        mask = decades == decade
        cells = []
        for name in COLUMNS:
            values = table.column(name).to_numpy()
            frac = float(np.isfinite(values[mask]).mean()) if mask.any() else float("nan")
            cells.append(f"{frac:.4f}")
        lines.append(f"| {decade}s | " + " | ".join(cells) + " |")

    lines.extend(["", "## Last valid OMNI hour per column", "", "| Column | Last valid hour (UTC) |", "|---|---|"])
    for name in COLUMNS:
        values = table.column(name).to_numpy()
        valid = np.isfinite(values)
        if not valid.any():
            lines.append(f"| {name} | none |")
            continue
        last = times[valid].max()
        lines.append(f"| {name} | {np.datetime_as_string(last, unit='h')} |")

    window = (times >= np.datetime64("2024-05-10T00:00:00")) & (
        times < np.datetime64("2024-05-12T00:00:00")
    )
    dst = table.column("dst").to_numpy()
    dst_window = dst[window]
    dst_finite = dst_window[np.isfinite(dst_window)]
    min_dst = float(np.min(dst_finite)) if dst_finite.size else float("nan")
    lines.extend(
        [
            "",
            "## Final vs quicklook Dst",
            "",
            f"Parsed OMNI minimum Dst on 2024-05-10 through 2024-05-11 is {min_dst:.1f} nT.",
            "docs/research/reference-values.md records the WDC Kyoto provisional value as −406 nT at 2024-05-11 02–03 UT, says it matches OMNI, and says the final index is not yet published. An early quicklook of −412 nT has been superseded (same file).",
            "The live SWPC product `kyoto-dst.json` is the quicklook series and covers about 7 days (docs/research/api-swpc.md). It is not the final index.",
            "",
            "## OMNI end vs the SWPC window",
            "",
            "Live inference uses recent lags from the SWPC and RTSW feeds (about 7 days in api-swpc.md). It does not need the multi-week OMNI lag.",
            "The test set ends at the last valid OMNI hour for the columns in use (ml-rules.md L1). That hour is the latest timestamp in the table above, per column.",
            "Training-table columns are By GSM, Bz GSM, speed, density, Kp, Dst, F10.7, and computed flow pressure, plus a missingness flag for each. F10.7 stays in the table because a live JSON source is CONFIRMED in api-swpc.md.",
            "",
            "## SEP labels",
            "",
        ]
    )
    sep_path = ROOT / "data" / "history" / "sep_events.csv"
    if sep_path.exists():
        import csv

        with sep_path.open(newline="") as handle:
            sep_rows = list(csv.DictReader(handle))
        first = sep_rows[0]["start_ut"] if sep_rows else "none"
        lines.append(f"`data/history/sep_events.csv` has {len(sep_rows)} data rows. First `start_ut` is {first}.")
    else:
        lines.append("`data/history/sep_events.csv` is not present.")

    lines.extend(["", "## GOES history", ""])
    history = sorted((ROOT / "data" / "history").glob("goes_*.parquet"))
    if not history:
        lines.append("No `data/history/goes_*.parquet` file is present.")
    for goes_path in history:
        goes = pq.read_table(goes_path)
        goes_time = goes.column("time").to_numpy()
        finite = goes_time[~np.isnat(goes_time)] if goes_time.size else goes_time
        if finite.size:
            span = f"{np.datetime_as_string(finite.min(), unit='m')} .. {np.datetime_as_string(finite.max(), unit='m')}"
        else:
            span = "none"
        lines.append(f"- `{goes_path.name}`: {goes.num_rows} rows, time span {span}.")
    lines.extend(
        [
            "",
            "May 2024 GOES-16 SGPS files parse. The L2 table in docs/research/data-sources.md records that those files do not store a ≥10 MeV integral. `AvgIntProtonFlux` is the P11 >500 MeV integral. Differential channel fluxes are stored with the file's lower-band energies.",
            "",
            "## CelesTrak snapshot",
            "",
        ]
    )
    satcat = ROOT / "data" / "snapshots" / "satcat_2022-010.json"
    if satcat.exists():
        satcat_rows = json.loads(satcat.read_text())
        count = len(satcat_rows) if isinstance(satcat_rows, list) else "not a list"
        lines.append(
            f"`jq length data/snapshots/satcat_2022-010.json` is {count}. "
            "docs/research/reference-values.md recorded 17 objects for this catalog query."
        )
    else:
        lines.append("`data/snapshots/satcat_2022-010.json` is not present.")
    lines.extend(
        [
            "",
            "## G-scale thirds",
            "",
            "G-level thresholds follow the NOAA table (G1 at Kp 5 through G5 at Kp 9). Thirds below an integer use a numeric threshold, so 4.67 is G0. That thirds choice is an estimate pending Aiden.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    paths = iter_raw_files()
    if not paths:
        print("no OMNI files in ml/data/raw", file=sys.stderr)
        sys.exit(1)
    rows = parse_files(paths)
    if not rows:
        print("no OMNI rows parsed", file=sys.stderr)
        sys.exit(1)
    table = rows_to_table(rows)
    write_parquet(table)
    print(f"rows {table.num_rows} -> {OUT_PATH}")
    if "--report" in sys.argv:
        write_data_report()
        print("wrote docs/research/data-report.md")


if __name__ == "__main__":
    main()
