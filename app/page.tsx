"use client";

import { AIForecast } from "@/components/panels/AIForecast";
import { ChipSpecStudio } from "@/components/panels/ChipSpecStudio";
import { OrbitImpact } from "@/components/panels/OrbitImpact";
import { OrbitLocation } from "@/components/panels/OrbitLocation";
import { OrbitOptimizer } from "@/components/panels/OrbitOptimizer";
import { PayloadHealth } from "@/components/panels/PayloadHealth";
import { SpaceEnvironment } from "@/components/panels/SpaceEnvironment";
import { VoiceTest } from "@/components/panels/VoiceTest";
import { SnapshotFeedStatus } from "@/components/ui/SnapshotBanner";
import { useShellStore, type PanelPhase } from "@/lib/store";

const SECTIONS = [
  "Chip Spec Studio",
  "Space Environment",
  "Orbit Location",
  "Orbit Impact",
  "Orbit Optimizer",
  "AI Forecast",
  "Payload Health",
  "Best Move",
  "Time Machine",
  "Storm Scenario",
  "Validation Lab",
] as const;

function sectionId(title: string): string {
  return title.toLowerCase().replaceAll(" ", "-");
}

function PanelBody({ phase }: { phase: PanelPhase }) {
  if (phase === "loading") {
    return <p className="body rok-muted">Loading</p>;
  }
  if (phase === "error") {
    return (
      <p className="body" style={{ color: "var(--status-critical)" }}>
        Error
      </p>
    );
  }
  return <p className="body rok-muted">Empty</p>;
}

export default function HomePage() {
  const panelPhase = useShellStore((state) => state.panelPhase);

  return (
    <>
      <header className="rok-nav">
        <p className="rok-nav__mark">StarMind Nav</p>
      </header>
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          padding: "var(--space-6)",
        }}
      >
        <SnapshotFeedStatus />
        <VoiceTest />
        {SECTIONS.map((title) => (
          <section
            key={title}
            className="rok-panel"
            aria-labelledby={sectionId(title)}
          >
            <p className="eyebrow rok-panel__eyebrow">Section</p>
            <h2 id={sectionId(title)} className="heading-md rok-panel__title">
              {title}
            </h2>
            {title === "AI Forecast" ? <AIForecast /> : null}
            {title === "Chip Spec Studio" ? <ChipSpecStudio /> : null}
            {title === "Payload Health" ? <PayloadHealth /> : null}
            {title === "Orbit Location" ? <OrbitLocation /> : null}
            {title === "Orbit Impact" ? <OrbitImpact /> : null}
            {title === "Orbit Optimizer" ? <OrbitOptimizer /> : null}
            {title === "Space Environment" ? <SpaceEnvironment /> : null}
            {title !== "AI Forecast" &&
            title !== "Chip Spec Studio" &&
            title !== "Payload Health" &&
            title !== "Orbit Location" &&
            title !== "Orbit Impact" &&
            title !== "Orbit Optimizer" &&
            title !== "Space Environment" ? (
              <PanelBody phase={panelPhase} />
            ) : null}
          </section>
        ))}
      </main>
    </>
  );
}
