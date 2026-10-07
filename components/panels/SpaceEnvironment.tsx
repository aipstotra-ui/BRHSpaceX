"use client";

import { SourceBadge } from "@/components/ui/SourceBadge";
import { Globe } from "@/components/globe/Globe";
import { orbitKind } from "@/lib/cases/format";
import { RE_M } from "@/lib/engine/orbit/constants";
import { useOrbitStore } from "@/lib/store/orbit";

export function SpaceEnvironment() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);
  const sunSynchronous = useOrbitStore((state) => state.sunSynchronous);
  const ltanHours = useOrbitStore((state) => state.ltanHours);
  const radiusKm = RE_M / 1000 + altitudeKm;
  // Names the orbit actually drawn; it used to say "SSO (official)" even for the inclined default shell.
  const label = `${orbitKind({ sunSynchronous, ltanHours })}. Altitude ${altitudeKm.toFixed(3)} km = assumption. FCC filing range 500–2,000 km.`;
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
