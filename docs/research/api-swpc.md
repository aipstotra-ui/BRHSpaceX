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

TARGET: docs/research/api-swpc.md
| Item | Value | Unit | Source URL | Accessed | Status | Note |
|---|---|---|---|---|---|---|
| Live F10.7 JSON | `https://services.swpc.noaa.gov/json/f107_cm_flux.json`. Body is a JSON array of objects. Keys: `time_tag` (string), `frequency` (number; `2800` on all 124 objects), `flux` (number), `reporting_schedule` (string), `avg_begin_date` (string or null), `ninety_day_mean` (number or null), `rec_count` (number or null). Newest `time_tag` first. Opened 2026-10-03: 124 objects, dates `2026-08-23` through `2026-10-03`. `reporting_schedule` hours: Morning `17:00` (42), Noon `20:00` (41), Afternoon `22:00` (41). 41 dates have 3 objects; `2026-10-03` has only Morning. Noon objects carry `ninety_day_mean` and `rec_count` `90`; Morning and Afternoon leave `avg_begin_date`, `ninety_day_mean`, and `rec_count` null. First object text has `flux":9.300000000000000e+001`, which parses as `93.0`, `time_tag` `2026-10-03T17:00:00`, `reporting_schedule` `Morning`. | `flux` unit is not a field in the JSON. SWPC defines F10.7 in s.f.u.; fetched page text: one s.f.u. is `10 -22 W m -2 Hz -1`. | https://services.swpc.noaa.gov/json/f107_cm_flux.json | 2026-10-03 | CONFIRMED | Unit sentence: https://www.swpc.noaa.gov/phenomena/f107-cm-radio-emissions. JSON `frequency` is `2800`, matching that page's 2800 MHz. No separate schema page was found; cadence is what this file contained. |
| RTSW wind object fields | Array of objects. Keys in order: `time_tag` string; `active` boolean; `source` string; `proton_speed` number; `proton_temperature` number (integer on all 3922 objects); `proton_density` number; `proton_vx_gse`, `proton_vy_gse`, `proton_vz_gse`, `proton_vx_gsm`, `proton_vy_gsm`, `proton_vz_gsm` number or null; `proton_sample_size` number; `alpha_speed`, `alpha_temperature`, `alpha_density`, `alpha_vx_gse`, `alpha_vy_gse`, `alpha_vz_gse`, `alpha_vx_gsm`, `alpha_vy_gsm`, `alpha_vz_gsm`, `alpha_sample_size` null on every object in this file; `max_convergence_flag`, `max_data_flag`, `max_error_count_flag`, `max_processing_flag`, `max_range_flag`, `max_sample_count_flag`, `max_telemetry_flag`, `overall_quality` numbers. Speed field `proton_speed`. Density field `proton_density`. Temperature field `proton_temperature`. Active flag `active`. | JSON states no units | https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json | 2026-10-03 | CONFIRMED | 3922 objects. `active` true 1379, false 2543. `source` counts: `SOLAR1` 1379, `ACE` 1354, `IMAP` 1189. Vector components null on 2543 objects and float on 1379. Alpha fields had no non-null example, so a populated alpha type was not observed. |
| RTSW wind sort order | Not stated in the file. Observed `time_tag` order is strictly descending: first object `2026-10-03T19:29:00`, last `2026-10-02T19:33:00`. 2623 distinct `time_tag` values among 3922 objects. | — | https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json | 2026-10-03 | CONFIRMED | Same minute appears on more than one `source`. |
| RTSW JSON plasma units | Not stated in `rtsw_wind_1m.json` or on https://www.swpc.noaa.gov/products/real-time-solar-wind | — | https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json | 2026-10-03 | UNVERIFIED | Tried the JSON and the SWPC real-time solar wind page. A different ACE text product, https://services.swpc.noaa.gov/text/ace-swepam.txt, says `Proton density p/cc`, `Bulk speed km/s`, and `Ion tempeture degrees K`. That header is not the JSON schema. |

BLOCKING: no
