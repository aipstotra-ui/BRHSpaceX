# Data report

Computed from `ml/data/omni_hourly.parquet` unless a sentence cites another file.
Word 46 (OMNI >10 MeV protons) is not in this table.

## Coverage per column per decade

Fraction of hours with a non-missing value.

| Decade | by_gsm | bz_gsm | speed | density | kp | dst | f107 | pdyn |
|---|---|---|---|---|---|---|---|---|
| 1960s | 0.4765 | 0.4765 | 0.4591 | 0.3595 | 1.0000 | 1.0000 | 0.9973 | 0.3595 |
| 1970s | 0.7052 | 0.7052 | 0.7191 | 0.6561 | 1.0000 | 1.0000 | 0.9997 | 0.6561 |
| 1980s | 0.5566 | 0.5566 | 0.5182 | 0.5181 | 1.0000 | 1.0000 | 0.9997 | 0.5181 |
| 1990s | 0.6962 | 0.6962 | 0.6885 | 0.6828 | 1.0000 | 1.0000 | 0.9997 | 0.6828 |
| 2000s | 1.0000 | 1.0000 | 0.9986 | 0.9588 | 1.0000 | 1.0000 | 0.9981 | 0.9588 |
| 2010s | 0.9996 | 0.9996 | 0.9998 | 0.9923 | 1.0000 | 1.0000 | 0.9992 | 0.9923 |
| 2020s | 0.9423 | 0.9423 | 0.9402 | 0.9398 | 0.9585 | 0.9588 | 0.9582 | 0.9398 |

## Last valid OMNI hour per column

| Column | Last valid hour (UTC) |
|---|---|
| by_gsm | 2026-09-03T00 |
| bz_gsm | 2026-09-03T00 |
| speed | 2026-09-13T00 |
| density | 2026-09-13T00 |
| kp | 2026-09-16T23 |
| dst | 2026-09-17T12 |
| f107 | 2026-09-16T23 |
| pdyn | 2026-09-13T00 |

## Final vs quicklook Dst

Parsed OMNI minimum Dst on 2024-05-10 through 2024-05-11 is -406.0 nT.
docs/research/reference-values.md records the WDC Kyoto provisional value as −406 nT at 2024-05-11 02–03 UT, says it matches OMNI, and says the final index is not yet published. An early quicklook of −412 nT has been superseded (same file).
The live SWPC product `kyoto-dst.json` is the quicklook series and covers about 7 days (docs/research/api-swpc.md). It is not the final index.

## OMNI end vs the SWPC window

Live inference uses recent lags from the SWPC and RTSW feeds (about 7 days in api-swpc.md). It does not need the multi-week OMNI lag.
The test set ends at the last valid OMNI hour for the columns in use (ml-rules.md L1). That hour is the latest timestamp in the table above, per column.
Training-table columns are By GSM, Bz GSM, speed, density, Kp, Dst, F10.7, and computed flow pressure, plus a missingness flag for each. F10.7 stays in the table because a live JSON source is CONFIRMED in api-swpc.md.

## SEP labels

`data/history/sep_events.csv` has 319 data rows. First `start_ut` is 1976-04-30 21:20.

## GOES history

- `goes_protons_200310.parquet`: 8928 rows, time span 2003-10-01T00:00 .. 2003-10-31T23:55.
- `goes_protons_202202.parquet`: 1128960 rows, time span 2022-02-01T00:00 .. 2022-02-28T23:59.
- `goes_protons_202405.parquet`: 1249920 rows, time span 2024-05-01T00:00 .. 2024-05-31T23:59.
- `goes_xrays_200301.parquet`: 44640 rows, time span 2003-01-01T00:00 .. 2003-01-31T23:59.
- `goes_xrays_202202.parquet`: 40320 rows, time span 2022-02-01T00:00 .. 2022-02-28T23:59.
- `goes_xrays_202405.parquet`: 44640 rows, time span 2024-05-01T00:00 .. 2024-05-31T23:59.

May 2024 GOES-16 SGPS files parse. The L2 table in docs/research/data-sources.md records that those files do not store a ≥10 MeV integral. `AvgIntProtonFlux` is the P11 >500 MeV integral. Differential channel fluxes are stored with the file's lower-band energies.

## CelesTrak snapshot

`jq length data/snapshots/satcat_2022-010.json` is 21. docs/research/reference-values.md recorded 17 objects for this catalog query.

## G-scale thirds

G-level thresholds follow the NOAA table (G1 at Kp 5 through G5 at Kp 9). Thirds below an integer use a numeric threshold, so 4.67 is G0. That thirds choice is an estimate pending Aiden.
