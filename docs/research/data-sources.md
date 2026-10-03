### A4 → `docs/research/data-sources.md`

**OMNI2 hourly** [Researchy B12–B15]
- URLs: https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni/omni2_YYYY.dat (1963→now, ~2.9 MB/yr). The all-years file is 184 MB [SWE (b)5]. Format doc: https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni/omni2.text
- Layout: 55 whitespace fields. Word numbers are 1-based, so subtract 1 for the index.

| Word (1-based) | Index (0-based) | Content | Fill |
|---|---|---|---|
| 39 | 38 | Kp×10, in thirds (33 = 3+, 37 = 4−, 40 = 4) | 99 |
| 40 | 39 | sunspot R | n/a |
| 41 | 40 | Dst, nT | 99999 |
| 46 | 45 | >10 MeV protons | 99999.99. Fill after 2020-03-04, so **not used** |
| 51 | 50 | F10.7 | 999.9 |

- Other fills: Bz 999.9, V 9999. The rest are mapped in M2 from `omni2.text`.
- Kp conversion: `Kp = round(x*3/10)/3`.
- Coverage: IMF Bz 7% (1963), 40% (1965), 57% (1970), 99% (1995).
- Latest non-fill as of Oct 3 2026: Dst 2026-09-17 12 UT, Kp 2026-09-16, solar wind 2026-09-13 (a lag of ~2.5 weeks).

**Other sources**
- **SEP labels:** the NCEI SEP table, https://www.ngdc.noaa.gov/stp/space-weather/interplanetary-data/solar-proton-events/SEP%20page%20code.html (319 events, 1976-04-30 → 2026-07-30, as of Oct 3). The HTML cells contain newlines. [B16]
  - Not used: https://umbra.nascom.nasa.gov/SEP/ (ends Sep 2017) and https://ftp.swpc.noaa.gov/pub/indices/SPE.txt (unreachable). [B16–B17]
- **GOES archives:** https://www.ncei.noaa.gov/products/goes-r-space-environment-in-situ , https://www.ncei.noaa.gov/products/goes-1-15/space-weather-instruments , and https://www.swpc.noaa.gov/products/goes-proton-flux . File formats are UNVERIFIED (resolved at M2 L2). [B18]
- **GFZ definitive Kp JSON:** `https://kp.gfz.de/app/json/?start=<ISO>&end=<ISO>&index=Kp`. It has exact thirds (5.333). The response shape is resolved at M2 L2. [N19, N21, Imp-4]
- **WDC Kyoto provisional Dst:** https://wdc.kugi.kyoto-u.ac.jp/dst_provisional/202405/index.html [N22]
- **CelesTrak** (flaky, so snapshot everything) [B20–B22]:
  - GP: https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json
  - Supplemental GP: https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json
  - SATCAT: https://celestrak.org/satcat/records.php?GROUP=starlink&FORMAT=json , https://celestrak.org/pub/satcat.csv (has `DECAY_DATE`), and https://celestrak.org/satcat/records.php?INTDES=2022-010&FORMAT=json
- **Spacecraft anomalies:** https://www.ncei.noaa.gov/products/satellite-anomalies holds legacy content only. **Not a label source.** [B19]
- **NOAA scales:** https://www.spaceweather.gov/noaa-scales-explanation
