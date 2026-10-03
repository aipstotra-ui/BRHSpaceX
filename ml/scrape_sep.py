"""Fetch the NCEI SEP event table and write data/history/sep_events.csv.

URL from docs/research/data-sources.md. HTML cells contain newlines; whitespace
inside each cell is collapsed before the timestamp is read.
"""

from __future__ import annotations

import csv
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data" / "history" / "sep_events.csv"
SEP_URL = "https://www.ngdc.noaa.gov/stp/space-weather/interplanetary-data/solar-proton-events/SEP%20page%20code.html"

FIELDS = ("start_ut", "max_ut", "peak_pfu", "flare", "region")
_ROW_RE = re.compile(r"<tr\b[\s\S]*?</tr>", re.IGNORECASE)
_CELL_RE = re.compile(r"<td\b[\s\S]*?</td>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_WHEN_RE = re.compile(r"(\d{4})\s+(\d{1,2})/(\d{1,2})(?:\s+(\d{3,4}))?")


def cell_text(cell: str) -> str:
    text = _TAG_RE.sub(" ", cell)
    return re.sub(r"\s+", " ", text).strip()


def parse_ut(text: str) -> str:
    match = _WHEN_RE.search(text)
    if match is None:
        return text
    year, month, day, hm = match.groups()
    stamp = f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    if hm:
        hm = hm.zfill(4)
        stamp = f"{stamp} {hm[:2]}:{hm[2:]}"
    return stamp


def parse_sep_html(html: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for row_html in _ROW_RE.findall(html):
        cells = [cell_text(cell) for cell in _CELL_RE.findall(row_html)]
        if len(cells) < 6:
            continue
        rows.append(
            {
                "start_ut": parse_ut(cells[0]),
                "max_ut": parse_ut(cells[1]),
                "peak_pfu": cells[2],
                "region": cells[3],
                "flare": cells[5],
            }
        )
    return rows


def fetch_sep_html(url: str = SEP_URL) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "starmind-nav"})
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read()
            return raw.decode("cp1252", errors="replace")
        except Exception as error:  # noqa: BLE001 — retry network failures
            last_error = error
            time.sleep(2)
    raise RuntimeError(f"SEP fetch failed: {last_error}")


def write_sep_csv(rows: list[dict[str, str]], path: Path = OUT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rows = parse_sep_html(fetch_sep_html())
    if not rows:
        print("SEP table parsed zero rows", file=sys.stderr)
        sys.exit(1)
    write_sep_csv(rows)
    print(f"SEP rows {len(rows)} -> {OUT_PATH}")


if __name__ == "__main__":
    main()
