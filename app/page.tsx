"use client";

import { Cockpit } from "@/components/home/Cockpit";

export default function HomePage() {
  return (
    <>
      <header className="rok-nav">
        <p className="rok-nav__mark">StarMind Nav</p>
      </header>
      <Cockpit />
    </>
  );
}
