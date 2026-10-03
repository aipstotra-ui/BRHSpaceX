"use client";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { Globe } from "@/components/globe/Globe";
import { RE_M } from "@/lib/engine/orbit/constants";
import { useOrbitStore } from "@/lib/store/orbit";

export function SpaceEnvironment() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const radiusKm = RE_M / 1000 + altitudeKm;
  const label = `SSO (official). Altitude ${altitudeKm.toFixed(3)} km = assumption. FCC filing range 500–2,000 km.`;
  return (
    <div className="body">
      <p data-orbit-label={label} data-testid="starmind-radius" data-starmind-radius-km={radiusKm}>
        {label}{" "}
        <span data-orbit-number>
          {altitudeKm.toFixed(3)} km <SourceBadge label="estimate" />
        </span>
      </p>
      <Globe />
    </div>
  );
}
