"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import "@/components/cases/cases.css";
import "@/components/home/home.css";
import { defaultInputs } from "@/lib/cases/defaults";
import { newCaseId, orbitLine, utcMinute } from "@/lib/cases/format";
import { useCaseListing } from "@/lib/cases/hooks";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { newCase } from "@/lib/cases/ops";
import { CaseStoreError, getCaseStore } from "@/lib/cases/store";
import { getPreset } from "@/lib/presets";

export function CaseList() {
  const listing = useCaseListing();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  function create() {
    try {
      const doc = newCase({ id: newCaseId(), inputs: defaultInputs(), now: new Date() });
      getCaseStore().save(doc);
      router.push(`/cases/${doc.id}`);
    } catch (problem) {
      setError(problem instanceof CaseStoreError ? problem.message : "The case could not be created.");
    }
  }

  function remove(id: string) {
    try {
      getCaseStore().remove(id);
      setConfirming(null);
      setError(null);
    } catch (problem) {
      setError(problem instanceof CaseStoreError ? problem.message : "The case could not be deleted.");
    }
  }

  const cases = listing?.cases ?? [];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow rok-subtle">Saved in this browser</p>
          <h1 className="heading-lg">Cases</h1>
        </div>
        <div className="page-actions">
          <button type="button" className="rok-btn rok-btn--solid button" onClick={create}>
            Create case
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="case-note body">
          <StatusBadge status="critical">Error</StatusBadge> {error}
        </p>
      ) : null}

      {listing === null ? (
        <p role="status" className="body rok-muted">
          Loading cases
        </p>
      ) : null}

      {listing && listing.problems.length > 0 ? (
        <div role="alert" className="case-note body">
          <StatusBadge status="caution">Unreadable</StatusBadge>
          <p className="eyebrow">Some saved cases could not be read</p>
          <ul>
            {listing.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {listing && cases.length === 0 && listing.problems.length === 0 ? (
        <p role="status" className="body">
          No cases yet. Create one to set a chip and an orbit, then send it to the testing page.
        </p>
      ) : null}

      {cases.length > 0 ? (
        <div className="case-table-wrap">
          <table className="rok-table case-table">
            <caption className="sr-only">Saved cases, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Chip</th>
                <th scope="col">Orbit</th>
                <th scope="col">Updated</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <Link className="case-name" href={`/cases/${item.id}`}>
                      {item.name}
                    </Link>
                  </th>
                  <td className="body">{getPreset(item.inputs.chip.presetId).title}</td>
                  <td className="data-sm">{orbitLine(item.inputs.orbit)}</td>
                  <td className="data-sm">{utcMinute(item.updatedAt)}</td>
                  <td>
                    <div className="case-row-actions">
                      <Link className="rok-btn rok-btn--sm button" href={`/test?case=${encodeURIComponent(item.id)}`}>
                        Open in testing
                      </Link>
                      {confirming === item.id ? (
                        <>
                          <span className="body-sm" role="alert">
                            Delete this case? This cannot be undone.
                          </span>
                          <button type="button" className="rok-btn rok-btn--sm button" onClick={() => remove(item.id)}>
                            Delete case
                          </button>
                          <button
                            type="button"
                            className="rok-btn rok-btn--quiet"
                            onClick={() => setConfirming(null)}
                          >
                            Keep case
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="rok-btn rok-btn--quiet"
                          onClick={() => setConfirming(item.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
