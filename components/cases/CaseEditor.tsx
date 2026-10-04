"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import "@/components/cases/cases.css";
import "@/components/home/home.css";
import { Section } from "@/components/home/Workspace";
import { ChipSpecStudio } from "@/components/panels/ChipSpecStudio";
import { OrbitLocation } from "@/components/panels/OrbitLocation";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { utcMinute } from "@/lib/cases/format";
import { useCase, useCurrentInputs } from "@/lib/cases/hooks";
import { logExport, renameCase, sameInputs, saveInputs } from "@/lib/cases/ops";
import type { CaseDoc } from "@/lib/cases/schema";
import { applyInputs, captureInputs } from "@/lib/cases/snapshot";
import { CaseStoreError, getCaseStore } from "@/lib/cases/store";

export function CaseEditor({ id }: { id: string }) {
  const lookup = useCase(id);

  if (lookup.status === "loading") {
    return (
      <p role="status" className="body rok-muted">
        Loading the case
      </p>
    );
  }
  if (lookup.status === "missing") {
    return (
      <>
        <p role="status" className="case-note body">
          <StatusBadge status="caution">Not found</StatusBadge> This case is not saved in this browser. Cases are kept in the browser that made them.
        </p>
        <div className="page-actions">
          <Link className="rok-btn button" href="/cases">
            Back to cases
          </Link>
        </div>
      </>
    );
  }
  return <EditorBody key={lookup.doc.id} doc={lookup.doc} />;
}

function EditorBody({ doc }: { doc: CaseDoc }) {
  const router = useRouter();
  const current = useCurrentInputs();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(doc.name);
  const loaded = useRef(false);

  // The input stores hold what the panels edit. Put this case in them before the first paint.
  useLayoutEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      applyInputs(doc.inputs);
    }
  }, [doc]);

  const dirty = !sameInputs(current, doc.inputs);

  function persist(next: CaseDoc): boolean {
    try {
      getCaseStore().save(next);
      setError(null);
      return true;
    } catch (problem) {
      setError(problem instanceof CaseStoreError ? problem.message : "The case could not be saved.");
      return false;
    }
  }

  function save() {
    const next = saveInputs(doc, captureInputs(), new Date());
    if (next !== doc) {
      persist(next);
    }
  }

  function exportToTesting() {
    const now = new Date();
    const sent = logExport(saveInputs(doc, captureInputs(), now), now);
    // Nothing is sent unless the save worked: no export is silent.
    if (persist(sent)) {
      router.push(`/test?case=${encodeURIComponent(sent.id)}`);
    }
  }

  function rename() {
    const next = renameCase(doc, draft, new Date());
    if (next === doc || persist(next)) {
      setRenaming(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow rok-subtle">Case</p>
          <h1 className="heading-lg">{doc.name}</h1>
          <p className="body-sm rok-muted">
            Updated <span className="data-sm">{utcMinute(doc.updatedAt)}</span>
          </p>
        </div>
        <div className="page-actions">
          <Link className="rok-btn rok-btn--quiet" href="/cases">
            Back to cases
          </Link>
          <button
            type="button"
            className="rok-btn rok-btn--sm button"
            aria-expanded={renaming}
            onClick={() => {
              setDraft(doc.name);
              setRenaming((open) => !open);
            }}
          >
            Rename
          </button>
          <button type="button" className="rok-btn button" disabled={!dirty} onClick={save}>
            Save case
          </button>
          <button type="button" className="rok-btn rok-btn--solid button" onClick={exportToTesting}>
            Export to testing
          </button>
        </div>
      </header>

      {renaming ? (
        <form
          className="case-rename"
          onSubmit={(event) => {
            event.preventDefault();
            rename();
          }}
        >
          <label className="rok-field">
            <span className="rok-field__label eyebrow">Case name</span>
            <input
              className="rok-field__input body"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" className="rok-btn rok-btn--sm button">
            Save name
          </button>
          <button type="button" className="rok-btn rok-btn--quiet" onClick={() => setRenaming(false)}>
            Cancel
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="case-note body">
          <StatusBadge status="critical">Not saved</StatusBadge> {error}
        </p>
      ) : null}
      {dirty ? (
        <p role="status" className="case-note body">
          <StatusBadge status="caution">Unsaved</StatusBadge> Your edits are not saved yet. Export to testing saves them first.
        </p>
      ) : null}

      <div className="case-grid">
        <Section title="Chip Spec Studio" eyebrow="Payload">
          <ChipSpecStudio initial={doc.inputs.chip} />
        </Section>
        <div className="case-stack">
          <Section title="Orbit Location" eyebrow="Controls">
            <OrbitLocation />
          </Section>
          <Disclosure
            title="Activity"
            meta={
              <span className="body-sm">
                {doc.log.length} {doc.log.length === 1 ? "entry" : "entries"}, last{" "}
                <span className="data-sm">{utcMinute(doc.log[doc.log.length - 1]?.at ?? doc.updatedAt)}</span>
              </span>
            }
          >
            <ol className="case-log body-sm">
              {doc.log.map((item) => (
                <li key={`${item.at}-${item.kind}`}>
                  <time className="data-sm" dateTime={item.at}>
                    {utcMinute(item.at)}
                  </time>{" "}
                  {item.text}
                </li>
              ))}
            </ol>
          </Disclosure>
        </div>
      </div>
    </>
  );
}
