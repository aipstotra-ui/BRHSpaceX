| Date | Milestone | Finding | Action |
|---|---|---|---|
| 2026-10-03 | M0 | Vercel CLI has no credentials, so production deploy did not run | Aiden logs in, then runs `npx vercel link` and `npx vercel deploy --prod` |
| 2026-10-03 | M1 | Production URL and server XAI_API_KEY are missing, so token checks 2 and 3 did not run | Aiden records the production URL in docs/research/deploy.md and sets the server key, then re-runs those curls |
| 2026-10-03 | M2 | G-scale thirds below an integer use a numeric threshold, so 4.67 is G0. This default is an estimate. | Aiden decides how thirds map onto the NOAA G-scale. |
| 2026-10-03 | M2 | GOES-R May 2024 SGPS files parse. They do not store a ≥10 MeV integral. Differential channels and the >500 MeV integral are in `data/history/goes_protons_202405.parquet`. | Keep that file until a stored ≥10 MeV integral source is confirmed. |
| 2026-10-03 | M2 | `jq length data/snapshots/satcat_2022-010.json` is 21. reference-values.md recorded 17. | Report 21. Do not replace the earlier 17 without a new source pass. |
| 2026-10-03 | M4 | The four action costs in `ml/policy_costs.json` are proposed estimates, not measured operations costs. | Aiden approves or replaces continue, checkpoint, throttle, and safe mode. |
| 2026-10-03 | M4 | Drag is a flag only. No AI1 altitude is used. | Orbit-averaged drag waits for M5. |
| 2026-10-03 | M5 | Largest CelesTrak shell mean is 462.573944 km at 53.159685°. That is below the FCC 500 km slider minimum. It is not an AI1 altitude. | Keep the assumption label. Do not clamp the demo orbit up to 500 km. |
| 2026-10-03 | M5 | Vehicle mass 1000 kg, drag area 10 m², Cd 2.2, and end-of-life altitude 120 km are estimates. The 840 m² figure is the solar-array reading, not drag area. | Aiden confirms or replaces the four vehicle estimates. |
| 2026-10-03 | M5 | No SPENVIS dose grid. Annual dose scales the 750 rad(Si)/5 yr anchor by SAA fraction. The anchor orbit is UNVERIFIED. | Aiden can replace the estimate with a SPENVIS table. Dose and TID lifetime stay estimates until then. |
| 2026-10-03 | M5 | Non-SSO RAAN is 0°, an estimate. No LTAN was taken from the Starlink snapshot. | Aiden can set a real RAAN. SSO presets stay 06:00 and 12:00. |
