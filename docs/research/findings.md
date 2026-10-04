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
| 2026-10-03 | M6 | `3rok-design-system/` was missing on main after merge 39e9f6e while `app/layout.tsx` still imported it. | Restored from M5 commit cea6c6a. Not taken from the reverted M6 commit. |
| 2026-10-03 | M6 | Earth day texture is NASA Visible Earth Blue Marble Next Generation, December 2004, 5400×2700. Public domain. https://visibleearth.nasa.gov/images/73909/december-blue-marble-next-generation | File `public/earth/blue-marble.jpg`. |
| 2026-10-03 | M6 | Earth night texture is NASA Black Marble 2012, record 79765, downscaled to 4096×2048. Public domain. https://visibleearth.nasa.gov/images/79765/earth-at-night | File `public/earth/night-lights.jpg`. |
| 2026-10-03 | M6 | Coastline is Natural Earth 110m land, public domain. https://www.naturalearthdata.com/about/terms-of-use/ | File `public/earth/ne_110m_land.geojson`. No external 3D mesh. |
| 2026-10-03 | M6 | SupGP license is UNCONFIRMED. CelesTrak publishes no license or attribution clause (UNCONFIRMED). Space-Track gives blanket approval to redistribute basic SSA data if cited. | Footer cites 18 SDS/Space-Track via CelesTrak and says the SupGP license and CelesTrak wording are unconfirmed. |
| 2026-10-03 | M6 | IGRF-14 coefficient redistribution terms were not confirmed. Coefficients are the NOAA IAGA file `igrf14coeffs.txt`. The 25,000 nT threshold is Heirtzler (2002). | Label the contour IGRF-14. Do not evaluate IGRF per frame. |
| 2026-10-03 | M6 | A second Starmind sheet, 20 m × 70 m, is UNCONFIRMED. new.spacex.com did not resolve. | Not drawn. The UI says it is unconfirmed. |
| 2026-10-03 | M6 | Starlink snapshot was not re-downloaded. `downloadedAtUtc` is the M2 git commit time 2026-10-03T20:02:58Z. The fact-check at 23:30 UTC matched the committed SupGP and GP sizes. | CelesTrak allows one download per group per 2 hours. |
| 2026-10-03 | M6 | Worker tick for 2,000 OMM records measured 9.64 ms in the Node 24 unit test of the worker tick function, not inside a browser Worker. | See docs/cursor-log.md. Browser worker time is recorded after the preview run when available. |
