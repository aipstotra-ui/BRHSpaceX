> **Superseded.** The current product definition is [docs/product-spec.md](product-spec.md). This phase plan is the earlier one-screen orbit navigator (four promises, no optimal pin). Keep it as history. Do not build it.

# 3rok — MVP phase plan

The product name is **3rok**. Write it `3rok` in prose and `3ROK` in display type. An earlier draft called the product Meridian. That name is retired. Do not put Meridian, Starmind, or the repository name BRHSpaceX on the screen or in the code.

3rok is one screen. You move a satellite through altitude, inclination, and local solar time, and you watch four promises — power, heat, survival, and reach — hold or break under equations printed on the tile. Grok speaks after the page has already computed the tradeoff. It is not a second physics engine.

This file is the build order for the hackathon. A phase is done only when its philosophy gates pass. A gate is an acceptance check, not a preface.

## What the weekend builds

One Next.js (App Router) route on Vercel. TypeScript. Physics in `lib/orbit.ts` with tests. Grok through the AI SDK on one route that accepts only the metrics record. `XAI_API_KEY` is the only secret. No database.

Build only this:

1. A flat orbit diagram with the Sun, the shadow, and beta.
2. Four tiles wired to the models in the contract below.
3. Four presets. Ghost the orbit you leave. The demo pair is dawn-dusk and the 45.4° / 500 km rideshare.
4. The J2 check: sun-synchronous inclination for this altitude, solved, never hard-coded as 98°.
5. Grok’s brief, the no-new-numbers rule, and a visible failure when the rule breaks.
6. The “Not this” strip.

## Lanes

Three lanes. They meet in Phase 4.

| Lane | Owns | May not edit |
|---|---|---|
| **Scaffold** | Phase 0 files listed below | `3rok-design-system/**` |
| **Physics** | `lib/orbit.ts`, `lib/orbit.test.ts` | React components, the brief route |
| **Screen** | `app/page.tsx`, `app/layout.tsx`, `components/OrbitDiagram.tsx`, `components/PromiseTiles.tsx`, `components/Controls.tsx`, `components/NotThis.tsx`, `components/KillerLine.tsx` | formulas, the brief route |
| **Brief** | `app/api/brief/route.ts`, `lib/brief-prompt.ts`, `lib/brief-check.ts`, `components/Brief.tsx` | formulas, the diagram |

`lib/types.ts` and `lib/presets.ts` are the shared contract. After Phase 0, change a field only by editing this file in the same commit. Do not add a dose field, a dollar field, a user id, or an `optimal` field.

## What can run in parallel

Merge Phase 0 first. It is a short commit. After it is on `main`:

- Physics, screen, and brief run **in parallel**.
- The screen may lay out the diagram, the four tile slots, the sliders, and the preset row before `evaluate` exists.
- The brief may be written and tested against the example records in this file before the page is wired.

## Hard dependencies

- Any number on the screen comes from `evaluate()` in `lib/orbit.ts`. Until that function is merged, a tile stays blank and reads `Waiting on lib/orbit.ts`. Do not type a placeholder `38%`.
- The diagram draws `record.diagram`. It does not compute beta, eclipse, or the shadow arc.
- The killer sentence reads `record.binding`. The screen does not decide which promise failed.
- The brief route does no arithmetic. If it imports `lib/orbit.ts`, the brief lane has crossed the line.
- Phase 4 does not start until `evaluate`, the screen, and the route are all on `main`.
- Presets 1 and 3 do not store an inclination. They store `inclination: "sso"` and `evaluate` fills it from the J2 solver.

```
Phase 0  contract + empty instrument
    │
    ├── Physics  lib/orbit.ts          ─┐
    ├── Screen   diagram, tiles, presets ┼──► Phase 4  demo gate
    └── Brief    route + number check   ─┘
```

## UI: use the 3rok design system

The system already on `main` is `3rok-design-system/`. Read its README and `.cursor/rules/3rok-design-system.mdc`. Build the screen with it.

- Copy `3rok-design-system/.cursor/rules/3rok-design-system.mdc` to `.cursor/rules/3rok-design-system.mdc`. Do not edit the copy inside `3rok-design-system/`.
- Import once in `app/layout.tsx`:

```tsx
import "../3rok-design-system/tokens.css";
import "../3rok-design-system/components/bundle.css";
```

- Colors, type, space, and radii come from the CSS variables (`var(--surface-100)`, `var(--ink)`, `var(--space-5)`, `var(--line)`, `var(--radius-none)`). Do not hard-code them.
- Dark theme for the instrument. Do not set `data-theme="light"`.
- Barlow for words. IBM Plex Mono for every measured value, through `data-xl`, `data-md`, and `data-sm`.
- In a Next.js app, re-implement the components you need as local `.tsx` files that reuse the classes in `components/bundle.css`. Do not load `components/bundle.js`.
- Use `Panel`, `Stat`, `StatusBadge`, `Button`, `Tabs`, and `Field`.
- One `solid` button on the screen. Its label is `Ask Grok`. Other buttons are `ghost` or `quiet`.
- Promise state uses `--status-nominal`, `--status-caution`, and `--status-critical`, each with a word and a shape: circle for holding, triangle for a broken promise that is not the killer, square for the killer.
- The nav wordmark is `3ROK`.

The design-system rule also describes pieces of a different product. Do not build those:

- Do not use `Hero`. This is not a landing page.
- Do not use `PlacementMap`. That grid is a chip placement map. 3rok does not place chips.
- Do not use `ProgressBar`. A bar that fills is a blended score or a dose gauge.
- Do not use `--thermal-1` … `--thermal-5`. In the rule those colors mean long life to short life. This page has no life score and no wear map.
- Do not label a button `Run prediction`. The physics is already on the page as the slider moves.
- The rule’s example units (`YR`, `KRAD`) are not outputs of this page. Units here are `%`, `m²`, `m²/kW`, `min`, `ms`, `km`, `°`, `kW`, and `K`. The only radiation figure allowed anywhere is the citation in the contract, and only on the dawn-dusk reference.

When this plan and the design-system examples disagree about the product, this plan wins. The look (black ground, type, buttons, status shapes) still comes from the system.

## The contract

`lib/orbit.ts` exports `evaluate(input: OrbitInput): MetricsRecord`. All formulas in this section live in that file and nowhere else.

### Constants (top of `lib/orbit.ts`)

| Name | Value |
|---|---|
| Earth equatorial radius | `6378.137 km` |
| μ | `3.986004418×10^14 m³/s²` |
| J2 | `1.08262668×10^-3` |
| σ | `5.670374419×10^-8 W/m²/K⁴` |
| Solar constant | `1367 W/m²` (mean used in NASA thermal-environment notes) |
| Ground noon reference | `1000 W/m²` |
| Speed of light | `299792.458 km/s` |
| Year for the sun-synchronous rate | `365.2421897` mean solar days |
| Eclipse break | worst-day eclipse fraction `> 0.05` |
| Heat break | area `> 5 m²/kW` |
| SSO match | absolute difference `≤ 0.5°` |
| Belt line | altitude `≥ 1000 km` |
| Drag note | altitude `≤ 450 km` |
| Elevation mask | `10°` |
| Interactive reach break | a visible pass shorter than `20 min` |

The thresholds are named constants. The tile prints the threshold it used. They are not magic numbers inside a component.

### Presets

`lib/presets.ts` holds inputs only. It does not hold results.

| Order | Id | Name on screen | Altitude | Inclination | LTAN | Why this one |
|---|---|---|---|---|---|---|
| 1 | `dawn-dusk` | Dawn-dusk sun-synchronous | 600 km | `"sso"` | 18:00 | The pitch. High beta. |
| 2 | `rideshare` | Rideshare | 500 km | 45.4° | 12:00 | Mid-inclination geometry. LTAN 12:00 makes the worst day a beta near 0, so the shadow is on screen. This is not a claim about anyone’s operations. |
| 3 | `noon-sso` | Noon sun-synchronous | 600 km | `"sso"` | 12:00 | Same altitude family, worst eclipse season. The control. |
| 4 | `iss-like` | ISS-like | 400 km | 51.6° | 12:00 | Familiar, low, not the energy orbit. |

Shared defaults, all editable, all labeled:

- Day of year starts at **80**. Selecting a preset then jumps the day slider to that orbit’s **worst eclipse day**, so the diagram shows the day the power tile is judging. She can move the day afterward. The power tile keeps using the worst day.
- Compute power **1 kW**, slider **0.5–200 kW**.
- Radiator temperature **320 K**, slider **270–370 K**.
- Emissivity **0.9**, edited on the heat tile, range **0.5–0.95**.
- Ground latitude **37°**, slider **−60° to 60°**.
- Ground capacity factor **0.18**, edited on the power tile, range **0.05–0.40**.
- Annual-factor threshold **1**, edited on the power tile.
- Workload opens on **interactive inference**.

Other sliders: altitude **300–2000 km**, inclination **0–180°**, local time of the ascending node **0–24 h** in 0.1 h steps, day of year **1–365**.

Changing altitude, inclination, or local time clears `dawnDuskReference`. Changing day, power, temperature, emissivity, latitude, capacity factor, annual threshold, or workload does not.

`askedForSso` is true only when the selected preset is `dawn-dusk` or `noon-sso`.

### Record

```ts
export type PresetId = "dawn-dusk" | "rideshare" | "noon-sso" | "iss-like";
export type Workload = "interactive" | "bulk-training";
export type PromiseId = "power" | "heat" | "survival" | "reach";
export type PromiseState = "holding" | "broken";

export type OrbitInput = {
  presetId: PresetId | "custom";
  altitudeKm: number;
  inclinationDeg: number;
  ltanHours: number;
  dayOfYear: number;
  computeKw: number;
  radiatorTempK: number;
  emissivity: number;
  groundLatitudeDeg: number;
  groundCapacityFactor: number;
  annualFactorThreshold: number;
  workload: Workload;
  dawnDuskReference: boolean;
  askedForSso: boolean;
};

export type MetricsRecord = {
  presetName: string;
  input: OrbitInput;
  diagram: {
    betaDeg: number;
    sunFromAscendingNodeDeg: number; // (LTAN - 12) * 15
    shadowHalfAngleDeg: number;      // 0 when this day has no eclipse
    passArcDeg: number | null;
    eclipseFractionThisDay: number;
    model: string;
  };
  power: {
    eclipseFractionWorstDay: number;
    worstDayOfYear: number;
    eclipseFractionThisDay: number;
    sunlightFractionWorstDay: number;
    brighterSunRatio: number;
    annualFactor: number;
    groundCapacityFactor: number;
    annualFactorThreshold: number;
    state: PromiseState;
    model: string;
  };
  heat: {
    areaM2PerKw: number;
    areaM2: number;
    radiatorTempK: number;
    emissivity: number;
    thresholdM2PerKw: number;
    state: PromiseState;
    model: string;
  };
  survival: {
    mode: "citation" | "refusal";
    citation: string | null;
    refusal: string | null;
    ssoInclinationDeg: number;
    inclinationDeg: number;
    ssoMatch: boolean;
    belt: boolean;
    state: PromiseState;
    model: string;
  };
  reach: {
    maskDeg: 10;
    maxPassMin: number | null;
    lightTimeZenithMs: number;
    lightTimeMaskMs: number | null;
    passesPerDay: number | null;
    seesSite: boolean;
    state: PromiseState;
    annotation: string | null;
    model: string;
  };
  binding: PromiseId | null;
  refusals: string[];
  dragNote: string | null;
};
```

The brief route accepts `{ current: MetricsRecord, ghost: MetricsRecord | null, question: string | null }` and nothing else.

### Formulas

Label every result with the model string in the same object. Omissions go in that string.

**Beta and eclipse.** Circular orbit. Cylindrical umbra. Penumbra ignored. Cooper declination. Equation of time ignored.

```
declDeg = 23.44 * sin(2π * (dayOfYear - 81) / 365)
sinβ = sin(decl) * cos(i) + cos(decl) * sin(i) * sin((LTAN_hours - 12) * 15°)
β = asin(clamp(sinβ, -1, 1))

r = Re + h
β* = asin(Re / r)
if |β| ≥ β*: eclipseFraction = 0
else eclipseFraction = acos(cos(β*) / cos(β)) / π

shadowHalfAngleDeg = eclipseFraction * 180
```

Worst day: evaluate days 1 through 365 and keep the maximum eclipse fraction. Also return that day number.

Acceptance for the physics tests:

- 500 km and β = 0 → eclipse fraction between **0.36 and 0.40** (about 38%).
- 600 km, the solved sun-synchronous inclination, LTAN 18:00, day 80 → eclipse fraction **0** and |β| above 70°.
- A result of about 5% or about 70% at 500 km and β = 0 means the formula is wrong.

**Sun-synchronous inclination.** Solve. Do not return a constant.

```
a = (Re + h) in meters
n = sqrt(μ / a³)
desired = 2π / (365.2421897 * 86400)     // rad/s, node follows the mean sun
cos i = desired / (−1.5 * n * J2 * (Re / a)²)
i = acos(cos i)
```

Test: the 600 km result is greater than the 400 km result by at least 0.5°. With these constants, 600 km is near 97.8°. The source of `lib/orbit.ts` must not contain a hard-coded `98` returned as the inclination.

**Power.**

```
brighterSunRatio = 1367 / 1000                         // about 1.37×, shown on its own
sunlightFractionWorstDay = 1 - eclipseFractionWorstDay
annualFactor = (sunlightFractionWorstDay * 1367) / (groundCapacityFactor * 1000)
```

Power breaks when the worst-day eclipse fraction is greater than 0.05, or the annual factor is below her threshold. Print both the brighter-sun ratio and the annual factor. Print the formula. There is no “8×” badge. If her capacity factor produces a factor near 8, the tile shows that computed factor and the formula, still not a badge.

Model string: `Cylindrical shadow, circular orbit, penumbra ignored. Worst day of the year. Annual factor uses her ground capacity factor.`

**Heat.**

```
rejected W/m² = emissivity * σ * T⁴
areaM2PerKw = 1000 / rejected
areaM2 = areaM2PerKw * computeKw
```

At 320 K and emissivity 0.9 this is about **1.87 m²/kW**. Heat breaks when `areaM2PerKw > 5`. Always show the area, including when it holds.

Model string: `Stefan-Boltzmann, sink 0 K, Earth infrared and albedo ignored, area is a lower bound.`

**Survival.** A gate, not a dose.

Always print: `Sun-synchronous at {h} km wants {sso}°. This orbit is {i}°.`

- `dawnDuskReference` true: `mode: "citation"`, state **holding**. The citation string is exactly: `About 150 rad(Si)/year behind about 10 mm of aluminum. Suncatcher paper, shielded dawn-dusk sun-synchronous orbit, one orbit class, one shield, not this chip.`
- Otherwise: `mode: "refusal"`, state **broken**, `citation: null`. Refusal: `This page does not compute a dose. Use SPENVIS.`
- Altitude ≥ 1000 km: set `belt: true` and append ` Above about 1,000 km you are entering belt territory.` Still no dose.
- `askedForSso` and the inclination misses by more than 0.5°: state **broken**, even if you also show the citation case. Leaving the reference already breaks the tile. Say that local time will drift and the eclipse season will move.

No other altitude, inclination, or in-between value gets a dose. No table of published doses. No interpolation.

**Reach.** One satellite. No laser mesh.

```
λ = acos((Re / r) * cos(10°)) - 10°          // Earth central angle, radians
orbitLat = min(i, 180° − i)
seesSite = |groundLatitude| ≤ orbitLat
```

If the site is visible, the best-pass duration is `(2λ / 2π) * period`, Earth rotation ignored, ground track taken through the site. If the site is not visible, `maxPassMin` is null and both workloads break.

Light time at zenith is `h / c`. Light time at the mask uses the slant range `sqrt(Re² + r² − 2·Re·r·cos λ)`. At 500 km, zenith light time is about **1.7 ms**, and the best pass is several minutes (about 7).

`passesPerDay` is rough and **does not decide the tile**:

```
trackShiftDeg = 360 * periodSeconds / 86400
passesPerDay = min(86400 / periodSeconds, (2 * λDeg) / trackShiftDeg * 2)
```

Caption: `Rough count, circular orbit, Earth rotation averaged, not a contact schedule.`

Reach breaks when the site is never above 10°, or the workload is interactive and the best pass is under 20 minutes. Bulk training does not break the tile when a pass exists. It sets state **holding** and annotation `The gap is acceptable for bulk training. One satellite. No laser mesh.` Interactive annotation when broken: `Interactive inference cannot wait out the gap. One satellite. No laser mesh.`

Switching workload does not change eclipse fraction, radiator area, beta, or light time.

**Drag.** When altitude ≤ 450 km, `dragNote` is: `Below a few hundred kilometers, drag ends a mission in months unless you reboost. This page does not compute that lifetime.` Otherwise null. This is a caption on the diagram. It is not a fifth promise and not a duration.

**One killer.** Walk `power`, `heat`, `survival`, `reach`. The first broken promise is `binding`. If none are broken, `binding` is null.

That order is what makes the demo pair work. Dawn-dusk with interactive inference: only reach is broken, so reach is the killer. The same orbit with bulk training: nothing is broken. Rideshare: power breaks, so power is the killer even though survival refuses and interactive reach is also broken.

**Refusals, always present in the record:**

- `One satellite. No laser mesh and no second satellite.`
- `No chip lifetime and no wear percentage.`
- `No dose except the cited dawn-dusk reference.`
- `No launch price and no dollars per kilowatt.`
- `No single-event rate.`

Plus the survival refusal and the drag note when those states are active.

### Killer sentences (screen, not Grok)

These are templates filled from the record, so they exist with the network off. One line, large type (`heading-lg`). The other tiles stay on `data-md` and `body-sm`.

- Power: `Power breaks. This orbit is dark {worst-day %} of the worst revolution.`
- Heat: `Heat breaks. The radiator wants {m²/kW} m² per kilowatt.`
- Survival: `Survival breaks. This page will not invent a dose here.`
- Reach: `Reach breaks. The longest pass is {minutes} minutes, and nothing else is overhead.`
- None: `All four promises hold.`

### Diagram

One flat SVG. Most of the viewport.

- Earth is a disk. The orbit is a circle around it. Radius scales linearly with altitude from 300 to 2000 km so two orbits are visibly different.
- The Sun is a direction in the page, from `sunFromAscendingNodeDeg`.
- The shadow is the arc opposite the Sun, half-width `shadowHalfAngleDeg`. No shadow arc when that value is 0.
- Beta is an angle mark labeled with `betaDeg`, between the orbit plane and the Sun. It is drawn as an angle, not as a tooltip.
- The pass arc uses `passArcDeg` from the record (`2λ` in degrees, or nothing when the site is not visible).
- The ghost orbit is the previous preset, drawn with a thinner stroke in `var(--line)`, on the same diagram.
- Ghosting happens when she **selects a preset**, not on every slider tick.
- Motion is limited to the Sun, the shadow, and the pass arc.

### Not this (on the screen the whole time)

A strip, not a footer link:

- No chip lifetime, no wear percentage, no optimal coordinate.
- No dose except the one cited dawn-dusk case.
- No single-event rate. Inference and training are not called equally safe.
- No 8× badge.
- No launch price and no dollars.
- No constellation and no claim that latency is low because light time is a few milliseconds.
- No implication that this team or this host is SpaceX.

---

## Phase 0 — Contract and empty instrument

**What is being built.** A deployed Next.js shell that already looks like the instrument, plus the TypeScript contract the other lanes import. No physics yet. No brief yet.

**Owns.** `package.json` (scripts `dev`, `test`, `build`), `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `lib/types.ts`, `lib/presets.ts`, and the copied rule at `.cursor/rules/3rok-design-system.mdc`.

**Done.** `npm test` runs (it may have zero tests). `npm run build` passes. The page is a black viewport: a diagram region that is most of the screen, four empty tile slots, a preset row in the order above, the slider ranges, a workload switch, and a collapsed brief slot. The wordmark is `3ROK`. No number is shown.

**Out of this phase.** Formulas, Grok, the ridge chart, accounts, dollars, a globe, any chip or dose UI.

**Parallel.** Nothing else merges before this. After it lands, the three lanes start together.

### Philosophy gates

**Move the orbit, not a spreadsheet.** The first region in the layout is the diagram. Sliders sit with the drawing. **Not done if** the first screen is a form, a table, or a stack of fields.

**Four promises, one killer.** The shell has four slots and one place for the killer sentence. **Not done if** there is a fifth slot, a total, a progress bar, or an orbit score.

**Every number wears its model.** `MetricsRecord` has no numeric result without a `model` string on that object, except the raw `OrbitInput`. **Not done if** the type allows a bare eclipse fraction, area, or dose with nowhere to put the caption.

**A ridge, not a pin.** The preset type has the four ids above and `custom`. **Not done if** any field or preset is named optimal, best, or winner.

**The pitch orbit and the flown orbit stay on screen together.** The page state has a current input and a previous input. **Not done if** the state can hold only one orbit.

**Stop at the door of SPENVIS.** Survival in the type is `citation` or `refusal`, with `citation` nullable. **Not done if** the type has a `doseRad` (or any dose) that varies with the sliders.

**Instruments first, voice second.** The page renders with no fetch to `/api/brief`. The brief slot is collapsed and says the brief comes after the tiles. **Not done if** the home screen is a chat box, or the page waits on the network to show the diagram.

**An instrument, not a landing page.** Background `var(--surface-100)`, type from the design system, square corners, no shadow except the allowed popover token. **Not done if** the page uses `Hero`, a gradient, a globe, stock Earth photography, or a color written as a hex.

---

## Phase 1 — Orbit library

**What is being built.** The only place numbers are computed. `evaluate` fills a `MetricsRecord` from an `OrbitInput`.

**Owns.** `lib/orbit.ts`, `lib/orbit.test.ts`. This lane may edit `lib/types.ts` only to match the contract in this file if the scaffold drifted.

**Done.** `npm test` covers the acceptance checks in the contract: the 500 km β = 0 eclipse band, dawn-dusk eclipse at day 80, heat near 1.87 m²/kW at 320 K and emissivity 0.9, zenith light time near 1.7 ms at 500 km, J2 at two altitudes, citation only when `dawnDuskReference` is true, refusal with no dose otherwise, belt sentence at 1000 km, workload changes reach state and does not change eclipse or area, binding order, drag note at 400 km and not at 600 km. Tests call `evaluate`. They do not copy expected HTML.

**Out of this phase.** Components, CSS, the route, any search for a best orbit, any call to SPENVIS, any table of doses.

**Parallel.** Runs beside the screen and the brief. The screen must not vendor a second copy of these formulas while it waits.

**Hard dependency for everyone else.** Their phases are not done until they call this function for every figure.

### Philosophy gates

**Move the orbit, not a spreadsheet.** `diagram` includes beta, the sun angle, the shadow half-angle, and the pass arc, so a drawing can be made from the return value. **Not done if** the only output is a row of scalars with no angles.

**Four promises, one killer.** The return has four states and at most one `binding`. **Not done if** the function returns a score, a weighted total, or two killers.

**Every number wears its model.** Each of `diagram`, `power`, `heat`, `survival`, and `reach` includes its model string. The 500 km, β = 0 eclipse fraction is inside 0.36–0.40. **Not done if** a figure can be returned without that string, or the rideshare worst case falls near 5% or 70%.

**A ridge, not a pin.** There is no `optimize`, `bestAltitude`, or search over the slider space. Presets are inputs. **Not done if** the library recommends an orbit.

**The pitch orbit and the flown orbit stay on screen together.** The same `evaluate` runs on both orbits. Dawn-dusk and rideshare are two calls. **Not done if** either preset has a private formula.

**Stop at the door of SPENVIS.** Off the dawn-dusk reference, `citation` is null and the refusal names SPENVIS. At or above 1000 km the refusal also names the belts. The number 150 appears only inside the citation string, and only in citation mode. **Not done if** any dose is interpolated, scaled with altitude, or returned for the rideshare, noon, or ISS-like presets.

**Instruments first, voice second.** `lib/orbit.ts` is pure. It does not import the AI SDK and it does not fetch. **Not done if** a model call or a network call sits on the path that computes eclipse or area.

**An instrument, not a landing page.** The tests are the check on the numbers. They assert the bands above, not merely that the function returns an object. **Not done if** the suite passes with a hard-coded inclination or a hard-coded 38% that ignores altitude and beta.

---

## Phase 2 — Diagram, presets, and tiles

**What is being built.** The instrument she actually touches. Presets, sliders, the flat diagram, four tiles, the killer line, the ghost orbit, the drag caption, and the “Not this” strip.

**Owns.** The screen files listed in the lane table. `app/page.tsx` calls `evaluate` for the current input and, when a previous preset exists, once more for the ghost. It stores both records and passes them down.

**Done.** With the library merged: opening the page on dawn-dusk, interactive, shows power holding, heat showing about 1.9 m²/kW as a lower bound, survival showing the citation and not a lifetime, and reach as the killer. Pressing Rideshare ghosts the dawn-dusk orbit and makes power the killer, with the worst-day shadow covering about a third of the orbit. Dragging altitude to 1000 km turns survival into the SPENVIS refusal and the belt sentence. Flipping the workload to bulk training on dawn-dusk clears the reach break and does not change the eclipse fraction or the area. Every figure has its model caption visible, set like a caption (`body-sm`), not behind a tooltip.

**Out of this phase.** The Grok route (leave the brief slot collapsed), the ridge chart, a 3D Earth, accounts, dollars, dose lookup.

**Parallel.** Layout can start against blank tiles as soon as Phase 0 is merged. Do not invent numbers in the components. Wiring to `evaluate` is the hard dependency for calling this phase done.

### Philosophy gates

**Move the orbit, not a spreadsheet.** Dragging altitude, inclination, or local time moves the orbit, the Sun, or the shadow on the diagram. The diagram is most of the viewport. **Not done if** the picture is a thumbnail beside a form, or a slider changes a number the picture does not show.

**Four promises, one killer.** The killer line uses the templates and `record.binding`. The killer badge is critical (square). Another broken promise is caution (triangle) and still says `Breaks`. Holding is nominal (circle) and says `Holds`. The workload switch changes reach without recomputing physics in the component. **Not done if** more than one promise is drawn as the killer, or the tiles collapse into one score.

**Every number wears its model.** The caption under each figure is the `model` string from the record, visible in the tile. Rideshare worst-day eclipse reads about 38%, matching the test. **Not done if** the source is only in a tooltip, or the screen formats that case as something far from 38%.

**A ridge, not a pin.** The four presets are on one row, one click apart. Nothing is labeled optimal. She can see a pitch that holds power and a rideshare that breaks it. **Not done if** a marker, pin, or copy names a best orbit or a best coordinate.

**The pitch orbit and the flown orbit stay on screen together.** After a preset click, the orbit she left remains on the diagram until the next preset click. Dawn-dusk then Rideshare shows both. **Not done if** comparing them means navigating to another page, or the ghost updates on every slider tick and chases her hand.

**Stop at the door of SPENVIS.** Leaving the reference case replaces the citation with the refusal, in the tile, naming SPENVIS. Crossing 1000 km adds the belt sentence. The refusal is designed copy, with a status badge. **Not done if** the tile shows an empty error, a spinner, a blank, or any rad number other than the citation.

**Instruments first, voice second.** Disconnecting the brief component leaves the diagram and the tiles working. **Not done if** the screen blocks on `/api/brief` before it draws.

**An instrument, not a landing page.** Look comes from the design system. Motion is only the Sun, the shadow, and the pass arc. **Not done if** the page uses `Hero`, `PlacementMap`, `ProgressBar`, a gradient, a globe, or the thermal “life” scale.

---

## Phase 3 — Brief

**What is being built.** A short brief under the tiles. Grok is the voice of the instruments. One question. A visible failure when the reply contains a number the record does not contain.

**Owns.** `app/api/brief/route.ts`, `lib/brief-prompt.ts`, `lib/brief-check.ts`, `components/Brief.tsx`.

**Done.** The route accepts only `{ current, ghost, question }`. The system prompt tells the model to do four things, in order: name the broken promise in one sentence using figures it was given; say what she would move (local time, altitude relative to drag and the belt line, or the workload switch) and why that follows from these tiles; compare the two orbits when `ghost` is present; answer her question without adding a quantity. The prompt forbids new numbers, a best orbit, and any chip lifetime. Temperature, area, and eclipse are not recomputed here. If the key is missing or the call fails, the panel says `The brief is unavailable. The orbit above is still computed.` The diagram and tiles stay up.

The number check: read digit tokens in the reply. A token is allowed only when that value is in the JSON of `current` or `ghost`, allowing a fraction to be spoken as a percent (0.378 may appear as 37.8 or 38) and allowing the decimals already in the record. If any token is not allowed, the panel does not show the reply as the brief. It shows status critical and the sentence `This reply used a number the page did not compute.` A `quiet` button, `Show a rejected reply`, runs the same checker on a canned reply that contains `2 krad`, so the demo can show the failure without waiting for the model to slip.

**Out of this phase.** Computing orbit geometry, a chat transcript, tool calls that run a simulator, dose answers, dollar answers.

**Parallel.** Build the route against the two example shapes below as soon as Phase 0 has the types. **Not done** until the page sends the live records from `evaluate`, including the ghost when it is on screen.

Example shape the tests may freeze (values illustrative; the live page uses `evaluate`):

```json
{
  "presetName": "Rideshare",
  "power": { "eclipseFractionWorstDay": 0.378, "state": "broken", "model": "Cylindrical shadow, circular orbit, penumbra ignored. Worst day of the year. Annual factor uses her ground capacity factor." },
  "heat": { "areaM2PerKw": 1.87, "state": "holding" },
  "survival": { "mode": "refusal", "refusal": "This page does not compute a dose. Use SPENVIS.", "state": "broken" },
  "reach": { "maxPassMin": 7.4, "lightTimeZenithMs": 1.67, "state": "broken" },
  "binding": "power"
}
```

### Philosophy gates

**Move the orbit, not a spreadsheet.** The brief talks about the orbit on the diagram and the tiles beside it. **Not done if** the reply tells her to edit a table, or the panel is the top of the page.

**Four promises, one killer.** The first sentence names `binding` and uses figures from that promise. **Not done if** the brief announces a score, or names a different killer than `binding`.

**Every number wears its model.** The checker rejects a reply that introduces a figure. The rejection is on the panel, not only in the server log. **Not done if** an extra number is shown as though the page had computed it.

**A ridge, not a pin.** The prompt and the checker treat a recommended coordinate as a failure. The canned path covers a fabricated dose. **Not done if** the brief can say the best orbit, the best altitude, or an optimal point and still display that sentence as the answer.

**The pitch orbit and the flown orbit stay on screen together.** When `ghost` is non-null, the prompt requires a comparison of the two records. **Not done if** the brief describes only one orbit while both are on the diagram, or invents a third orbit.

**Stop at the door of SPENVIS.** The question `when does the Starmind chip die?` produces a refusal, in the brief, pointing at SPENVIS (or at the survival tile’s refusal). It does not produce a year, a krad, or a wear percentage. **Not done if** the reply adds a lifetime or a dose that was not already the citation string.

**Instruments first, voice second.** Unplugging the route leaves a working navigator and a collapsed or failed brief. The home view is the diagram plus one question, not a transcript. **Not done if** the route computes eclipse, area, or beta, or the page will not render without a successful model call.

**An instrument, not a landing page.** The brief uses the same type, tokens, and status badge as the tiles. **Not done if** the brief is a chat bubble column, a hero, or a second page.

---

## Phase 4 — Demo gate

**What is being built.** The three lanes on one deployed URL, checked against the four-minute demo. This phase wires and fixes. It does not add a feature.

**Owns.** Whichever of the files above must change to connect the page to `evaluate` and to `/api/brief`. No new routes. No new promises.

**Done.** All four philosophy blocks below pass on the deployed build, and the physics tests pass. One person who did not write the lane being checked walks this script:

1. Open on dawn-dusk sun-synchronous. Power holds. Heat shows a lower-bound area she can react to (about 1.9 m²/kW at the defaults). Reach breaks on interactive inference. Flip to bulk training: reach changes its mind, and the eclipse fraction and the area do not change. Survival shows the citation and will not turn it into a chip lifetime.
2. Press Rideshare. The previous orbit stays on the diagram. On the worst day the shadow covers about a third of the orbit. Power is the killer. The brief says the continuous-sun claim does not survive this inclination, using the eclipse figure on the tile.
3. Drag altitude up until the survival tile refuses, and stop at the belt sentence. Say that a radiation code would start here and that this page will not fake one.
4. Ask `what should I move?` The brief points at local time and at the workload switch, using numbers already on screen.
5. Press `Show a rejected reply`. The panel shows the failure sentence, not the canned `2 krad` as a result.
6. Ask `when does the Starmind chip die?` Both the survival tile (off the reference, or the citation’s own limit on the reference) and the brief refuse.

**Out of this phase.** The ridge chart, chip-wear models, dose interpolation, dollar costs, accounts, a 3D Earth, saved missions, a constellation.

**Hard dependency.** Phase 1, Phase 2, and Phase 3 are merged. There is nothing to run in parallel with the gate except bug fixes those lanes make when the script fails.

### Philosophy gates

**Move the orbit, not a spreadsheet.** During the script, the orbit, the shadow, and beta move when she changes presets and altitude. The diagram dominates the screen from the judge’s bench. **Not done if** she has to read a table to see which orbit she is on.

**Four promises, one killer.** Step 1’s killer is reach. After the workload flip, no promise is the killer. Step 2’s killer is power, even though survival and reach are also broken. **Not done if** two killers are marked, or a composite score appears.

**Every number wears its model.** Dawn-dusk and rideshare figures on screen match `npm test` for those inputs. The rideshare worst-day eclipse is about 38%. Each tile’s model line is readable without a click. **Not done if** the UI and the test disagree, or a caption is missing.

**A ridge, not a pin.** The script moves from a pitch that holds power to a rideshare that breaks it. She sees a passage and a wall. **Not done if** any control or sentence names an optimal orbit.

**The pitch orbit and the flown orbit stay on screen together.** From step 2 through step 3, both orbits are on the diagram, and the brief compares them in step 2. **Not done if** the ghost disappears when the brief loads or when altitude is dragged.

**Stop at the door of SPENVIS.** Step 3 ends on a designed refusal that names SPENVIS and the belts. Step 6 refuses a chip lifetime. No slider position except the unmodified dawn-dusk preset shows 150 rad(Si)/year. **Not done if** a dragged altitude produces a dose, including a dose “between” published points.

**Instruments first, voice second.** With the brief request blocked, steps 1 through 3 still work. **Not done if** a failed or slow model call blanks the tiles or the diagram.

**An instrument, not a landing page.** The deployed page is the dark instrument: 3rok type, one solid `Ask Grok`, status words with shapes, no hero and no globe. **Not done if** the demo opens on a marketing page, a chip map, or a 3D Earth.

---

## Not in any phase

Do not start these in parallel with the lanes above. Do not add them in Phase 4 even if the script already passes.

- A learned model, a wear model, or a fine-tune that imitates one.
- Dollar costs, launch price, or a dollars-per-kilogram field.
- Accounts, saved missions, teams.
- A 3D Earth or a globe.
- A dose lookup or any interpolation between published doses.
- The ridge chart (altitude against local solar time, cells colored by which promise breaks). It is the right feature after this demo is solid. It is not staffed here. A cell colored by chip life, or a pin on the best cell, fails the product even later. Do not use `PlacementMap` or the thermal scale for it.

## How you know the build is honest

- Every figure on the dawn-dusk and rideshare presets matches a unit test of `evaluate`.
- The rideshare worst-case eclipse at 500 km is about 38%. If the UI says 5% or 70%, the formula is wrong.
- Unplugging Grok leaves a working navigator.
- Asking when the Starmind chip dies produces a refusal on the tile and in the brief.
