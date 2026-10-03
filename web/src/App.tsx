import { useMemo, useState } from "react";
import { Globe } from "@3rok/cesium-plugin";
import type { ImageryMode, ParetoPoint } from "@3rok/cesium-plugin";
import { ParetoChart, SensitivityChart } from "./components/charts";
import { Tour } from "./components/Tour";
import { Button, DataTable, NavBar, Panel, RangeField, Stat, StatusBadge } from "./components/ui";
import { formatNumber, formatSci, modeLabel } from "./format";
import { readGlobeTheme } from "./theme";
import { useMission } from "./state/useMission";

const ASSUMPTIONS = [
  {
    tag: "A",
    text: "Lifetime is the minimum of TID, thermal fatigue, power, and SEU availability. It is a ranking under stated assumptions, not a failure prediction.",
  },
  {
    tag: "A",
    text: "TID uses an exponential aluminum dose-depth fallback, not SHIELDOSE-2.",
  },
  {
    tag: "S",
    text: "Commercial dose limit is 2 krad(Si) from the Google Trillium HBM test. It is not an Nvidia Rubin or Starmind specification.",
  },
  {
    tag: "S",
    text: "The rad-hard anchor is 200 krad(Si) from the BAE RAD750 CPU specification, not a GPU figure.",
  },
  {
    tag: "S",
    text: "Trapped flux is AE8/AP8. The map is protons above 10 MeV at 550 km, solar max. The track color samples that map.",
  },
  {
    tag: "A",
    text: "The synthetic track is Kepler plus Earth rotation, with no J2 RAAN drift. An uploaded OEM replaces that line. Eclipse and period still use the sliders.",
  },
  {
    tag: "S",
    text: "The search envelope is the filed range: 500–2000 km, about 30 degrees or sun-synchronous.",
  },
];

function lifeStatus(years: number | null, mode: string): "nominal" | "caution" | "critical" {
  if (years != null && (years <= 0 || mode === "radiator_capacity")) return "critical";
  if (years != null && years < 5) return "caution";
  return "nominal";
}

export function App() {
  const mission = useMission();
  const theme = useMemo(() => readGlobeTheme(), []);
  const [imagery, setImagery] = useState<ImageryMode | null>(null);
  const [tourRunning, setTourRunning] = useState(false);
  const [tourSession, setTourSession] = useState(0);
  const { config, result, link } = mission;
  const front = useMemo(
    () => (mission.pareto?.pareto_front ?? []).filter((point) => (point.lifetime_years ?? 0) > 0),
    [mission.pareto],
  );
  const bars = mission.sensitivity?.bars ?? [];

  const dose = result?.dose?.dose_rate_krad_Si_per_year;
  const seu = result?.seu;
  const thermal = result?.thermal;
  const breakdown = result?.breakdown;

  async function onOemFile(file: File | undefined) {
    if (!file) return;
    await mission.uploadOem(file, file.name);
  }

  async function loadSample() {
    const response = await fetch("/data/demo-leo.oem");
    if (!response.ok) {
      return;
    }
    const blob = await response.blob();
    await mission.uploadOem(blob, "demo-leo.oem");
  }

  const selection = front.find((point) => point.id === mission.selectedId);

  return (
    <div className="app" id="top">
      <NavBar
        brand="3rok"
        active="Testing"
        links={[{ label: "Testing", href: "#top" }]}
        action={
          <div className="nav-actions">
            <StatusBadge status={link === "live" ? "nominal" : "caution"}>
              {link === "live" ? "Live" : link === "scoring" ? "Scoring" : "Offline"}
            </StatusBadge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTourSession((current) => current + 1);
                setTourRunning(true);
              }}
            >
              Start tour
            </Button>
            <Button
              variant={tourRunning ? "ghost" : "solid"}
              size="sm"
              onClick={() => mission.setPlaying((value) => !value)}
            >
              {mission.playing ? "Pause path" : "Play path"}
            </Button>
          </div>
        }
      />

      <Tour
        key={tourSession}
        running={tourRunning}
        onRunning={setTourRunning}
        onAltitude={(km) => mission.patch({ altitude_km: km })}
        onToggleChip={mission.toggleChip}
        onPareto={(point: ParetoPoint) => mission.applyPareto(point)}
        pareto={front}
      />

      <main className="stage">
        <section className="globe-column" aria-label="Orbit globe">
          <div className="globe-stage">
            <Globe
              track={mission.track}
              fluxGrid={mission.saa}
              playing={mission.playing}
              theme={theme}
              ionToken={import.meta.env.VITE_CESIUM_ION_TOKEN || undefined}
              onImagery={setImagery}
            />
          </div>
          <footer className="globe-footer">
            <p className="body-sm rok-muted">
              {imagery === "ion"
                ? "Cesium ion World Imagery"
                : imagery === "ellipsoid"
                  ? "Ellipsoid only. Set VITE_CESIUM_ION_TOKEN or check Cesium assets."
                  : "Cesium Natural Earth II. Set VITE_CESIUM_ION_TOKEN for ion imagery."}
              {mission.oemName ? ` · OEM ${mission.oemName}` : " · Synthetic track"}
            </p>
            <p className="data-sm">
              {formatNumber(result?.lifetime_years, 2)} YR · {formatNumber(dose, 3)} KRAD/YR
            </p>
          </footer>
        </section>

        <aside className="side">
          {link === "offline" ? (
            <p className="banner banner--caution body-sm">
              Physics API unreachable. Showing {mission.approximate ? "the nearest offline estimate" : "an offline estimate"}.
              The globe still draws.
            </p>
          ) : null}
          {mission.engineError && link === "offline" && !/failed to fetch|networkerror|load failed/i.test(mission.engineError) ? (
            <p className="banner body-sm">{mission.engineError}</p>
          ) : null}
          {mission.oemNote ? <p className="banner body-sm">{mission.oemNote}</p> : null}
          {mission.message ? <p className="banner banner--critical body-sm">{mission.message}</p> : null}

          <Panel eyebrow="Estimated" title="Mission">
            <p className="note body-sm">
              Scores come from starmind_physics.evaluate. Every number is derived. Chip limits are anchors, not a flown Starmind lifetime.
            </p>
            <div className="stack">
              <RangeField
                id="field-altitude"
                label="Altitude"
                min={500}
                max={2000}
                step={10}
                value={config.altitude_km}
                display={`${Math.round(config.altitude_km)} KM`}
                onChange={(altitude_km) => mission.patch({ altitude_km })}
              />
              <label className="rok-field" id="field-inclination">
                <span className="rok-field__label eyebrow">Inclination</span>
                <select
                  className="rok-field__input body"
                  value={config.inclination === "sso" ? "sso" : "30"}
                  onChange={(event) =>
                    mission.patch({
                      inclination: event.target.value === "sso" ? "sso" : 30,
                    })
                  }
                >
                  <option value="sso">Sun-synchronous</option>
                  <option value="30">30 degrees</option>
                </select>
              </label>
              <RangeField
                id="field-ltan"
                label="LTAN"
                min={0}
                max={24}
                step={0.5}
                value={config.ltan_hours}
                display={`${formatNumber(config.ltan_hours, 1)} H`}
                onChange={(ltan_hours) => mission.patch({ ltan_hours })}
              />
              <RangeField
                id="field-shield"
                label="Shielding"
                min={1}
                max={15}
                step={0.5}
                value={config.shield_mm_Al}
                display={`${formatNumber(config.shield_mm_Al, 1)} MM AL`}
                onChange={(shield_mm_Al) => mission.patch({ shield_mm_Al })}
              />
              <div className="row-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    mission.patch({
                      radiator_area_m2:
                        config.radiator_area_m2 == null
                          ? result?.radiator_area_m2 ?? 40
                          : null,
                    })
                  }
                >
                  {config.radiator_area_m2 == null ? "Fix radiator" : "Size radiator"}
                </Button>
              </div>
              <RangeField
                id="field-radiator"
                label="Radiator area"
                min={5}
                max={200}
                step={1}
                value={config.radiator_area_m2 ?? result?.radiator_area_m2 ?? 40}
                display={
                  config.radiator_area_m2 == null
                    ? "SIZED"
                    : `${formatNumber(config.radiator_area_m2, 0)} M2`
                }
                disabled={config.radiator_area_m2 == null}
                onChange={(radiator_area_m2) => mission.patch({ radiator_area_m2 })}
              />
              <label className="rok-field" id="field-chip">
                <span className="rok-field__label eyebrow">Chip</span>
                <select
                  className="rok-field__input body"
                  value={config.chip_id ?? ""}
                  onChange={(event) => {
                    const chip_id = event.target.value;
                    mission.patch({
                      chip_id,
                      chip_preset: chip_id === "bae_rad750" ? "rad_hard" : "commercial",
                    });
                  }}
                >
                  {mission.chips.length === 0 ? (
                    <>
                      <option value="google_trillium_tpu_v6e">Trillium commercial anchor</option>
                      <option value="bae_rad750">RAD750 rad-hard anchor</option>
                    </>
                  ) : (
                    mission.chips.map((chip) => (
                      <option key={chip.id} value={chip.id}>
                        {chip.vendor} {chip.product}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <RangeField
                id="field-solar"
                label="Solar phase"
                min={0}
                max={1}
                step={0.05}
                value={config.solar_phase ?? 1}
                display={formatNumber(config.solar_phase ?? 1, 2)}
                onChange={(solar_phase) => mission.patch({ solar_phase })}
              />
              <label className="rok-field">
                <span className="rok-field__label eyebrow">Load strategy</span>
                <select
                  className="rok-field__input body"
                  value={config.load_strategy ?? "constant"}
                  onChange={(event) =>
                    mission.patch({
                      load_strategy: event.target.value === "load_follow_sun" ? "load_follow_sun" : "constant",
                    })
                  }
                >
                  <option value="constant">Constant load</option>
                  <option value="load_follow_sun">Follow sun</option>
                </select>
              </label>
              <div className="row-actions">
                <Button variant="ghost" size="sm" onClick={() => document.getElementById("oem-file")?.click()}>
                  Load OEM
                </Button>
                <Button variant="quiet" onClick={() => void loadSample()}>
                  Load sample
                </Button>
                {mission.oemName ? (
                  <Button variant="quiet" onClick={mission.clearOem}>
                    Clear track
                  </Button>
                ) : null}
                <input
                  id="oem-file"
                  className="visually-hidden"
                  type="file"
                  accept=".oem,text/plain"
                  onChange={(event) => void onOemFile(event.target.files?.[0])}
                />
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Estimated" title="Readings">
            <Stat
              label="Lifespan"
              value={formatNumber(result?.lifetime_years, 2)}
              unit="YR"
              status={lifeStatus(result?.lifetime_years ?? null, result?.limiting_mode ?? "")}
            />
            <p className="note body-sm">Limiting mode {modeLabel(result?.limiting_mode)}. Value status derived.</p>
            <div className="stat-grid">
              <Stat compact label="Dose rate" value={formatNumber(dose, 3)} unit="KRAD/YR" />
              <Stat
                compact
                label="Dose limit"
                value={formatNumber(result?.dose?.dose_limit_krad_Si, 1)}
                unit="KRAD"
              />
              <Stat compact label="SEU events" value={formatSci(seu?.seu_events_per_day)} unit="/DAY" />
              <Stat
                compact
                label="Availability"
                value={seu ? formatNumber(seu.availability * 100, 2) : "—"}
                unit="%"
              />
              <Stat compact label="Thermal swing" value={formatNumber(thermal?.delta_T_K, 1)} unit="°C" />
              <Stat
                compact
                label="Thermal life"
                value={formatNumber(thermal?.lifetime_thermal_years, 1)}
                unit="YR"
              />
              <Stat compact label="Mean power" value={formatNumber(result?.mean_power_kW, 1)} unit="KW" />
              <Stat
                compact
                label="Radiator"
                value={formatNumber(result?.radiator_area_m2, 1)}
                unit="M2"
              />
              <Stat compact label="Shield mass" value={formatNumber(result?.shield_mass_kg, 1)} unit="KG" />
              <Stat
                compact
                label="Sunlight"
                value={formatNumber(
                  result?.orbit?.sunlight_fraction != null ? result.orbit.sunlight_fraction * 100 : null,
                  1,
                )}
                unit="%"
              />
            </div>
            {result?.dose?.dose_limit_provenance ? (
              <p className="note body-sm">Dose limit {result.dose.dose_limit_provenance}.</p>
            ) : null}
            {breakdown ? (
              <DataTable
                columns={[
                  { key: "mode", label: "Mode" },
                  { key: "years", label: "Years", numeric: true },
                ]}
                rows={[
                  { id: "tid", mode: "TID", years: formatNumber(breakdown.L_tid_years, 2) },
                  { id: "th", mode: "Thermal", years: formatNumber(breakdown.L_thermal_years, 2) },
                  { id: "pw", mode: "Power", years: formatNumber(breakdown.L_power_years, 2) },
                  { id: "seu", mode: "SEU", years: formatNumber(breakdown.L_seu_availability_years, 2) },
                ]}
              />
            ) : null}
          </Panel>

          <Panel id="pareto-panel" eyebrow="Ranking" title="Pareto front">
            <p className="note body-sm">
              Lifetime against mean power. Larger markers are a lower shield-mass plus radiator-area cost. Click a point to fly that case.
            </p>
            <ParetoChart payload={mission.pareto} onSelect={mission.applyPareto} />
            <p className="body-sm rok-muted">
              {selection
                ? `${selection.id ?? "Point"} · ${Math.round(selection.config.altitude_km)} KM · ${selection.config.inclination} · ${formatNumber(selection.lifetime_years, 2)} YR`
                : "No point selected."}
            </p>
          </Panel>

          <Panel id="sensitivity-panel" eyebrow="One at a time" title="Sensitivity">
            <p className="note body-sm">
              Change from the dawn-SSO 800 km, 5 mm, commercial baseline.
              {mission.sensitivity?.disclaimer ? ` ${mission.sensitivity.disclaimer}` : ""}
            </p>
            <SensitivityChart bars={bars} />
          </Panel>

          <Panel id="assumptions-panel" eyebrow="Labeled" title="Assumptions">
            <ul className="assumptions">
              {ASSUMPTIONS.map((item) => (
                <li key={item.tag + item.text} className="body-sm">
                  <span className="data-sm tag">[{item.tag}] </span>
                  {item.text}
                </li>
              ))}
            </ul>
            {result?.assumptions_note ? <p className="note body-sm">{result.assumptions_note}</p> : null}
          </Panel>
        </aside>
      </main>
    </div>
  );
}
