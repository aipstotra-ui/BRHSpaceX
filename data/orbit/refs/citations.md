# Orbit references

Citations only. No table was copied out of a paywalled or figure-only source.

- WGS 84 μ and equatorial radius: https://earth-info.nga.mil/index.php?action=wgs84&dir=wgs84
- J2geo: https://w3.uch.edu.tw/ccchang50/NGA.STND.0036_1.0.0_WGS84.pdf
- SSO rate and 700 km inclination: https://science.nasa.gov/wp-content/uploads/2023/05/GDC_OrbitPrimer.pdf
- 800 km inclination: https://ntrs.nasa.gov/api/citations/19930015517/downloads/19930015517.pdf
- Vallado algorithm 34 geometry: https://raw.githubusercontent.com/poliastro/vallado-software/master/matlab/shadow.m
- Auroral zone and outer belt: https://ntrs.nasa.gov/api/citations/19750014908/downloads/19750014908.pdf
- Auroral oval glossary: http://www.spaceweather.gov/content/space-weather-glossary
- pymsis 2.0: https://swxtrec.github.io/pymsis/reference/generated/pymsis.calculate.html
- 750 rad(Si) anchor: https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/
- NOAA G-scale: https://www.spaceweather.gov/noaa-scales-explanation
- Starlink GP snapshot already in the repo: `data/snapshots/celestrak_gp.json`
- Dose grid: no numeric SPENVIS table was available. `data/orbit/dose_table.json` is the estimate fallback.
- Globe SAA map: AP8MIN >10 MeV integral proton flux from IRBEM (SpacePy 0.7.0), B and L from IGRF at 2025.0, built by
  `scripts/orbit/saa_map.py` into `data/orbit/proton_flux_map.json` (300–2000 km). The globe and the chip outlook's SAA
  fraction both use it. The 10 /cm²/s edge is a display choice checked
  against the Fermi GBM SAA polygon: https://raw.githubusercontent.com/USRA-STI/gdt-fermi/main/src/gdt/missions/fermi/gbm/saa.py
