"use client";

export interface Layers {
  saa: boolean;
  aurora: boolean;
  protons: boolean;
  track: boolean;
  starlink: boolean;
}

export const DEFAULT_LAYERS: Layers = { saa: true, aurora: true, protons: true, track: true, starlink: true };

const ROWS: { key: keyof Layers; label: string; swatch: string; source: string }[] = [
  {
    key: "saa",
    label: "SAA",
    swatch: "#f2465e",
    source:
      "AP8MIN trapped protons above 10 MeV at the orbit altitude (IRBEM, 2025 field). Edge at 10 /cm²/s, a display choice matched to the Fermi GBM SAA boundary.",
  },
  {
    key: "aurora",
    label: "Auroral oval",
    swatch: "#3ddc97",
    source:
      "Kp band in centred-dipole magnetic latitude (Gussenhoven et al. 1983 fit, rounded). Live OVATION nowcast at the latest observed block.",
  },
  {
    key: "protons",
    label: "Proton cap",
    swatch: "#ff5fd2",
    source: "Poleward of the ~10 MeV cutoff, 65° − Kp magnetic latitude (after Leske et al. 2001). Drawn only during S1+ events.",
  },
  {
    key: "track",
    label: "Ground track",
    swatch: "#8fb4d6",
    source: "Last 1.5 orbits under the craft, colored by zone, fading with age.",
  },
  {
    key: "starlink",
    label: "Starlink",
    swatch: "#6fd3ff",
    source: "CelesTrak GP snapshot, SGP4, subsampled. Hidden in historical replays.",
  },
];

export function LayerToggles({ layers, onChange }: { layers: Layers; onChange: (layers: Layers) => void }) {
  return (
    <fieldset className="layer-toggles">
      <legend className="eyebrow rok-subtle">Layers</legend>
      {ROWS.map((row) => (
        <label key={row.key} className="layer-toggles__row" title={row.source}>
          <input
            type="checkbox"
            checked={layers[row.key]}
            onChange={(event) => onChange({ ...layers, [row.key]: event.target.checked })}
          />
          <span className="swatch" style={{ background: row.swatch }} aria-hidden="true" />
          <span className="body-sm">{row.label}</span>
        </label>
      ))}
      <details className="layer-toggles__sources">
        <summary className="eyebrow rok-subtle">Sources</summary>
        <dl className="note">
          {ROWS.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.source}</dd>
            </div>
          ))}
        </dl>
      </details>
    </fieldset>
  );
}
