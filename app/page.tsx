"use client";

import { useState } from "react";

import "@/components/home/home.css";
import { useOrbitImpactRunner } from "@/components/home/impactStore";
import { TopBar } from "@/components/home/TopBar";
import { Verdict } from "@/components/home/Verdict";
import { Section, Workspace, type WorkspaceTab } from "@/components/home/Workspace";
import { AIForecast } from "@/components/panels/AIForecast";
import { BestMove } from "@/components/panels/BestMove";
import { ChipSpecStudio } from "@/components/panels/ChipSpecStudio";
import { Copilot } from "@/components/panels/Copilot";
import { OrbitImpact } from "@/components/panels/OrbitImpact";
import { OrbitLocation } from "@/components/panels/OrbitLocation";
import { OrbitOptimizer } from "@/components/panels/OrbitOptimizer";
import { PayloadHealth } from "@/components/panels/PayloadHealth";
import { SpaceEnvironment } from "@/components/panels/SpaceEnvironment";
import { StormScenario } from "@/components/panels/StormScenario";
import { TimeMachine } from "@/components/panels/TimeMachine";
import { SnapshotFeedStatus, useFeedPhase } from "@/components/ui/SnapshotBanner";

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
    hint: "Pick a chip preset or enter your own specs, then see how each tile of the payload holds up.",
    content: (
      <>
        <Section title="Chip Spec Studio" eyebrow="Payload">
          <ChipSpecStudio />
        </Section>
        <Section title="Payload Health" eyebrow="Tiles">
          <PayloadHealth />
        </Section>
      </>
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
  {
    id: "validation",
    label: "Validation",
    hint: "Every core number next to its published reference.",
    content: (
      <Section title="Validation Lab" eyebrow="Evidence">
        <p className="body rok-muted">Empty. The Validation Lab (M10) is not built yet.</p>
      </Section>
    ),
  },
];

export default function HomePage() {
  useOrbitImpactRunner();
  const feed = useFeedPhase();
  const [tab, setTab] = useState(TABS[0].id);
  const [copilotOpen, setCopilotOpen] = useState(false);

  return (
    <div className="app">
      <TopBar
        feed={feed}
        copilotOpen={copilotOpen}
        onCopilot={() => setCopilotOpen((open) => !open)}
        onChangeChip={() => {
          setTab("chip");
          document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
      <SnapshotFeedStatus phase={feed} />
      <main className="cockpit">
        <div className="cockpit__hero">
          <Section title="Space Environment" eyebrow="Live orbit">
            <SpaceEnvironment />
          </Section>
          <Verdict />
        </div>
        <div className="cockpit__bench">
          <div className="cockpit__controls">
            <Section title="Orbit Location" eyebrow="Controls">
              <OrbitLocation />
            </Section>
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
