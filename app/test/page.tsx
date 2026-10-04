"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useLayoutEffect, useRef, useState } from "react";

import "@/components/cases/cases.css";
import "@/components/home/home.css";
import { CaseSummary } from "@/components/cases/CaseSummary";
import { useOrbitImpactRunner } from "@/components/home/impactStore";
import { AiAnalysis } from "@/components/home/AiAnalysis";
import { Timeline } from "@/components/home/Timeline";
import { TopBar } from "@/components/home/TopBar";
import { Verdict } from "@/components/home/Verdict";
import { Section, Workspace, type WorkspaceTab } from "@/components/home/Workspace";
import { AIForecast } from "@/components/panels/AIForecast";
import { BestMove } from "@/components/panels/BestMove";
import { Copilot } from "@/components/panels/Copilot";
import { OrbitImpact } from "@/components/panels/OrbitImpact";
import { OrbitLocation } from "@/components/panels/OrbitLocation";
import { OrbitOptimizer } from "@/components/panels/OrbitOptimizer";
import { PayloadHealth } from "@/components/panels/PayloadHealth";
import { SpaceEnvironment } from "@/components/panels/SpaceEnvironment";
import { StormScenario } from "@/components/panels/StormScenario";
import { TimeMachine } from "@/components/panels/TimeMachine";
import { SnapshotFeedStatus, useFeedPhase } from "@/components/ui/SnapshotBanner";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { defaultInputs } from "@/lib/cases/defaults";
import { useCase, useCurrentInputs, type CaseLookup } from "@/lib/cases/hooks";
import { sameInputs } from "@/lib/cases/ops";
import { applyInputs } from "@/lib/cases/snapshot";

const TABS: WorkspaceTab[] = [
  {
    id: "risk",
    label: "Orbit risk",
    hint: "Every number behind the outlook: low, mid and high ranges, and what each storm level adds.",
    content: (
      <Section title="Orbit Impact" eyebrow="Ranges">
        <OrbitImpact />
      </Section>
    ),
  },
  {
    id: "chip",
    label: "Chip",
    hint: "How each tile of the payload holds up. The chip itself is set on the case page.",
    content: (
      <Section title="Payload Health" eyebrow="Tiles">
        <PayloadHealth />
      </Section>
    ),
  },
  {
    id: "optimize",
    label: "Best orbit",
    hint: "Rank candidate orbits for this chip using storm history (climatology), then move Starmind there.",
    content: (
      <Section title="Orbit Optimizer" eyebrow="Climatology">
        <OrbitOptimizer />
      </Section>
    ),
  },
  {
    id: "weather",
    label: "Space weather",
    hint: "The next 24 hours of geomagnetic activity, what the payload should do now, and what-if storms.",
    content: (
      <>
        <Section title="AI Forecast" eyebrow="Next 24 h">
          <AIForecast />
        </Section>
        <Section title="Best Move" eyebrow="Policy">
          <BestMove />
        </Section>
        <Section title="Storm Scenario" eyebrow="What-if">
          <StormScenario />
        </Section>
      </>
    ),
  },
  {
    id: "replay",
    label: "May 2024 replay",
    hint: "Replay the May 2024 superstorm hour by hour on the chosen orbit.",
    content: (
      <Section title="Time Machine" eyebrow="Test period">
        <TimeMachine />
      </Section>
    ),
  },
];

/**
 * Fly a saved case, or the default demo case when none is named. The inputs go into the two input
 * stores before the first paint; the panels read them from there.
 */
function useFlownCase(lookup: CaseLookup) {
  const loaded = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (lookup.status === "loading") {
      return;
    }
    const key = lookup.status === "ready" ? lookup.doc.id : "demo";
    if (loaded.current === key) {
      return;
    }
    loaded.current = key;
    applyInputs(lookup.status === "ready" ? lookup.doc.inputs : defaultInputs());
  }, [lookup]);
}

function CaseBanner({ caseId, lookup }: { caseId: string | null; lookup: CaseLookup }) {
  const current = useCurrentInputs();
  const base = lookup.status === "ready" ? lookup.doc.inputs : defaultInputs();
  const changed = lookup.status !== "loading" && !sameInputs(current, base);

  if (lookup.status === "loading") {
    return (
      <p role="status" className="case-banner body-sm">
        Loading the case
      </p>
    );
  }
  return (
    <div role="status" className="case-banner body-sm">
      {lookup.status === "ready" ? (
        <>
          <span className="eyebrow">Case</span>
          <Link className="case-banner__name" href={`/cases/${encodeURIComponent(lookup.doc.id)}`}>
            {lookup.doc.name}
          </Link>
        </>
      ) : caseId !== null ? (
        <>
          <StatusBadge status="caution">Not found</StatusBadge>
          <span>That address does not name a case saved in this browser. Showing the default demo case.</span>
          <Link href="/test">Back to the demo</Link>
        </>
      ) : (
        <>
          <span className="eyebrow">Default demo case</span>
          <span>Its inputs are a starting point, not a flight plan.</span>
          <Link href="/cases">Create a case</Link>
        </>
      )}
      {changed ? (
        <>
          <StatusBadge status="caution">Changed</StatusBadge>
          <span>This page differs from the saved case. The saved case is unchanged.</span>
        </>
      ) : null}
    </div>
  );
}

function TestScreen() {
  useOrbitImpactRunner();
  const router = useRouter();
  const feed = useFeedPhase();
  const [tab, setTab] = useState(TABS[0].id);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const caseId = useSearchParams().get("case");
  const lookup = useCase(caseId);
  useFlownCase(lookup);
  const flownId = lookup.status === "ready" ? lookup.doc.id : null;

  return (
    <div className="app">
      <TopBar
        feed={feed}
        copilotOpen={copilotOpen}
        onCopilot={() => setCopilotOpen((open) => !open)}
        onChangeChip={() => router.push(flownId ? `/cases/${encodeURIComponent(flownId)}` : "/cases")}
      />
      <SnapshotFeedStatus phase={feed} />
      <CaseBanner caseId={caseId} lookup={lookup} />
      <main className="cockpit">
        <div className="cockpit__hero">
          <Section title="Space Environment" eyebrow="Live orbit">
            <SpaceEnvironment />
          </Section>
          <Verdict />
        </div>
        <Timeline />
        <AiAnalysis />
        <div className="cockpit__bench">
          <div className="cockpit__controls">
            <CaseSummary caseId={flownId} caseName={lookup.status === "ready" ? lookup.doc.name : null} />
            <Disclosure title="Adjust orbit for this test" className="test-adjust">
              <p className="body-sm rok-muted">Changes here apply to this page only. The saved case is not changed.</p>
              <Section title="Orbit Location" eyebrow="Controls">
                <OrbitLocation />
              </Section>
            </Disclosure>
          </div>
          <Workspace tabs={TABS} active={tab} onChange={setTab} />
        </div>
      </main>
      <aside
        id="copilot-drawer"
        className="drawer"
        aria-label="Grok copilot"
        hidden={!copilotOpen}
      >
        <Copilot />
      </aside>
    </div>
  );
}

export default function TestPage() {
  return (
    <Suspense fallback={null}>
      <TestScreen />
    </Suspense>
  );
}
