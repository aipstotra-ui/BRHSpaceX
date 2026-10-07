import { describe, expect, it } from "vitest";

import { exposureClass } from "@/lib/engine/globe/exposure";
import { geodeticToScene } from "@/lib/engine/globe/frames";
import {
  inSaaFlux,
  protonLayer,
  protonLogAt,
  protonMapAltitudeKm,
  SAA_EDGE_LOG,
  trappedProtonMap,
} from "@/lib/engine/globe/protonMap";
import { inSaa } from "@/lib/engine/radiation";
import { DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG, magneticLatitudeDeg } from "@/lib/engine/orbit/stormZones";

const map = trappedProtonMap();

describe("AP8 proton map", () => {
  it("decodes the whole grid", () => {
    const { altitudesKm, latCount, lonCount } = map.file;
    expect(map.logs).toHaveLength(altitudesKm.length * latCount * lonCount);
    expect(altitudesKm[0]).toBe(300);
    expect(altitudesKm[altitudesKm.length - 1]).toBe(2000);
    expect(protonMapAltitudeKm(2500)).toBe(2000);
    expect(protonMapAltitudeKm(550)).toBe(550);
  });

  it("peaks over the South Atlantic and is quiet over Europe", () => {
    expect(protonLogAt(map, -29, -47, 500)).toBeGreaterThan(3);
    expect(inSaaFlux(map, -29, -47, 500)).toBe(true);
    expect(protonLogAt(map, 45, 10, 500)).toBeLessThan(SAA_EDGE_LOG);
    expect(inSaaFlux(map, 0, 100, 500)).toBe(false);
  });

  it("grows with altitude, so the SAA widens as the orbit rises", () => {
    let previous = -Infinity;
    for (const alt of [300, 450, 550, 800, 1200]) {
      const value = protonLogAt(map, -26, -50, alt);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
    const area = (alt: number) => {
      let count = 0;
      for (let lat = -60; lat <= 10; lat += 2) {
        for (let lon = -120; lon <= 60; lon += 2) {
          count += inSaaFlux(map, lat, lon, alt) ? Math.cos((lat * Math.PI) / 180) : 0;
        }
      }
      return count;
    };
    expect(area(800)).toBeGreaterThan(area(400));
  });

  it("matches the Fermi GBM SAA boundary inside the latitudes Fermi flies, at 500 km", () => {
    let both = 0;
    let either = 0;
    for (let lat = -25; lat <= 25; lat += 1) {
      const weight = Math.cos((lat * Math.PI) / 180);
      for (let lon = -180; lon < 180; lon += 1) {
        const fromMap = inSaaFlux(map, lat, lon, 500);
        const fromGbm = inSaa(lat, lon);
        both += fromMap && fromGbm ? weight : 0;
        either += fromMap || fromGbm ? weight : 0;
      }
    }
    expect(both / either).toBeGreaterThan(0.75);
  });

  it("slices one altitude into normalized texture values with the floor at 0", () => {
    const values = protonLayer(map, 500);
    expect(values).toHaveLength(map.file.latCount * map.file.lonCount);
    expect(Math.max(...values)).toBeGreaterThan(0.6);
    expect(Math.min(...values)).toBe(0);
  });

  it("classifies the craft with the flux contour, not the GBM polygon", () => {
    // 40°S 40°W at 600 km: inside the flux contour, south of where the GBM polygon stops.
    expect(inSaa(-40, -40)).toBe(false);
    expect(exposureClass(-40, -40, 600)).toBe("SAA");
  });
});

describe("zone shader geometry", () => {
  it("uses the same magnetic latitude as the engine's centred-dipole formula", () => {
    const pole = geodeticToScene(DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG, 0);
    for (const [lat, lon] of [
      [60, -100],
      [-70, 140],
      [10, 30],
      [85, 0],
    ]) {
      const point = geodeticToScene(lat, lon, 0);
      const sine = point.x * pole.x + point.y * pole.y + point.z * pole.z;
      expect((Math.asin(sine) * 180) / Math.PI).toBeCloseTo(magneticLatitudeDeg(lat, lon), 9);
    }
  });
});
