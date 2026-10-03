### A8 → `docs/research/engine-constants.md` (seed; M4 and M5 L2 add the rest)

**Radiator area** [Researchy N16 redo]
- Formula: A = P / (n·ε·σ·(T⁴ − Tsink⁴)).
- Constants:
  - σ = 5.670374e-8 W m⁻² K⁻⁴
  - ε = 0.9 (`estimate`, v1 assumption)
  - Tsink 200 K (`estimate`, v1 assumption), with 0 K as an alternative
  - n = 2 means both faces radiate
- Lower bound: the formula ignores absorbed sunlight, albedo and Earth IR, fin efficiency and the coolant ΔT. It also uses compute power, which isn't total bus heat.

Researchy table, ε 0.9 (m²):

| P (kW) | 2-sided, Tsink 200 K: 300 / 320 / 340 K | 2-sided, Tsink 0 K: 320 / 340 K | 1-sided, Tsink 200 K: 320 / 340 K |
|---|---|---|---|
| 120 | 180.9 / 132.3 / 99.9 | 112.1 / 88.0 | 264.6 / 199.9 |
| 150 | 226.1 / 165.4 / 124.9 | 140.2 / 110.0 | 330.8 / 249.9 |
| 175 | 263.8 / 193.0 / 145.8 | 163.5 / 128.3 | 385.9 / 291.5 |
| 210 | 316.5 / 231.5 / 174.9 | 196.2 / 154.0 | 463.1 / 349.8 |
| 250 | 376.8 / 275.7 / 208.2 | 233.6 / 183.3 | 551.3 / 416.4 |

What the table shows:
- Back-solving SpaceX's own pairs (175 kW / 160 m² and 120 kW / 110 m²) gives ≈1.09 kW/m². That implies ≈333 K (2-sided, Tsink 200 K), ≈322 K (2-sided, Tsink 0 K), or ≈383 K (1-sided, Tsink 0 K).
- The 320–340 K band contains 160 m² **only for a 2-sided radiator**. The v1 band for 150–175 kW recomputes to 124.9–193.0 m².
- 250 kW peak can't be rejected by 160 m² in steady state, so peaks must be buffered or short.

**Dose and TID anchors** (https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/) [R7–R9]
- Shielded 5-yr LEO dose: 750 rad(Si).
- HBM first irregularities: 2 krad(Si), the first-anomaly point, not failure.
- No hard TID failure up to 15 krad(Si), from n = 1 chip.
