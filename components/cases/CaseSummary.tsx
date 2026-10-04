"use client";

import Link from "next/link";

import "@/components/cases/cases.css";
import { Section } from "@/components/home/Workspace";
import { ImportCase } from "@/components/cases/ImportCase";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { orbitKind } from "@/lib/cases/format";
import { useCurrentInputs } from "@/lib/cases/hooks";
import { getPreset } from "@/lib/presets";

/**
 * What the testing page is flying, read only. The chip and orbit come from the stores, so a change
 * made on this page shows here too. Editing and saving happen on the case page.
 */
export function CaseSummary({ caseId, caseName }: { caseId: string | null; caseName: string | null }) {
  const inputs = useCurrentInputs();
  const chip = getPreset(inputs.chip.presetId);
  return (
    <Section title="Case" eyebrow="Inputs">
      <dl className="case-facts">
        <div>
          <dt className="eyebrow rok-subtle">Name</dt>
          <dd className="body">{caseName ?? "Default demo case"}</dd>
        </div>
        <div>
          <dt className="eyebrow rok-subtle">Chip</dt>
          <dd className="body">{chip.title}</dd>
        </div>
        <div>
          <dt className="eyebrow rok-subtle">Orbit</dt>
          <dd className="data-sm">{orbitKind(inputs.orbit)}</dd>
        </div>
        <div>
          <dt className="eyebrow rok-subtle">Altitude</dt>
          <dd className="data-sm">
            {inputs.orbit.altitudeKm.toFixed(0)} KM <SourceBadge label="estimate" />
          </dd>
        </div>
        <div>
          <dt className="eyebrow rok-subtle">Inclination</dt>
          <dd className="data-sm">
            {inputs.orbit.inclinationDeg.toFixed(1)}° <SourceBadge label="estimate" />
          </dd>
        </div>
      </dl>
      <div className="stack">
        {caseId ? (
          <Link className="rok-btn rok-btn--sm button" href={`/cases/${encodeURIComponent(caseId)}`}>
            Edit case
          </Link>
        ) : (
          <Link className="rok-btn rok-btn--sm button" href="/cases">
            Open cases
          </Link>
        )}
        <ImportCase currentId={caseId} />
      </div>
    </Section>
  );
}
