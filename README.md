# 3rok · StarMind Nav

**Live demo: https://brh-space-x.vercel.app**

Built for BigRed//Hacks 2026 (SpaceX track, "Make it Legendary").

SpaceX's Starmind satellites will fly AI chips in orbit. Radiation, the South Atlantic Anomaly, auroral zones, solar proton storms and storm-driven drag all shorten those chips' lives, and the danger moves with altitude, inclination, time and space weather. 3rok answers one question: **how long will this chip last on this orbit, what is hurting it, and what should the payload do when a storm hits?**

## What it does

- **Chip outlook.** Pick a chip (Starmind AI1, NVIDIA H100, Jetson Orin, TPU v6e, a rad-hard part, or your own specs) and an orbit. You get the estimated lifetime and what limits it (radiation dose or orbital decay), plus dose, upset rate, thermal margin and time in shadow.
- **Where the danger is.** A 3D globe shows the orbit, the SAA, the auroral oval and the solar-proton polar cap, along with the share of each orbit spent inside each zone.
- **Danger that moves with storms.** The auroral oval and the proton cutoff move toward the equator as Kp rises. The trail, the globe shading and the outlook all follow the timeline.
- **Timeline.** Choose "Now and the next 24 h" (live NOAA data plus the AI forecast), or replay the May 2024 superstorm hour by hour. The outlook shows how many times faster the chip is aging right now and how many days of life a storm has used.
- **Best orbit.** Rank candidate orbits for the chosen chip using storm climatology, then animate the move (illustrative Hohmann Δv).
- **Cases.** Save a chip and orbit setup, edit it, and fly it on the testing page.
- **Grok copilot.** Ask by voice or text: "What's the best orbit for this chip?", "What if a big storm hits tomorrow?" The copilot calls the same engine tools the page uses.

## Where the AI is

1. **Space-weather forecaster.** 24 gradient-boosted quantile models give Kp and Dst at +3, +6, +12 and +24 h, each as a P10/P50/P90 band. They use 48 solar-wind and geomagnetic features, were trained on NASA OMNI data from 1963 to 2019, and were validated on 2020–2022. They run in your browser (ONNX) on live NOAA solar wind. On unseen 2023–2026 data, the +3 h Kp forecast is **25 % more accurate than persistence**, and 84 % of outcomes fall inside its P10–P90 band.
2. **Decision policy.** A classifier trained on historical storms to imitate the hindsight-best action (continue, checkpoint, throttle or safe mode) using only what is known at the time. In the May 2024 replay it cut storm cost by **11 %** on the default orbit and **36 %** on a dawn-dusk sun-synchronous orbit, compared with always continuing.
3. **Honest limits, shown in the app.** The forecaster sees only near-Earth solar wind, so its first G3 warning for May 2024 was usable 4 h after the storm began. Open issues in the training data are listed in [docs/research/findings.md](docs/research/findings.md).

## Physics and data

- **Trapped radiation dose:** an AP8/AE8 + SHIELDOSE-2 grid (IRBEM via SpacePy) by altitude, inclination, shielding depth and solar phase ([scripts/orbit/dose_table.py](scripts/orbit/dose_table.py)).
- **Drag:** NRLMSIS 2.0 density up to storm-level Ap.
- **Eclipse and orbits:** Vallado umbra model, J2 nodal precession, sun-synchronous inclination.
- **Real data:**
  - NOAA SWPC: live Kp, Dst, solar wind, GOES protons, OVATION aurora.
  - NASA OMNI: hourly history from 1963.
  - GOES-16 SGPS: May 2024.
  - CelesTrak: Starlink orbits.
  - NCEI: SEP event list.
- **Labels:** every number carries a provenance label (source, estimate or UNVERIFIED) in the page markup. UNVERIFIED values stay visible on screen.

## Run it locally

Requires Node 24.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The Grok copilot needs `XAI_API_KEY` in `.env.local`. The key is only used on the server.

Checks:

```bash
npx tsc --noEmit && npx eslint . && npx vitest run
npx playwright test
```

## Repository layout

| Path | What is in it |
|---|---|
| `app/`, `components/` | Next.js pages: `/test` (cockpit) and `/cases`, plus the panels, globe, timeline and AI analysis |
| `lib/engine/` | Orbit, radiation, storm-zone, lifetime and replay engine |
| `lib/ml/` | Browser ONNX runtime, forecast features and policy inputs |
| `ml/` | Python training, evaluation and replay builders |
| `public/models/` | Exported ONNX models and model cards |
| `data/` | Dose and density grids, replays, climatology and snapshots |
| `docs/` | Build plan, research tables and findings |

## Team

Built with Cursor and Claude Code. MIT License.
