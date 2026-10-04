| Milestone | Date | researcher | ml-auditor | verifier | sha |
|---|---|---|---|---|---|
| M0 | 2026-10-03 | researcher: not used | ml-auditor: not used | verifier: BLOCKED after 1 | 714d2ac |
| M1 | 2026-10-03 | researcher: 8 Qs | ml-auditor: not used | verifier: BLOCKED after 1 | 07add47 |
| M2 | 2026-10-03 | researcher: 5 Qs | ml-auditor: CLEAN after 1 | verifier: PASS after 1 | 2dc44dc |
| M3 | 2026-10-03 | researcher: not used | ml-auditor: CLEAN after 1 | verifier: PASS after 1 | 78f342a |
| M4 | 2026-10-03 | researcher: 4 Qs | ml-auditor: CLEAN after 1 | verifier: PASS after 1 | bd58f11 |
| M5 | 2026-10-03 | researcher: 7 Qs | ml-auditor: not used | verifier: PASS after 1 | 2530928 |
| M6 | 2026-10-03 | researcher: attached fact-check, 23 rows, not a new subagent | ml-auditor: not used | verifier: pending full `npm run verify` | pending |

M6 worker tick: `WORKER_TICK_MS` 9.64 for 2,000 SupGP OMM records. Measured by `tests/unit/globe/propagate.test.ts` on Node 24.21.0 in this VM. That is the worker tick function, not a browser `Worker` and not a laptop frame time.
