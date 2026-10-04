"use client";

import dynamic from "next/dynamic";

const GlobeClient = dynamic(() => import("./GlobeClient"), {
  ssr: false,
  loading: () => <p className="body rok-muted">Loading</p>,
});

export function Globe() {
  return <GlobeClient />;
}
