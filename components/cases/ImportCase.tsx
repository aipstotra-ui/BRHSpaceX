"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import "@/components/cases/cases.css";
import { useCaseListing } from "@/lib/cases/hooks";
import { getPreset } from "@/lib/presets";

/** Pick one of the saved cases and open it on the testing page. It never saves anything. */
export function ImportCase({ currentId }: { currentId: string | null }) {
  const listing = useCaseListing();
  const router = useRouter();
  const [chosen, setChosen] = useState("");
  const cases = listing?.cases ?? [];
  const value = chosen !== "" ? chosen : (currentId ?? cases[0]?.id ?? "");

  return (
    <details className="advanced">
      <summary className="eyebrow">Import case</summary>
      {listing === null ? (
        <p role="status" className="body-sm rok-muted">
          Loading cases
        </p>
      ) : null}
      {listing && cases.length === 0 ? (
        <p className="body-sm">
          You have no saved cases in this browser. <Link href="/cases">Create one</Link>
        </p>
      ) : null}
      {cases.length > 0 ? (
        <div className="stack">
          <label className="rok-field">
            <span className="rok-field__label eyebrow">Case</span>
            <select className="rok-field__input body" value={value} onChange={(event) => setChosen(event.target.value)}>
              {cases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {getPreset(item.inputs.chip.presetId).title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rok-btn rok-btn--sm button"
            disabled={value === ""}
            onClick={() => router.push(`/test?case=${encodeURIComponent(value)}`)}
          >
            Open case
          </button>
        </div>
      ) : null}
      {listing && listing.problems.length > 0 ? (
        <p role="alert" className="body-sm">
          {listing.problems.length === 1 ? listing.problems[0] : `${listing.problems.length} saved cases could not be read.`}
        </p>
      ) : null}
    </details>
  );
}
