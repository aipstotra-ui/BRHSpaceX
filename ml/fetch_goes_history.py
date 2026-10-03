"""Download and parse GOES proton and X-ray history.

URLs and formats are the M2 L2 table in docs/research/data-sources.md.
May 2024 must parse. If it does not, this script exits 2.
"""

from __future__ import annotations

import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import h5py
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "ml" / "data" / "raw" / "goes"
HISTORY_DIR = ROOT / "data" / "history"

EPOCH = np.datetime64("2000-01-01T12:00:00")
# Channel order quoted from the DiffProtonLowerEnergy long_name.
PROTON_CHANNELS = (
    "P1",
    "P2A",
    "P2B",
    "P3",
    "P4",
    "P5",
    "P6",
    "P7",
    "P8A",
    "P8B",
    "P8C",
    "P9",
    "P10",
)
HREF_RE = re.compile(r'href="([^"]+\.nc)"', re.IGNORECASE)

SGPS_DIRS = (
    (
        "https://data.ngdc.noaa.gov/platforms/solar-space-observing-satellites/goes/goes16/l2/data/sgps-l2-avg1m/2024/05/",
        HISTORY_DIR / "goes_protons_202405.parquet",
        True,
    ),
    (
        "https://data.ngdc.noaa.gov/platforms/solar-space-observing-satellites/goes/goes16/l2/data/sgps-l2-avg1m/2022/02/",
        HISTORY_DIR / "goes_protons_202202.parquet",
        False,
    ),
)
XRS_DIRS = (
    (
        "https://data.ngdc.noaa.gov/platforms/solar-space-observing-satellites/goes/goes16/l2/data/xrsf-l2-avg1m_science/2024/05/",
        HISTORY_DIR / "goes_xrays_202405.parquet",
        True,
    ),
    (
        "https://data.ngdc.noaa.gov/platforms/solar-space-observing-satellites/goes/goes16/l2/data/xrsf-l2-avg1m_science/2022/02/",
        HISTORY_DIR / "goes_xrays_202202.parquet",
        False,
    ),
)
CSV_PRODUCTS = (
    (
        "https://www.ncei.noaa.gov/data/goes-space-environment-monitor/access/avg/2003/10/goes10/csv/g10_eps_5m_20031001_20031031.csv",
        HISTORY_DIR / "goes_protons_200310.parquet",
        "p3_flux_ic",
        "p3_flux_ic",
        ">10 MeV",
        "goes10",
        True,
    ),
    (
        "https://www.ncei.noaa.gov/data/goes-space-environment-monitor/access/avg/2003/01/goes12/csv/g12_xrs_1m_20030101_20030131.csv",
        HISTORY_DIR / "goes_xrays_200301.parquet",
        "xl",
        "xl",
        "0.1-0.8nm",
        "goes12",
        False,
    ),
)


def fetch_bytes(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    tmp = dest.with_suffix(dest.suffix + ".partial")
    request = urllib.request.Request(url, headers={"User-Agent": "starmind-nav"})
    last_error: Exception | None = None
    for _attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                tmp.write_bytes(response.read())
            tmp.replace(dest)
            return dest
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(2)
    raise RuntimeError(f"download failed {url}: {last_error}")


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "starmind-nav"})
    last_error: Exception | None = None
    for _attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read().decode("utf-8", errors="replace")
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(2)
    raise RuntimeError(f"listing failed {url}: {last_error}")


def list_nc(directory_url: str) -> list[str]:
    html = fetch_text(directory_url)
    names = []
    for href in HREF_RE.findall(html):
        name = href.split("/")[-1].split("?")[0]
        if name.endswith(".nc"):
            names.append(name)
    return sorted(set(names))


def fill_mask(values: np.ndarray, fill: float) -> np.ndarray:
    data = values.astype("float64", copy=True)
    if np.isfinite(fill):
        data[np.abs(data - fill) <= max(1.0, abs(fill) * 1e-3)] = np.nan
    data[~np.isfinite(data)] = np.nan
    return data


def platform_text(value: object) -> str:
    raw = np.array(value).reshape(-1)[0]
    if isinstance(raw, bytes):
        return raw.decode()
    return str(raw)


def attr_fill(dataset: h5py.Dataset) -> float:
    raw = np.array(dataset.attrs["_FillValue"]).reshape(-1)
    return float(raw[0])


def seconds_to_time(seconds: np.ndarray, fill: float) -> np.ndarray:
    clean = seconds.astype("float64", copy=True)
    clean[np.abs(clean - fill) <= max(1.0, abs(fill) * 1e-3)] = np.nan
    whole = np.where(np.isfinite(clean), np.rint(clean), 0).astype("int64")
    stamps = EPOCH + whole.astype("timedelta64[s]")
    stamps[~np.isfinite(clean)] = np.datetime64("NaT")
    return stamps


def parse_sgps(path: Path) -> dict[str, np.ndarray]:
    with h5py.File(path, "r") as handle:
        if "time" in handle:
            time_ds = handle["time"]
        elif "L2_SciData_TimeStamp" in handle:
            time_ds = handle["L2_SciData_TimeStamp"]
        else:
            raise KeyError(f"no time variable in {path.name}")
        times = seconds_to_time(time_ds[:], attr_fill(time_ds))
        diff = handle["AvgDiffProtonFlux"]
        integral = handle["AvgIntProtonFlux"]
        diff_flux = fill_mask(diff[:], attr_fill(diff))
        int_flux = fill_mask(integral[:], attr_fill(integral))
        low = handle["DiffProtonLowerEnergy"]
        low_kev = fill_mask(low[:], attr_fill(low))
        int_energy = handle["IntegralProtonEffectiveEnergy"]
        int_kev = fill_mask(int_energy[:], attr_fill(int_energy))
        platform = platform_text(handle.attrs.get("platform", b"g16"))
    n_t, n_s, n_c = diff_flux.shape
    channels = [PROTON_CHANNELS[i] if i < len(PROTON_CHANNELS) else f"ch{i}" for i in range(n_c)]
    time_rep = np.repeat(times, n_s * n_c)
    sensor_rep = np.tile(np.repeat(np.arange(n_s), n_c), n_t)
    channel_rep = np.tile(np.array(channels, dtype=object), n_t * n_s)
    # DiffProtonLowerEnergy is (sensor, channel). C-order flux is (time, sensor, channel).
    energy_by_sensor = low_kev.reshape(n_s, n_c)
    energy_rep = np.tile(energy_by_sensor.reshape(-1), n_t)
    kind = np.array(["differential"] * (n_t * n_s * n_c), dtype=object)
    sat = np.array([str(platform)] * (n_t * n_s * n_c), dtype=object)

    n_ti, n_si = int_flux.shape
    int_time = np.repeat(times, n_si)
    int_sensor = np.tile(np.arange(n_si), n_ti)
    int_channel = np.array(["P11"] * (n_ti * n_si), dtype=object)
    int_energy_rep = np.tile(int_kev.reshape(-1), n_ti)
    int_kind = np.array(["integral_gt_500MeV"] * (n_ti * n_si), dtype=object)
    int_sat = np.array([str(platform)] * (n_ti * n_si), dtype=object)

    return {
        "time": np.concatenate([time_rep, int_time]),
        "satellite": np.concatenate([sat, int_sat]),
        "sensor": np.concatenate([sensor_rep, int_sensor]).astype("int16"),
        "channel": np.concatenate([channel_rep, int_channel]),
        "energy_low_kev": np.concatenate([energy_rep, int_energy_rep]),
        "flux": np.concatenate([diff_flux.reshape(-1), int_flux.reshape(-1)]),
        "flux_kind": np.concatenate([kind, int_kind]),
    }


def parse_xrs(path: Path) -> dict[str, np.ndarray]:
    with h5py.File(path, "r") as handle:
        time_ds = handle["time"]
        flux_ds = handle["xrsb_flux"]
        times = seconds_to_time(time_ds[:], attr_fill(time_ds))
        flux = fill_mask(flux_ds[:], attr_fill(flux_ds))
        platform = platform_text(handle.attrs.get("platform", b"g16"))
    n = flux.shape[0]
    return {
        "time": times,
        "satellite": np.array([str(platform)] * n, dtype=object),
        "band": np.array(["0.1-0.8nm"] * n, dtype=object),
        "flux": flux,
    }


def concat_frames(frames: list[dict[str, np.ndarray]]) -> dict[str, np.ndarray]:
    keys = frames[0].keys()
    return {key: np.concatenate([frame[key] for frame in frames]) for key in keys}


def write_frame(frame: dict[str, np.ndarray], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    arrays = []
    names = []
    for name, values in frame.items():
        names.append(name)
        if name == "time":
            arrays.append(pa.array(values, type=pa.timestamp("s")))
        elif name in {"flux", "energy_low_kev"}:
            arrays.append(pa.array(values.astype("float64"), type=pa.float64()))
        elif name == "sensor":
            arrays.append(pa.array(values.astype("int16"), type=pa.int16()))
        else:
            arrays.append(pa.array(values.astype(object)))
    table = pa.Table.from_arrays(arrays, names=names)
    pq.write_table(table, path, compression="snappy")
    if path.stat().st_size >= 90 * 1024 * 1024:
        path.unlink()
        raise RuntimeError(f"{path} reached 90 MB")


def parse_legacy_csv(text: str, column: str) -> tuple[np.ndarray, np.ndarray]:
    lines = text.splitlines()
    data_at = next(i for i, line in enumerate(lines) if line.strip() == "data:")
    header = [item.strip() for item in lines[data_at + 1].split(",")]
    index = header.index(column)
    times: list[np.datetime64] = []
    flux: list[float] = []
    for line in lines[data_at + 2 :]:
        if not line.strip() or line.startswith("#"):
            continue
        parts = [item.strip() for item in line.split(",")]
        if len(parts) <= index:
            continue
        try:
            stamp = np.datetime64(parts[0].replace(" ", "T"))
            value = float(parts[index])
        except ValueError:
            continue
        if value <= -99999:
            value = float("nan")
        times.append(stamp)
        flux.append(value)
    return np.array(times, dtype="datetime64[ms]"), np.array(flux, dtype="float64")


def write_legacy(url: str, dest: Path, column: str, channel: str, band: str, satellite: str) -> None:
    name = url.rsplit("/", 1)[-1]
    raw_path = fetch_bytes(url, RAW_DIR / name)
    times, flux = parse_legacy_csv(raw_path.read_text(errors="replace"), column)
    n = flux.shape[0]
    frame = {
        "time": times,
        "satellite": np.array([satellite] * n, dtype=object),
        "channel": np.array([channel] * n, dtype=object),
        "band": np.array([band] * n, dtype=object),
        "flux": flux,
    }
    write_frame(frame, dest)
    print(f"legacy rows {n} -> {dest}")


def download_month(directory_url: str) -> list[Path]:
    names = list_nc(directory_url)
    if not names:
        raise RuntimeError(f"no netCDF links at {directory_url}")
    paths: list[Path] = []

    def one(name: str) -> Path:
        return fetch_bytes(directory_url + name, RAW_DIR / name)

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(one, name) for name in names]
        for future in as_completed(futures):
            path = future.result()
            paths.append(path)
            print(f"got {path.name}", flush=True)
    return sorted(paths)


def build_sgps(directory_url: str, dest: Path) -> int:
    frames = [parse_sgps(path) for path in download_month(directory_url)]
    frame = concat_frames(frames)
    keep = ~np.isnat(frame["time"])
    frame = {key: values[keep] for key, values in frame.items()}
    finite = np.isfinite(frame["flux"])
    if not finite.any():
        raise RuntimeError(f"no finite proton flux from {directory_url}")
    write_frame(frame, dest)
    print(f"sgps rows {frame['flux'].shape[0]} -> {dest}")
    return int(finite.sum())


def build_xrs(directory_url: str, dest: Path) -> int:
    frames = [parse_xrs(path) for path in download_month(directory_url)]
    frame = concat_frames(frames)
    keep = ~np.isnat(frame["time"])
    frame = {key: values[keep] for key, values in frame.items()}
    finite = np.isfinite(frame["flux"])
    if not finite.any():
        raise RuntimeError(f"no finite X-ray flux from {directory_url}")
    write_frame(frame, dest)
    print(f"xrs rows {frame['flux'].shape[0]} -> {dest}")
    return int(finite.sum())


def may_2024_covers_storm(path: Path) -> bool:
    table = pq.read_table(path, columns=["time", "flux"])
    times = table.column("time").to_numpy()
    flux = table.column("flux").to_numpy()
    window = (times >= np.datetime64("2024-05-11T00:00:00")) & (times < np.datetime64("2024-05-12T00:00:00"))
    return bool(window.any() and np.isfinite(flux[window]).any())


def main() -> None:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    proton_ok = False
    try:
        for directory, dest, required in SGPS_DIRS:
            try:
                build_sgps(directory, dest)
                if required and not may_2024_covers_storm(dest):
                    raise RuntimeError("May 2024 proton file has no finite flux on 2024-05-11")
                if required:
                    proton_ok = True
            except Exception as error:  # noqa: BLE001
                print(f"sgps failed {directory}: {error}", file=sys.stderr)
                if required:
                    proton_ok = False
                    break
        for directory, dest, required in XRS_DIRS:
            try:
                build_xrs(directory, dest)
            except Exception as error:  # noqa: BLE001
                print(f"xrs failed {directory}: {error}", file=sys.stderr)
                if required:
                    raise
        for url, dest, column, channel, band, satellite, _required in CSV_PRODUCTS:
            try:
                write_legacy(url, dest, column, channel, band, satellite)
            except Exception as error:  # noqa: BLE001
                print(f"legacy failed {url}: {error}", file=sys.stderr)
    except Exception as error:  # noqa: BLE001
        print(f"GOES history failed: {error}", file=sys.stderr)
        proton_ok = False
    if not proton_ok:
        print("BLOCKER: no GOES proton history for replay", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
