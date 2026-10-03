# @3rok/cesium-plugin

A Cesium globe for a host application: orbit track, trapped-flux overlay, and a moving satellite. This package does not import a physics engine or a design system. The host passes data, colors, and — when it wants live scores — a client that speaks the JSON contract below.

## Host requirements

Peer dependencies: React 18, React DOM, Cesium 1.120+.

The host must expose Cesium's static `Workers`, `Assets`, and `Widgets` (set `CESIUM_BASE_URL` before the library loads). In Vite, `vite-plugin-cesium` does that. Import Cesium's widget stylesheet once in the host:

```ts
import "cesium/Build/Cesium/Widgets/widgets.css";
```

Imagery, in order:

1. If `ionToken` is set (`VITE_CESIUM_ION_TOKEN` in the 3rok app), Cesium ion World Imagery.
2. Otherwise Cesium's bundled Natural Earth II tiles. No ion token required.
3. If those tiles fail to load, a bare ellipsoid. The track still draws.

## Globe

The parent needs a height and `position: relative`. `<Globe />` fills it and destroys the viewer on unmount. Default Cesium widgets (timeline, animation, base-layer picker, geocoder, home, scene mode, help, fullscreen, info box, selection) are not created.

```tsx
import { Globe, groundTrack, ssoInclinationDeg, WGS84_EARTH } from "@3rok/cesium-plugin";

const inclination = ssoInclinationDeg(800, WGS84_EARTH);
const track = groundTrack(800, inclination, { earth: WGS84_EARTH });

const css = getComputedStyle(document.documentElement);
const color = (name: string) => css.getPropertyValue(name).trim();

<Globe
  track={track}
  fluxGrid={grid}
  playing={playing}
  ionToken={import.meta.env.VITE_CESIUM_ION_TOKEN}
  theme={{
    background: color("--surface-100"),
    ink: color("--ink"),
    accent: color("--accent"),
    thermal: [
      color("--thermal-1"),
      color("--thermal-2"),
      color("--thermal-3"),
      color("--thermal-4"),
      color("--thermal-5"),
    ],
  }}
/>
```

`thermal` runs from cool (low flux) to hot (high flux). Cesium needs resolved color strings, not `var()` references.

`groundTrack` is a display helper (circular Kepler track plus Earth rotation). It takes Earth constants so the host can feed numbers from its parameter service. `WGS84_EARTH` is the fallback.

## Physics client

`useEngineData(client, config)` debounces the config and calls the host client. It does not know a URL. A previous result stays on screen while the next request is in flight.

```ts
import type { PhysicsClient } from "@3rok/cesium-plugin";

const client: PhysicsClient = {
  evaluate: (config, signal) =>
    fetch("/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
      signal,
    }).then((res) => res.json()),
  optimize: (signal) => fetch("/api/optimize", { signal }).then((res) => res.json()),
  saaGrid: (query, signal) => fetch("/api/saa-grid", { signal }).then((res) => res.json()),
  track: (config, signal) =>
    fetch(`/api/track?altitude_km=${config.altitude_km}&inclination=${config.inclination}`, {
      signal,
    }).then((res) => res.json()),
};
```

### Contract

`MissionConfig` in:

| Field | Meaning |
|---|---|
| `altitude_km` | Geometric altitude, km |
| `inclination` | `"sso"` or degrees |
| `ltan_hours` | Local time of ascending node, hours |
| `shield_mm_Al` | Aluminum thickness, mm |
| `radiator_area_m2` | `null` to size it, or a fixed area |
| `chip_id` / `chip_preset` | Part id, or `commercial` / `rad_hard` |
| `solar_phase` | `0` solar min … `1` solar max |
| `load_strategy` | `constant` or `load_follow_sun` |

`EvalResult` out (derived estimate, not a measurement): `lifetime_years`, `mean_power_kW`, `radiator_area_m2`, `shield_mass_kg`, `limiting_mode`, `value_status`, `assumptions_note`, and `orbit`, `dose`, `seu`, `thermal`, `power`, `breakdown`. Non-finite numbers are `null`.

`FluxGrid` out: `lat_deg`, `lon_deg`, `flux_cm2_s` (rows × columns, `null` if the model cell is empty), optional `flux_cm2_s_max`, `altitude_km`, `particle`, `energy_MeV`, `solar`.

`ParetoPayload` out: `pareto_front[]` with `config`, `lifetime_years`, `mean_power_kW`, `shielding_cost`. Optional `evaluated` cloud and `disclaimer`.

`Track`: `lat_deg`, `lon_deg`, `alt_km` (number or per-sample array), `times_s` seconds from `epoch_utc`.

`OemEvaluation`: `{ result, track, disclaimer }` when the host implements `evaluateOem(file, config)`.

## Build

```bash
npm install
npm run typecheck
npm run build
```

`dist/` is the publishable ESM bundle plus `index.d.ts`. Cesium and React stay external.
