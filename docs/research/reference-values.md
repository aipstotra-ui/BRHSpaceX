### A1 → `docs/research/reference-values.md`

**Starmind AI1**

| Item | Value | Status | Source |
|---|---|---|---|
| AI1 hardware | space-optimized NVIDIA Vera Rubin NVL72 | CONFIRMED | https://nvidianews.nvidia.com/news/spacexai-adopts-nvidia-vera-cpu-to-accelerate-agentic-ai-at-massive-scale ; https://www.supercomputing.news/emerging/nvidia-nvl72-starmind-spacex-ai1-spec-sheets-diverge [Researchy P1] |
| Announcement | NVL72 basis disclosed on SpaceX Q2 earnings call Aug 4 2026; NVIDIA press release Aug 24 2026; Starmind site live mid-July (SCN) | CONFIRMED (qualified, secondary) | SCN ; https://www.engadget.com/2243934/spacex-use-nvidia-gpu-for-starmind-project/ [P2] |
| Launch | "SpaceX targets Q4 2027" (Musk on X, Aug 24, per Quartz); SEC/IPO materials "as early as 2028"; SpaceX page: Gigasat output "as soon as late 2027" | CONFIRMED (qualified) | https://qz.com/spacex-nvidia-ai-satellites-orbit-2027-082526 ; https://www.spacex.com/spacexai/starmind [P3] |
| Orbit | sun-synchronous (official). No AI1 altitude published | CONFIRMED | https://www.spacex.com/spacexai/starmind [P4] |
| 500–2,000 km | altitude range of SpaceX's FCC "Orbital Data Center System" filing (filed Jan 30 2026, accepted Feb 4), **not** AI1 | CORRECTED | https://regmedia.co.uk/2026/02/05/spacex-orbital-dc-sat-narrative.pdf [P5] |
| Sunlight fraction | FCC filing: SSO gives sunlight "up to more than 99% of the time" (high-altitude SSO). "~98%" (Engadget) | FCC: CONFIRMED; 98%: UNVERIFIED | FCC PDF ; Engadget [N11] |
| AI1 spacex.com sheet | compute up to 250 kW peak / 175 kW average; solar 210 kW (at 250 W/m²), 75 m wingspan, 30 m height; radiator 160 m² | CONFIRMED | https://www.spacex.com/spacexai/starmind (spec text in page JS) [N12, N13, N15] |
| AI1 alternate sheet | 120 kW average compute; 150 kW peak **solar**; 110 m² radiator; 70 m span | CONFIRMED (secondary) | https://www.heise.de/en/news/SpaceXAI-s-Starmind-AI1-Satellite-Carries-Nvidia-Technology-11424154.html ; Quartz [N14] |
| Power sliders | average 120–175 kW; peak 150–250 kW (two presets, not a 150–230 range) | derived from the two sheets | [N14, Imp-1] |
| Radiator 158 m² / 1,700 ft² | Engadget rounding; use 160 m² | CORRECTED | [N15] |

**NVIDIA Vera Rubin NVL72**

| Item | Value | Status | Source |
|---|---|---|---|
| NVL72 composition | 72 Rubin GPUs + 36 Vera CPUs | CONFIRMED | https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/ [N1] |
| NVL72 memory/bw | 20.7 TB HBM4; 1,400 TB/s HBM bw; 288 GB HBM4 at 19.2 TB/s per GPU; up to 54 TB LPDDR5X | CONFIRMED | same [N2, N3, N6, N8] |
| NVL72 NVLink | 216 TB/s | CONFIRMED | same [N4] |
| NVL72 compute | 3,600 PFLOPS NVFP4 inference = **sparse**. Dense: 2,520 PF NVFP4 training, 1,260 PF FP8 | CONFIRMED (caveat) | same [N5] |
| NVL72 inlet | 45 °C liquid inlet | CONFIRMED | same [N7] |
| TSMC N3 | n/a | UNVERIFIED | none [N9] |
| Terrestrial rack power ~190–230 kW | n/a | UNVERIFIED | SCN (doesn't establish range) [N10] |
| AI1 mass, drag area, Cd | not in either review | UNVERIFIED | resolved at M5 L2(f), else user inputs labeled `estimate` |

**Feb 2022 event**

| Item | Value | Status | Source |
|---|---|---|---|
| Launch | 49 Starlinks launched Feb 3, perigee ~210 km; SpaceX said "up to 40" would reenter | CONFIRMED | https://spaceflightnow.com/2022/02/08/solar-storm-dooms-40-new-starlink-satellites/ [N17] |
| Losses | 38 of 49 lost: Fang et al. 2022, *Space Weather* 20(11), doi 10.1029/2022SW003193 | CONFIRMED (cite Fang) | https://repository.library.noaa.gov/view/noaa/53091 [N18] |
| Kp | GFZ definitive max 5.333 (5+) at Feb 3 09 UT and Feb 4 15 UT → **G1** (G2 not supported) | CONFIRMED / CORRECTED | https://kp.gfz.de/app/json/?start=2022-02-02T00:00:00Z&end=2022-02-04T23:59:59Z&index=Kp ; https://www.spaceweather.gov/noaa-scales-explanation [N19, N20] |
| SATCAT 2022-010 | 17 objects catalogued; 6 with Feb 2022 decay dates (Feb 6–12) → decay validation is weak | CONFIRMED | https://celestrak.org/satcat/records.php?INTDES=2022-010&FORMAT=json [extra finding] |

**May 2024 event**

| Item | Value | Status | Source |
|---|---|---|---|
| Kp / G-level | GFZ definitive Kp 9.0 at 2024-05-11 00–03 UT and 09–12 UT → G5. OMNI Kp×10 = 90 at 02 UT | CONFIRMED | https://kp.gfz.de/app/json/?start=2024-05-10T00:00:00Z&end=2024-05-11T23:59:59Z&index=Kp [N21, B13] |
| Dst | −406 nT at 2024-05-11 02–03 UT (hour 3), WDC Kyoto **provisional** (table updated 2025-01-28), matches OMNI. Final not yet published. An early quicklook −412 has been superseded | CONFIRMED (provisional) | https://wdc.kugi.kyoto-u.ac.jp/dst_provisional/202405/index.html [N22, B14] |
| SEP | onset 2024-05-10 13:35 UT, max 208 pfu 17:45 UT (X3.9, AR 13664). 2nd onset 2024-05-11 02:10 UT, max 116 pfu. The May 9 DONKI rows are REleASE model forecasts | CONFIRMED | NCEI SEP table ; https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2024-05-01&endDate=2024-05-31 [C1] |

**Storm scale**

| Item | Value | Status | Source |
|---|---|---|---|
| NOAA G-scale | G1 = Kp 5, G2 = 6, G3 = 7, G4 = 8, G5 = 9. Treatment of thirds (5−) is `estimate` pending Aiden | CONFIRMED (table) | https://www.spaceweather.gov/noaa-scales-explanation [N20, Imp-10] |
