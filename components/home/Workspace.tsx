"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface WorkspaceTab {
  id: string;
  label: string;
  hint: string;
  content: ReactNode;
}

export function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children?: ReactNode }) {
  const id = title.toLowerCase().replaceAll(" ", "-");
  return (
    <section className="rok-panel" aria-labelledby={id}>
      <p className="eyebrow rok-panel__eyebrow">{eyebrow}</p>
      <h2 id={id} className="heading-md rok-panel__title">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 3rok tabs with arrow-key navigation. Inactive panels stay mounted so their state survives a tab switch. */
export function Workspace({
  tabs,
  active,
  onChange,
}: {
  tabs: WorkspaceTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    let next = index;
    if (event.key === "ArrowRight") {
      next = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[tabs[next].id]?.focus();
  }

  const current = tabs.find((tab) => tab.id === active);

  return (
    <div className="workspace" id="workspace">
      <div className="rok-tabs workspace__tabs" role="tablist" aria-label="Analysis" onKeyDown={onKey}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            className="rok-tab button"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {current ? <p className="body-sm rok-muted workspace__hint">{current.hint}</p> : null}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
          className="workspace__panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
