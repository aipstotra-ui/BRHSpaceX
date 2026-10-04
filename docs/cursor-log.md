| Milestone | Date | researcher | ml-auditor | verifier | sha |
|---|---|---|---|---|---|
| M0 | 2026-10-03 | researcher: not used | ml-auditor: not used | verifier: BLOCKED after 1 | 714d2ac |
| M1 | 2026-10-03 | researcher: 8 Qs | ml-auditor: not used | verifier: BLOCKED after 1 | 07add47 |
| M2 | 2026-10-03 | researcher: 5 Qs | ml-auditor: CLEAN after 1 | verifier: PASS after 1 | 2dc44dc |
| M3 | 2026-10-03 | researcher: not used | ml-auditor: CLEAN after 1 | verifier: PASS after 1 | 78f342a |
| M4 | 2026-10-03 | researcher: 4 Qs | ml-auditor: CLEAN after 1 | verifier: PASS after 1 | bd58f11 |
| M5 | 2026-10-03 | researcher: 7 Qs | ml-auditor: not used | verifier: PASS after 1 | 2530928 |
| M6 | 2026-10-03 | researcher: not used | ml-auditor: not used | verifier: PASS after 1 | cea6c6a |

M6 worker ms per tick 34.021322 (verifier run, 2000 SGP4 propagations). This resolves satellite.js throughput.
| R1 + storm zones + timeline (ad hoc) | 2026-10-04 | researcher: stopped early at Aiden's request, values labeled estimate | ml-auditor: FINDINGS 0 BLOCKER, 3 SHOULD-FIX fixed (attempt 1) | verifier: not used, checks run inline (tsc, eslint, vitest 106/107, e2e 7/7) | this commit |
