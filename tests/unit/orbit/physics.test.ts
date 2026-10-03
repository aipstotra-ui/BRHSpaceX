import { describe, expect, it } from "vitest";

import { ACTIVITY_MID } from "@/lib/engine/orbit/constants";
import { densityKgM3 } from "@/lib/engine/orbit/density";
import { DENSITY_TABLE } from "@/lib/engine/orbit/density";
import { orbitEnvironment } from "@/lib/engine/orbit/environment";
import { dragDecayYears } from "@/lib/engine/orbit/lifetime";

const vehicle = { massKg: 1000, dragAreaM2: 10, cd: 2.2, eolAltitudeKm: 120 };

describe("orbit physics", () => {
  it("reproduces a density-table node exactly", () => {
    const altitude = 400;
    const value = densityKgM3(altitude, ACTIVITY_MID);
    const i = DENSITY_TABLE.altitudesKm.indexOf(altitude);
    const f = DENSITY_TABLE.f107.indexOf(ACTIVITY_MID.f107);
    const a = DENSITY_TABLE.ap.indexOf(ACTIVITY_MID.ap);
    expect(value).toBe(DENSITY_TABLE.density[i][f][a]);
  });

  it("decreases density as altitude increases at F10.7 150 and Ap 15", () => {
    const altitudes = [500, 800, 1200, 1600, 2000];
    const values = altitudes.map((altitude) => densityKgM3(altitude, ACTIVITY_MID));
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeLessThan(values[index - 1]);
    }
  });

  it("increases drag-decay time with altitude from 500 to 2000 km", () => {
    const altitudes = [500, 1000, 1500, 2000];
    const times = altitudes.map((altitude) => dragDecayYears(altitude, vehicle).mid);
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index]).toBeGreaterThan(times[index - 1]);
    }
  });

  it("gives dawn-dusk a lower annual-mean eclipse fraction than noon-midnight", () => {
    const dawn = orbitEnvironment({
      altitudeKm: 800,
      inclinationDeg: 0,
      sunSynchronous: true,
      ltanHours: 6,
      raanDeg: 0,
    });
    const noon = orbitEnvironment({
      altitudeKm: 800,
      inclinationDeg: 0,
      sunSynchronous: true,
      ltanHours: 12,
      raanDeg: 0,
    });
    expect(dawn.eclipseFraction.mid).toBeLessThanOrEqual(noon.eclipseFraction.mid);
    expect(dawn.milliseconds).toBeGreaterThan(0);
    console.log(`environment ms dawn ${dawn.milliseconds} noon ${noon.milliseconds}`);
  });
});
