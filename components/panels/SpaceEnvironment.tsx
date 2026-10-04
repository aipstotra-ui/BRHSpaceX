"use client";

import { Globe } from "@/components/globe/Globe";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { AURORA_PROXY_MIN, auroraObservationTime } from "@/lib/globe/aurora";
import { starlinkDemo } from "@/lib/globe/starlinkDemo";
import { ILLUSTRATIVE_WINGSPAN_KM, STARMIND_HEIGHT_M, STARMIND_SOURCE_URL, STARMIND_WINGSPAN_M } from "@/lib/globe/vehicle";
import { DEORBIT_ALTITUDE_KM } from "@/lib/engine/starlinkSample";
import { SAA_CITATION, SAA_MODEL, SAA_THRESHOLD_NT } from "@/lib/engine/saaContour";
import { useOrbitStore } from "@/lib/store/orbit";

export function SpaceEnvironment() {
  const altitudeKm = useOrbitStore((state) => state.altitudeKm);

  return (
    <div className="body">
      <p>
        SSO (official). Altitude{" "}
        <span data-orbit-number>
          {altitudeKm.toFixed(3)} <SourceBadge label="estimate" />
        </span>{" "}
        = assumption. FCC filing range 500–2,000 km.
      </p>
      <Globe />
      <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
        <p className="body-sm">
          Starlink points are subsampled ({starlinkDemo.records.length} of {starlinkDemo.totalInSnapshot}, product {starlinkDemo.product}
          , snapshot {starlinkDemo.downloadedAtUtc}). Shell colors follow inclination groups 30°, 43°, 53°, 70°, and 97.5°. Gen1 altitudes
          are not hard-coded.
        </p>
        <p className="body-sm">
          Below {DEORBIT_ALTITUDE_KM} km is flagged raising or deorbiting <SourceBadge label="estimate" />. {starlinkDemo.below440Note}
        </p>
        <p className="body-sm">
          Starmind wingspan {STARMIND_WINGSPAN_M} m and height {STARMIND_HEIGHT_M} m <SourceBadge label="source" /> ({STARMIND_SOURCE_URL}
          ).           Drawn at {ILLUSTRATIVE_WINGSPAN_KM} km wingspan <SourceBadge label="estimate" />. Illustrative geometry, not to scale. The 160 m²
          radiator is on that page <SourceBadge label="source" />. Splitting it into two panels, the bus cross-section, and the wing chord
          are estimates. A second 20 m × 70 m sheet is unconfirmed and is not drawn.
        </p>
        <p className="body-sm">
          Trail colors: SAA, auroral, outer belt, nominal. One orbit of trail is an estimate. Auroral and outer-belt tests use geographic
          latitude as a stand-in for magnetic latitude <SourceBadge label="estimate" />.
        </p>
        <p className="body-sm">
          SAA is the {SAA_MODEL} region where |B| &lt; {SAA_THRESHOLD_NT.toLocaleString("en-US")} nT at the nearest precomputed altitude{" "}
          <SourceBadge label="source" /> ({SAA_CITATION}). The contour is a static mask, not an IGRF evaluation per frame.
        </p>
        <p className="body-sm">
          OVATION Prime values ≥ {AURORA_PROXY_MIN} are a ground aurora proxy, not dose <SourceBadge label="estimate" />. Observation{" "}
          {auroraObservationTime}. Longitudes above 180° are shown as negative. The snapshot is unaltered.
        </p>
        <p className="body-sm rok-muted">
          Orbital data: 18 SDS/Space-Track via CelesTrak (SupGP derived from SpaceX ephemerides). Aurora: NOAA SWPC OVATION Prime
          (unaltered, no endorsement implied). SAA: IGRF-14 25,000 nT contour per Heirtzler (2002). SupGP license and the CelesTrak
          attribution wording are unconfirmed.
        </p>
      </div>
    </div>
  );
}
