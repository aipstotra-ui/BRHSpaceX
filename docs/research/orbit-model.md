### A11 → `docs/research/orbit-model.md` (seed; M5, M7 and M9 L2 add sourced rows)
- **Aim.** Find the orbit ("location") for Starmind that minimizes impact on the chosen chip and maximizes lifetime. A location is a circular orbit: altitude, inclination, and for SSO the LTAN.
- **AI1 facts** (from A1):
  - The orbit is sun-synchronous (official).
  - No AI1 altitude is published. Any default altitude is an assumption supplied by Aiden in M5.
  - 500–2,000 km is the FCC constellation filing range and is labeled that way.
- **SSO.** The inclination follows from the altitude through the J2 nodal-precession condition. μ, R_E, J2 and the required precession rate are sourced at M5 L2(a). LTAN presets: dawn-dusk = 06:00/18:00 and noon-midnight = 12:00/00:00 (definitions).
- **Orbit-averaged environment (M5).**
  - SAA and auroral/outer-belt exposure fractions
  - eclipse fraction (sun position + shadow model, sourced at L2(d))
  - density from a pymsis-precomputed table (L2(c))
  - dose from a cited dose-vs-altitude/inclination table (L2(b)), else an `estimate` scaled from the 750 rad(Si)/5-yr anchor
- **Lifetime.**
  - time-to-TID = TID limit ÷ annual dose
  - drag-decay time from da/dt = −ρ·(Cd·A/m)·√(μ·a) down to an end-of-life altitude
  - lifetime = the min of the two, with the binding limit named
  - AI1 mass, drag area, Cd and end-of-life altitude: `UNVERIFIED` until sourced; otherwise user inputs labeled `estimate`
  - Candidate *derived* solar-array area: 210 kW ÷ 250 W/m² = 840 m², from the spacex.com sheet. The reading is confirmed at M5 L2(f).
- **Long-range vs short-term (rule).** Long-range orbit choice (optimizer, multi-year lifetime) uses **climatology**: storm frequency by size across the OMNI history and solar-cycle phase (M7). It **never** uses the short-term forecaster. The short-term forecaster drives Best Move, the replays and scenarios.
- **Transfer (M7).** Coplanar Hohmann between circular radii r1 → r2:
  - Δv1 = √(μ/r1)·(√(2r2/(r1+r2)) − 1)
  - Δv2 = √(μ/r2)·(1 − √(2r1/(r1+r2)))
  - Plane change, LTAN change and drag are ignored. The animation is labeled ILLUSTRATIVE and isn't a maneuver plan.
- **Scenario (M9) rules.**
  - Outputs are labeled SCENARIO.
  - Input bounds are the observed extremes in OMNI (1995+) and the DONKI CME history (`data/scenario/ranges.json`).
  - CME → L1 translation per M9 L2(c), else the direct step profile labeled `estimate`.

### M5 L2 researcher

TARGET: docs/research/orbit-model.md

| Item | Value | Unit | Source URL | Accessed | Status | Note |
|---|---|---|---|---|---|---|
| Dose vs altitude and inclination, circular LEO, Al shield, AP8/AE8 + SHIELDOSE-2 | no numeric table printed | n/a | https://digitalcommons.usu.edu/cgi/viewcontent.cgi?article=5938&context=smallsat | 2026-10-03 | UNVERIFIED | Janson, SSC24-XI-03, describes SPENVIS curves for 300–1000 km at 0, 30, 51.6, 60, and 90 deg, AP-8 and AE-8 at solar maximum, SHIELDOSE-2 at the center of an Al sphere, for 1 mm and for 16 μm. The dose numbers are in the figures and are not printed. No opened URL contains the numeric grid, solar min and solar max, and shield depths together. A SPENVIS run is required for that table. |
| Suncatcher shielded 5-year LEO dose | 750 | rad(Si) | https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/ | 2026-10-03 | CONFIRMED | Blog, 4 Nov 2025: “expected (shielded) five year mission dose of 750 rad(Si)”. Shield depth is not printed. |
| Orbit behind the 750 rad(Si) anchor | not stated | n/a | https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/ | 2026-10-03 | UNVERIFIED | The dose sentence does not give altitude or inclination. Elsewhere the blog says the constellation is likely a dawn–dusk sun-synchronous LEO, and an illustrative 81-satellite cluster has a mean altitude of 650 km. No inclination is printed, and 650 km is not tied to the 750 rad sentence. |
| pymsis library | 0.12.0 | n/a | https://swxtrec.github.io/pymsis/ | 2026-10-03 | CONFIRMED | Docs title: pymsis 0.12.0, a wrapper of MSISE-00, MSIS2.0, and MSIS2.1. NRLMSIS 2.0 paper cited there: Emmert et al. 2020, doi 10.1029/2020EA001321. No density value is taken from this page. |
| NRLMSIS 2.0 selection in pymsis | version=2.0 | n/a | https://swxtrec.github.io/pymsis/reference/generated/pymsis.calculate.html | 2026-10-03 | CONFIRMED | `calculate(..., version=)` accepts 0, 2.0, or 2.1. The documented default is 2.1, which is NRLMSIS 2.1. NRLMSIS 2.0 is the explicit value 2.0. |
| pymsis required inputs | dates; lons; lats; alts; f107s; f107as; aps | deg; deg; km; sfu; sfu; Ap | https://swxtrec.github.io/pymsis/reference/generated/pymsis.calculate.html | 2026-10-03 | CONFIRMED | Geodetic lon/lat/alt on WGS84. f107s is the previous day’s F10.7. f107as is the 81-day average centered on the date. aps[0] is daily Ap. aps[1] through aps[6] are used only when geomagnetic_activity=−1: current 3 h ap, then 3 h, 6 h, and 9 h before, then the 12–33 h average and the 36–57 h average. F10.7 is at the Sun–Earth distance, not at 1 AU. If F10.7, F10.7a, or Ap are omitted, the library uses downloaded history. No density number is stated. |
| Solar-position algorithm | Jean Meeus, Astronomical Algorithms | n/a | https://gml.noaa.gov/grad/solcalc/calcdetails.html | 2026-10-03 | CONFIRMED | NOAA GML: the Solar Position Calculator “is based on equations from Astronomical Algorithms, by Jean Meeus.” The page names the book and does not reprint the equations. |
| Eclipse shadow model | conical umbra and penumbra, Vallado algorithm 34 | n/a | https://raw.githubusercontent.com/poliastro/vallado-software/master/matlab/shadow.m | 2026-10-03 | CONFIRMED | The file labels algorithm 34. Printed geometry: rs = 696000 km, re = 6378.1363 km, au = 149597870 km; angumb = atan((rs−re)/au); angpen = atan((rs+re)/au). Behind the Sun (dot(reci, rsun) < 0), penumbra when the perpendicular distance is within the penumbra cone, umbra when it is within the umbra cone. This is conical, not cylindrical. |
| L beyond the dipole equation | I = ∫_A^A' sqrt(1 − B(s)/B_m) ds; L_m from the dipole (L_m, B_m, I) relation applied to a non-dipole field | n/a | https://space-env.esa.int/Manuals/UNILIB/v3.02/faq/faq-g08.html | 2026-10-03 | CONFIRMED | UNILIB, quoting Lemaire et al. 1995. McIlwain 1961. L_m is a drift-shell label, not a replacement for M4’s dipole L = R / cos^2(Lambda). The page also prints B_0 = 0.311653 L_m^(−3), with 0.311653 the geomagnetic moment in McIlwain’s software. Hilton 1971 is named; its polynomial is not printed. |
| Auroral oval, average conditions | about 75 at local noon to about 67 at midnight | degree magnetic latitude | http://www.spaceweather.gov/content/space-weather-glossary | 2026-10-03 | CONFIRMED | NOAA SWPC glossary, “auroral oval”. Elliptical band around each geomagnetic pole. It widens to higher and lower latitudes in the expansion phase of a substorm. |
| Auroral zone | about 60 to 80 | degree latitude | https://ntrs.nasa.gov/api/citations/19750014908/downloads/19750014908.pdf | 2026-10-03 | CONFIRMED | NASA SP-8116, March 1975, §2.1.2.6: the auroral zone “lies between about 60 and 80° latitude.” The sentence does not say geomagnetic. |
| Outer radiation belt | L = 3.0 to 8.0 | Earth radii | https://ntrs.nasa.gov/api/citations/19750014908/downloads/19750014908.pdf | 2026-10-03 | CONFIRMED | NASA SP-8116: outer belt from L = 3.0 to L = 8.0. Same paragraph: inner belt roughly L = 1.2 to 2.5. L is the equatorial crossing distance of the field line. NOAA’s glossary does not print this L band. |
| AI1 mass | not published | kg | https://www.spacex.com/spacexai/starmind | 2026-10-03 | UNVERIFIED | Page module 7083.2b7745f5bcfb7d6d.js prints vehicle efficiency “75 kW / ton” and does not print a mass. No substitute mass is used. Heise and the SCN sheet comparison also do not print a mass. |
| AI1 drag area or ballistic coefficient | not published | m^2 or kg/m^2 | https://www.spacex.com/spacexai/starmind | 2026-10-03 | UNVERIFIED | No drag area and no ballistic coefficient on the page or in the opened secondary sheets. |
| AI1 drag coefficient Cd | not published | 1 | https://www.spacex.com/spacexai/starmind | 2026-10-03 | UNVERIFIED | No Cd is printed. |
| AI1 reentry or end-of-life altitude | not published | km | https://www.spacex.com/spacexai/starmind | 2026-10-03 | UNVERIFIED | No end-of-life or reentry altitude is printed. The page says sun-synchronous and does not print an altitude. |
| Solar-array area reading, 840 m^2 | 210 kW ÷ 250 W/m^2 = 840 | m^2 | https://www.spacex.com/spacexai/starmind | 2026-10-03 | CONFIRMED | Derived reading of two printed Solar-tab values: “Solar Array” 210 kW and “Solar Power Density” 250 W/m². The page does not print 840 m² or any other array area. Wingspan 75 m is not an area. 840 m² is not a drag area. Heise prints a different sheet, 150 kW at 250 W/m², and does not print 840 m². |

BLOCKING: no

### M5 estimates recorded with the build

These are not in the L2 tables. Each one is an `estimate`.

- SSO test tolerance: 0.05°. Residuals of the J2-only inclination against the two L2(g) references are reported by the unit test.
- Propagation step: 72 samples per orbit. Averaging window: 24 Earth-rotation phases, one orbit each. Annual eclipse sample: 12 ecliptic longitudes.
- Shell grouping, applied to `data/snapshots/celestrak_gp.json`: round inclination to 0.1°, 1 km altitude bins, ignore bins under 20 objects, split a shell when dense bins are more than 3 km apart. Altitude uses two-body mean motion with the sourced μ and equatorial R_E. The resulting mean is the demo orbit. It is not an AI1 altitude.
- Obliquity 23.439° and Earth rotation 7.2921150×10^−5 rad/s. The NOAA page names Meeus and does not print the equations, so the sun direction is this labeled estimate plus the sourced 0.9856 deg/day rate.
- Density grid: altitude 100–2000 km step 25 km; F10.7 70, 100, 150, 200, 250; Ap 4, 15, 40, 80. Fixed date 2020-06-21, latitude 0, longitude 0, F10.7a set equal to F10.7, and all seven Ap slots set to the daily Ap.
- Vehicle inputs, because AI1 mass, drag area, Cd, and end-of-life altitude are unpublished: mass 1000 kg, drag area 10 m², Cd 2.2, end-of-life altitude 120 km. These are not Starlink values. The 840 m² figure is the confirmed solar-array reading and is not a drag area.
- Non-SSO RAAN 0°. No LTAN is taken from the Starlink snapshot.
- Dose has no SPENVIS table. Annual dose is the 750 rad(Si)/5 yr anchor scaled by SAA fraction. The anchor orbit is UNVERIFIED, so every dose and TID lifetime stays an `estimate`.
