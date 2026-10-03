### A3 → `docs/research/api-swpc.md` (SWPC + DONKI) [Researchy B1–B11]
Every SWPC file is an **array of objects**, no key needed.

| Feed | URL | Shape / notes |
|---|---|---|
| Kp | https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json | `{time_tag,Kp,a_running,station_count}`, ~7 days |
| Kp 1-min | https://services.swpc.noaa.gov/json/planetary_k_index_1m.json | `{time_tag,kp_index,estimated_kp,kp}` |
| Kp forecast | https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json | `{time_tag,kp,observed,noaa_scale}`. Use `observed=="predicted"` |
| 3-day forecast | https://services.swpc.noaa.gov/text/3-day-forecast.txt | fixed-width text |
| Scales | https://services.swpc.noaa.gov/products/noaa-scales.json | keys "0","1",… with R/S/G |
| GOES protons | https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json , https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json | `{time_tag,satellite,flux,energy:">=10 MeV"…}` |
| GOES X-rays | https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json | use `energy=="0.1-0.8nm"` |
| Solar wind | https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json | newest-first. SOLAR1/ACE/IMAP mixed. Filter `active===true`. Field names: L2 in M2 |
| IMF | https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json | `bz_gsm`. Filter `active===true` |
| Dst | https://services.swpc.noaa.gov/products/kyoto-dst.json | `{time_tag,dst}`, ~7 days, quicklook |
| Aurora | https://services.swpc.noaa.gov/json/ovation_aurora_latest.json | `coordinates:[lon,lat,aurora]` |
| F10.7 (live) | UNVERIFIED (resolved at M2 L2) | n/a |

DONKI:
- Base: `https://ccmc.gsfc.nasa.gov/DONKI-API/get/{GST|FLR|CME|SEP}?startDate=&endDate=`. This base dates from the CCMC change of Sep 30 2026 (https://ccmc.gsfc.nasa.gov/news/major-updates/ , https://ccmc.gsfc.nasa.gov/tools/DONKI/).
- Never use `kauai.ccmc...` URLs.
- SEP rows include MODEL rows, so filter `instruments[].displayName` containing "GOES".
