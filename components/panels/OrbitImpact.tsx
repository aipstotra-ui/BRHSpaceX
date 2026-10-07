"use client";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { useImpactStore } from "@/components/home/impactStore";
import type { UpsetKind } from "@/lib/engine/chipModel";
import type { OrbitImpactResult } from "@/lib/engine/orbitImpact";
import type { RangeValue } from "@/lib/engine/orbit/range";
import type { SourceLabel } from "@/lib/types";

/** Row title for the upset rate: raw bit flips, or ECC-uncorrectable errors for DRAM. */
export function upsetTitle(kind: UpsetKind): string {
  return kind === "uncorrectable" ? "Uncorrectable memory errors" : "Upset rate";
}

export function formatNumber(value: number, digits: number): string {
  return Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 1e-3) ? value.toExponential(2) : value.toFixed(digits);
}

export function Num({
  value,
  digits,
  label,
  unit,
  testId,
}: {
  value: number;
  digits: number;
  label: SourceLabel;
  unit: string;
  testId?: string;
}) {
  return (
    <span data-orbit-number data-testid={testId} className="num">
      {formatNumber(value, digits)}
      {unit ? <span className="num__unit"> {unit}</span> : null} <SourceBadge label={label} />
    </span>
  );
}

const ROWS: {
  title: string;
  key: keyof Pick<
    OrbitImpactResult,
    | "upsetRate"
    | "annualDose"
    | "tidYears"
    | "dragYears"
    | "saaFraction"
    | "auroralFraction"
    | "outerBeltFraction"
    | "eclipseFraction"
  >;
  digits: number;
  testId?: string;
}[] = [
  { title: "Upset rate", key: "upsetRate", digits: 3, testId: "upset-mid" },
  { title: "Annual dose", key: "annualDose", digits: 4, testId: "dose-mid" },
  { title: "Time to TID", key: "tidYears", digits: 2 },
  { title: "Drag decay", key: "dragYears", digits: 2, testId: "drag-mid" },
  { title: "SAA fraction", key: "saaFraction", digits: 4 },
  { title: "Auroral fraction", key: "auroralFraction", digits: 4 },
  { title: "Outer-belt fraction", key: "outerBeltFraction", digits: 4 },
  { title: "Eclipse fraction", key: "eclipseFraction", digits: 4, testId: "eclipse-mid" },
];

function BandRow({ title, value, digits, testId }: { title: string; value: RangeValue; digits: number; testId?: string }) {
  return (
    <tr>
      <th scope="row">{title}</th>
      <td className="rok-num">
        <Num value={value.low} digits={digits} label={value.label} unit={value.unit} />
      </td>
      <td className="rok-num">
        <Num value={value.mid} digits={digits} label={value.label} unit={value.unit} testId={testId} />
      </td>
      <td className="rok-num">
        <Num value={value.high} digits={digits} label={value.label} unit={value.unit} />
      </td>
    </tr>
  );
}

export function OrbitImpact() {
  const phase = useImpactStore((state) => state.phase);
  const result = useImpactStore((state) => state.result);
  const workerMs = useImpactStore((state) => state.workerMs);

  if (phase === "empty") {
    return <p className="body rok-muted">Empty</p>;
  }
  if (phase === "error") {
    return (
      <p className="body error">
        Error
      </p>
    );
  }
  if (!result) {
    return <p className="body rok-muted">Loading</p>;
  }

  return (
    <div className="body stack">
      <p className="note">orbit-averaged; multi-year values use climatology (M7), not the short-term forecaster</p>
      <p data-testid="binding">
        Binding limit: {result.binding}. Lifetime{" "}
        <Num value={result.lifetimeYears.mid} digits={2} label={result.lifetimeYears.label} unit="yr" testId="lifetime-mid" />
      </p>
      <div className="table-scroll">
        <table className="rok-table">
          <caption className="sr-only">Orbit impact ranges</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col" className="rok-num">
                Low
              </th>
              <th scope="col" className="rok-num">
                Mid
              </th>
              <th scope="col" className="rok-num">
                High
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <BandRow
                key={row.key}
                title={row.key === "upsetRate" ? upsetTitle(result.upsetKind) : row.title}
                value={result[row.key]}
                digits={row.digits}
                testId={row.testId}
              />
            ))}
          </tbody>
        </table>
      </div>
      {result.thermalKnown ? (
        <p>
          Thermal margin <Num value={result.thermalMarginC.mid} digits={2} label={result.thermalMarginC.label} unit="°C" />.
          Eclipse fraction is shown beside it and does not change the M4 temperature.
        </p>
      ) : (
        <p className="rok-muted">Thermal margin: not computed. Average power, radiator area, or the temperature limit is not given.</p>
      )}
      <p>
        Shielding <Num value={result.shieldingMmAl.mid} digits={2} label={result.shieldingMmAl.label} unit="mm Al" />.{" "}
        {result.shieldingMmAl.assumptions[0]}
      </p>
      <h3 className="heading-sm">Storm sensitivity</h3>
      <div className="table-scroll">
        <table className="rok-table">
          <caption className="sr-only">Change in upsets and drag lifetime by storm level</caption>
          <thead>
            <tr>
              <th scope="col">Storm</th>
              <th scope="col" className="rok-num">
                Kp
              </th>
              <th scope="col" className="rok-num">
                {result.upsetKind === "uncorrectable" ? "Extra uncorrectable errors" : "Extra upsets"}
              </th>
              <th scope="col" className="rok-num">
                Drag life used per storm day
              </th>
              <th scope="col" className="rok-num">
                In auroral oval
              </th>
              <th scope="col" className="rok-num">
                Open to solar protons
              </th>
            </tr>
          </thead>
          <tbody>
            {result.storms.map((storm) => (
              <tr key={storm.level}>
                <th scope="row">{storm.level}</th>
                <td className="rok-num">
                  <Num value={storm.kp} digits={0} label="source" unit="" />
                </td>
                <td className="rok-num">
                  <Num value={storm.deltaUpsetPerS.mid} digits={3} label="estimate" unit="1/s" />
                </td>
                <td className="rok-num">
                  <Num value={storm.dragDaysPerStormDay.mid} digits={1} label="estimate" unit="days" />
                </td>
                <td className="rok-num">
                  <Num value={storm.auroralShare * 100} digits={1} label="estimate" unit="%" />
                </td>
                <td className="rok-num">
                  <Num value={storm.sepShare * 100} digits={1} label="estimate" unit="%" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Oval and proton shares are the share of the orbit inside the Kp-dependent auroral oval and poleward of the
        solar-proton cutoff. The proton share only matters during an S1+ proton event. Quiet (Kp 2):{" "}
        <Num value={result.quietAuroralShare * 100} digits={1} label="estimate" unit="%" /> in the oval,{" "}
        <Num value={result.quietSepShare * 100} digits={1} label="estimate" unit="%" /> open to protons.
      </p>
      <p className="note">
        Worker time{" "}
        {workerMs === null ? null : <Num value={workerMs} digits={1} label="estimate" unit="ms" testId="worker-ms" />}
      </p>
    </div>
  );
}
