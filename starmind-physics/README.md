# Starmind physics core

Hackathon physics package that ranks LEO compute-satellite configs inside SpaceX's filed envelope (500–2000 km, ~30° or sun-synchronous). It estimates **lifetime**, **mean power**, **radiator area**, and **shield mass** from orbit-averaged AE8/AP8 fluxes (`aep8`), a simple dose-depth model, SEU availability cost, solar-array degradation, Norris–Landzberg thermal cycling, and Stefan–Boltzmann radiator sizing.

This is a **ranking tool under stated assumptions**, not a prediction of Starmind / Nvidia Rubin flight lifetime. Every coefficient lives in [`starmind_physics/params.yaml`](starmind_physics/params.yaml) and is marked **[S]** sourced or **[A]** assumed.

Cesium / globe UI is intentionally out of scope here.

## Setup

Requires **Python ≥ 3.11**.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### `aep8` note

Orbit-averaged flux and SAA grids need [`aep8`](https://pypi.org/project/aep8/) (NASA AE8/AP8 via IRBEM) plus `astropy`. Orbit/eclipse unit tests run without it; flux/dose tests are marked `aep8` and skip if the package is missing:

```bash
pytest -m "not aep8"   # geometry only
pytest                 # full suite when aep8 is installed
```

## Quick evaluate

```python
from starmind_physics import evaluate

result = evaluate({
    "altitude_km": 800,
    "inclination": "sso",      # or 30
    "ltan_hours": 6.0,         # dawn SSO → near-zero eclipse
    "shield_mm_Al": 5.0,
    "chip_id": "nvidia_vera_rubin_nvl72",  # or chip_preset: commercial|rad_hard
    "radiator_area_m2": None,  # size from Stefan–Boltzmann
    "load_strategy": "constant",
})
print(result["lifetime_years"], result["mean_power_kW"],
      result["radiator_area_m2"], result["shield_mass_kg"])
print(result["limiting_mode"], result["breakdown"])
```

`lifetime_years = min(L_TID, L_thermal, L_power, L_SEU-availability)` (definition **[A]**).

## AI chip database

Candidate accelerators for Starmind-class payloads live in [`starmind_physics/data/ai_chips.yaml`](starmind_physics/data/ai_chips.yaml). Every dose/SEU number is labelled **sourced** or **assumed** — Rubin/Starmind radiation tolerance is **not** public; commercial rows without tests inherit the Trillium 2 krad(Si) HBM-onset analogue for ranking only.

```bash
starmind-chips                          # table
starmind-chips --format json -o ai_chips.json
starmind-chips --format sqlite -o ai_chips.sqlite
python -c "from starmind_physics import list_chips; print(len(list_chips()))"
```

`evaluate({"chip_id": "amd_instinct_mi300x", ...})` pulls that row’s dose limit and SEU knobs. Legacy `chip_preset="commercial"|"rad_hard"` aliases to Trillium / RAD750.

## Scripts

**Pareto search** (brute-force grid and/or NSGA-II via `pymoo`) → JSON:

```bash
starmind-optimize --method brute --n-per-dim 3 -o pareto_front.json
starmind-optimize --method nsga2 --n-gen 6 --pop-size 16 -o pareto_nsga2.json
# or: python -m starmind_physics.scripts.optimize --method both ...
```

Objectives: maximize lifetime & mean power, minimize `shield_mass_kg + radiator_area_m2` (**[A]** composite cost).

**South Atlantic Anomaly flux grid** (lat/lon integral flux at fixed altitude):

```bash
starmind-saa-grid --altitude-km 550 --particle p -o saa_flux_grid.json
```

## What is solid vs rough

| Piece | Status |
|---|---|
| SSO inclination, eclipse fraction, dawn-dusk ≈ 0 eclipse | Equations from plan sources; unit-tested |
| Orbit-averaged `aep8` proton/electron flux (`nanmean`) | Real AE8/AP8; crude 1-day spherical track **[A]** (no J2 RAAN drift) |
| TID behind shield | Exponential Al fallback **[A]** — not SHIELDOSE-2 |
| Chip dose limits | Presets: commercial 2 krad(Si) (Google Trillium HBM anchor **[S]**), rad-hard 200 krad(Si) (RAD750 **[S]**). Not public Rubin data |
| SEU | Flux-scaled availability cost **[A]** |
| Array degradation | Linear dose proxy **[A]** — not full JPL EQFLUX curve |
| Thermal fatigue | Norris–Landzberg with solder `n` **[S]**; `N_ref`, `ΔT` **[A]** |
| Radiator | Stefan–Boltzmann with assumed ε, T **[A]** |

## Layout

```
starmind_physics/
  params.yaml      # every assumed/sourced physics number
  data/ai_chips.yaml  # candidate AI / rad-hard chip catalogue
  chips.py         # load / query / export chip DB
  evaluate.py      # evaluate(config)
  orbit.py         # SSO, beta, eclipse
  flux.py          # aep8 orbit average + lat/lon grid
  dose.py          # TID + SEU
  thermal.py       # Norris–Landzberg + radiator + shield mass
  power.py         # array power / degradation
  scripts/         # optimize, saa_grid, chips_db
tests/
```
