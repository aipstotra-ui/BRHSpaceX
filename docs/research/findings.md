| Date | Milestone | Finding | Action |
|---|---|---|---|
| 2026-10-03 | M0 | Vercel CLI has no credentials, so production deploy did not run | Aiden logs in, then runs `npx vercel link` and `npx vercel deploy --prod` |
| 2026-10-03 | M1 | Production URL and server XAI_API_KEY are missing, so token checks 2 and 3 did not run | Aiden records the production URL in docs/research/deploy.md and sets the server key, then re-runs those curls |
| 2026-10-03 | M2 | G-scale thirds below an integer use a numeric threshold, so 4.67 is G0. This default is an estimate. | Aiden decides how thirds map onto the NOAA G-scale. |
| 2026-10-03 | M2 | GOES-R May 2024 SGPS files parse. They do not store a ≥10 MeV integral. Differential channels and the >500 MeV integral are in `data/history/goes_protons_202405.parquet`. | Keep that file until a stored ≥10 MeV integral source is confirmed. |
| 2026-10-03 | M2 | `jq length data/snapshots/satcat_2022-010.json` is 21. reference-values.md recorded 17. | Report 21. Do not replace the earlier 17 without a new source pass. |
