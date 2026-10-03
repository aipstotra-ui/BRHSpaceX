"""NOAA G-scale from Kp.

Thresholds are the NOAA table in docs/research/reference-values.md:
G1 = Kp 5, G2 = 6, G3 = 7, G4 = 8, G5 = 9.
Source: https://www.spaceweather.gov/noaa-scales-explanation

The default thirds mode is an estimate pending Aiden: a numeric threshold,
so 5- (4.67) is below 5 and returns G0.
"""

from __future__ import annotations

# estimate: thirds below an integer do not reach that integer's G-level.
DEFAULT_THIRDS = "numeric-threshold"

# level, minimum Kp. Source: NOAA scales table.
_G_LEVELS = (
    (5, 9),
    (4, 8),
    (3, 7),
    (2, 6),
    (1, 5),
)


def gscale(kp: float, thirds: str = DEFAULT_THIRDS) -> str:
    if thirds != DEFAULT_THIRDS:
        raise ValueError("unsupported thirds mode")
    if kp != kp:
        return "G0"
    for level, minimum in _G_LEVELS:
        if kp >= minimum:
            return f"G{level}"
    return "G0"
