"""Fetch GFZ definitive Kp JSON for the May 2024 and February 2022 windows.

Shape and URL are in docs/research/data-sources.md.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "snapshots"

WINDOWS = (
    (
        "2024-05-10T00:00:00Z",
        "2024-05-11T23:59:59Z",
        OUT_DIR / "gfz_kp_2024-05.json",
    ),
    (
        "2022-02-02T00:00:00Z",
        "2022-02-04T23:59:59Z",
        OUT_DIR / "gfz_kp_2022-02.json",
    ),
)


def fetch_kp(start: str, end: str) -> dict[str, object]:
    url = f"https://kp.gfz.de/app/json/?start={start}&end={end}&index=Kp"
    request = urllib.request.Request(url, headers={"User-Agent": "starmind-nav"})
    last_error: Exception | None = None
    for _attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.load(response)
            if not isinstance(payload, dict) or "Kp" not in payload or "datetime" not in payload:
                raise ValueError("GFZ JSON missing Kp or datetime")
            return payload
        except Exception as error:  # noqa: BLE001
            last_error = error
            time.sleep(2)
    raise RuntimeError(f"GFZ fetch failed: {last_error}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for start, end, path in WINDOWS:
        payload = fetch_kp(start, end)
        path.write_text(json.dumps(payload), encoding="utf-8")
        print(f"wrote {path}")
    if any(not path.exists() for _start, _end, path in WINDOWS):
        sys.exit(1)


if __name__ == "__main__":
    main()
