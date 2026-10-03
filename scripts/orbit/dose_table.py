"""Dose table builder.

L2(b) found no numeric SPENVIS grid. This file records that fact and the
750 rad(Si) / 5 yr anchor. It does not invent a dose-versus-altitude table.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "orbit" / "dose_table.json"

ANCHOR_URL = "https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/"


def build() -> dict:
    return {
        "mode": "estimate",
        "phrase": "no reference: estimate",
        "anchorFiveYearRadSi": 750,
        "anchorAnnualKradSi": 0.15,
        "anchorSourceUrl": ANCHOR_URL,
        "anchorOrbit": "UNVERIFIED",
        "rows": [],
        "notes": [
            "No numeric SPENVIS dose grid was printed in the opened sources.",
            "0.15 krad(Si)/yr is 750 rad(Si) divided by five years.",
            "The orbit behind the 750 rad(Si) sentence is UNVERIFIED.",
            "Annual dose elsewhere scales the anchor by SAA fraction. Shielding depth is not applied.",
        ],
    }


def check(table: dict) -> int:
    if table.get("mode") == "estimate" or not table.get("rows"):
        print("no reference: estimate")
        print("leave-one-out is not computed because there are no reference rows")
        return 0
    print("reference rows present")
    for row in table["rows"]:
        print(
            f"alt {row['altitudeKm']} inc {row['inclinationDeg']} "
            f"reference {row['reference']} model {row['model']}"
        )
    return 0


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    table = build()
    if "--check" in sys.argv:
        if OUT.exists():
            table = json.loads(OUT.read_text())
        raise SystemExit(check(table))
    OUT.write_text(json.dumps(table, indent=2) + "\n")
    print(f"wrote {OUT}")
    check(table)


if __name__ == "__main__":
    main()
