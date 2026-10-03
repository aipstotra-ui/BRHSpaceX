### A8 → `docs/research/engine-constants.md` (seed; M4 and M5 L2 add the rest)

**Radiator area** [Researchy N16 redo]
- Formula: A = P / (n·ε·σ·(T⁴ − Tsink⁴)).
- Constants:
  - σ = 5.670374e-8 W m⁻² K⁻⁴
  - ε = 0.9 (`estimate`, v1 assumption)
  - Tsink 200 K (`estimate`, v1 assumption), with 0 K as an alternative
  - n = 2 means both faces radiate
- Lower bound: the formula ignores absorbed sunlight, albedo and Earth IR, fin efficiency and the coolant ΔT. It also uses compute power, which isn't total bus heat.

Researchy table, ε 0.9 (m²):

| P (kW) | 2-sided, Tsink 200 K: 300 / 320 / 340 K | 2-sided, Tsink 0 K: 320 / 340 K | 1-sided, Tsink 200 K: 320 / 340 K |
|---|---|---|---|
| 120 | 180.9 / 132.3 / 99.9 | 112.1 / 88.0 | 264.6 / 199.9 |
| 150 | 226.1 / 165.4 / 124.9 | 140.2 / 110.0 | 330.8 / 249.9 |
| 175 | 263.8 / 193.0 / 145.8 | 163.5 / 128.3 | 385.9 / 291.5 |
| 210 | 316.5 / 231.5 / 174.9 | 196.2 / 154.0 | 463.1 / 349.8 |
| 250 | 376.8 / 275.7 / 208.2 | 233.6 / 183.3 | 551.3 / 416.4 |

What the table shows:
- Back-solving SpaceX's own pairs (175 kW / 160 m² and 120 kW / 110 m²) gives ≈1.09 kW/m². That implies ≈333 K (2-sided, Tsink 200 K), ≈322 K (2-sided, Tsink 0 K), or ≈383 K (1-sided, Tsink 0 K).
- The 320–340 K band contains 160 m² **only for a 2-sided radiator**. The v1 band for 150–175 kW recomputes to 124.9–193.0 m².
- 250 kW peak can't be rejected by 160 m² in steady state, so peaks must be buffered or short.

**Dose and TID anchors** (https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/) [R7–R9]
- Shielded 5-yr LEO dose: 750 rad(Si).
- HBM first irregularities: 2 krad(Si), the first-anomaly point, not failure.
- No hard TID failure up to 15 krad(Si), from n = 1 chip.

### M4 L2 researcher

TARGET: docs/research/engine-constants.md

| Item | Value | Unit | Source URL | Accessed | Status | Note |
|---|---|---|---|---|---|---|
| SAA trapped-proton flux, quiet example | 399.5 | protons/cm2/s/sr | https://agupubs.onlinelibrary.wiley.com/doi/10.1002/2015JA021312 | 2026-10-03 | CONFIRMED | Zou et al., JGR Space Physics, 2015, doi 10.1002/2015JA021312. NOAA-17 MEPED, >70 MeV, altitude ~840 km (NOAA-16 is ~40 km higher and is not this number). maxSAA for 20 Oct 2004 from the 18–22 Oct 2004 5-day set. Quiet: daily Dst > −15 nT and Kp < 2.5. Data cut L<2. Omnidirectional detector; unit as printed. |
| Fermi GBM SAA polygon | lat −30.000, −19.867, −9.733, 0.400, 2.000, 2.000, −1.000, −6.155, −8.880, −14.220, −18.404, −30.000, −30.000; east lon 33.900, 12.398, −9.103, −30.605, −38.400, −45.000, −65.000, −84.000, −89.200, −94.300, −94.300, −86.100, 33.900 | degree | https://raw.githubusercontent.com/USRA-STI/gdt-fermi/main/src/gdt/missions/fermi/gbm/saa.py | 2026-10-03 | CONFIRMED | NASA/USRA GbmSaaPolygon5, closed ring, latitude and East longitude. Same vertices as GbmSaaPolygon15, in use from 19:20:45 UTC on 30 Sep 2024. Operational GBM boundary, not a proton-flux contour. Same coordinate list is in NASA FSSC gbm.coords.saa_boundary: https://fermi.gsfc.nasa.gov/ssc/data/analysis/gbm/gbm_data_tools/gdt-docs/_modules/gbm/coords.html |
| Dipole L-shell equation | R = L cos^2(Lambda) | n/a | https://www.spenvis.oma.be/help/background/magfield/rlambda.html | 2026-10-03 | CONFIRMED | SPENVIS equation (5), citing McIlwain, JGR, 66, 3681–3691, 1961. Lambda is magnetic latitude. R is distance to the dipole centre. L is the field line's equatorial radial distance. Same units for R and L. SPENVIS says this dipole definition is not the real-field L, which uses adiabatic invariant I. Do not invent a different formula. |
| SEP storm scale, higher-inclined LEO, Dst = −210 nT | SEU rates +19%; accumulated absorbed dose +17% versus quiet | percent | https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2023SW003664 | 2026-10-03 | CONFIRMED | Girgis et al., Space Weather, 2023, doi 10.1029/2023SW003664. Paper's PLEO is inclination 98° at about 650 km. Quiet case is Dst = −7 nT. Solar protons 70–180 MeV. SEU maps in the body use 110 MeV protons and 1 g/cm2 Al. Case result, not a general multiplier. |
| SEP storm scale, lower-inclined LEO, Dst = −150 nT | accumulated dose can reach +16%; excess SEU can reach +11% versus quiet | percent | https://catalog.lib.kyushu-u.ac.jp/opac_download_md/7330310/7330310.pdf | 2026-10-03 | CONFIRMED | Same paper, conclusion. Paper's lower-inclined case is 51°, which it labels NPLEO, altitude about 650 km. Body also states the 98° orbit accumulated dose increased by 9% at Dst = −150 nT and by 17% at Dst = −210 nT. |
| Trapped SAA >70 MeV storm change | maxSAA decreased about 16.4%, from 399.5 to 333.9 | protons/cm2/s/sr | https://agupubs.onlinelibrary.wiley.com/doi/10.1002/2015JA021312 | 2026-10-03 | CONFIRMED | Zou et al. 2015. NOAA-17, 9 Nov 2004 storm, same >70 MeV channel and ~840 km. areaSAA decreased about 6.6%. This is a trapped-flux decrease, not the SEP-access increase in Girgis. |
| General Kp, Dst, or GOES proton-flux upset multiplier | n/a | n/a | https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2023SW003664 | 2026-10-03 | UNVERIFIED | No published single multiplier versus Kp or GOES proton flux was found. The Dst percents above are case results for SEP access at two inclinations. The milestone must label any other multiplier `estimate`. |

BLOCKING: no

