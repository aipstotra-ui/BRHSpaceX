import type { EarthConstants, Track } from "./types";

/**
 * Display defaults for a WGS84 Earth. A host that loaded a parameter table
 * should pass those numbers instead. This module does not read a physics package.
 */
export const WGS84_EARTH: EarthConstants = {
  radiusKm: 6378.137,
  muKm3S2: 398600.4418,
  omegaEarthRadS: 7.2921159e-5,
  j2: 1.08263e-3,
  yearDays: 365.2422,
};

export function ssoInclinationDeg(
  altitudeKm: number,
  earth: EarthConstants = WGS84_EARTH,
): number {
  const yearS = earth.yearDays * 86400;
  const sun = (2 * Math.PI) / yearS;
  const radius = earth.radiusKm + altitudeKm;
  const meanMotion = Math.sqrt(earth.muKm3S2 / radius ** 3);
  let cosi =
    (-2 * sun) /
    (3 * earth.j2 * meanMotion * (earth.radiusKm / radius) ** 2);
  cosi = Math.max(-1, Math.min(1, cosi));
  return (Math.acos(cosi) * 180) / Math.PI;
}

function wrapLongitude(radians: number): number {
  const twoPi = 2 * Math.PI;
  let wrapped = (radians + Math.PI) % twoPi;
  if (wrapped < 0) wrapped += twoPi;
  return wrapped - Math.PI;
}

/**
 * Crude spherical ground track (Kepler + Earth rotation, no J2 drift).
 * Same geometry a ranking engine uses for a synthetic day-long track.
 */
export function groundTrack(
  altitudeKm: number,
  inclinationDeg: number,
  options?: {
    samples?: number;
    spanSeconds?: number;
    earth?: EarthConstants;
    epochUtc?: string;
  },
): Track {
  const earth = options?.earth ?? WGS84_EARTH;
  const samples = options?.samples ?? 360;
  const span = options?.spanSeconds ?? 86400;
  const radius = earth.radiusKm + altitudeKm;
  const meanMotion = Math.sqrt(earth.muKm3S2 / radius ** 3);
  const inclination = (inclinationDeg * Math.PI) / 180;
  const lat: number[] = [];
  const lon: number[] = [];
  const times: number[] = [];
  const count = Math.max(2, samples);
  for (let index = 0; index < count; index += 1) {
    const time = (span * index) / (count - 1);
    const anomaly = meanMotion * time;
    const latRad = Math.asin(Math.sin(inclination) * Math.sin(anomaly));
    const lonRad = wrapLongitude(
      Math.atan2(Math.cos(inclination) * Math.sin(anomaly), Math.cos(anomaly)) -
        earth.omegaEarthRadS * time,
    );
    lat.push((latRad * 180) / Math.PI);
    lon.push((lonRad * 180) / Math.PI);
    times.push(time);
  }
  return {
    lat_deg: lat,
    lon_deg: lon,
    alt_km: altitudeKm,
    times_s: times,
    epoch_utc: options?.epochUtc,
    source: "ground_track",
  };
}

export function altitudeAt(track: Track, index: number): number {
  if (Array.isArray(track.alt_km)) {
    return track.alt_km[Math.min(index, track.alt_km.length - 1)] ?? 0;
  }
  return track.alt_km;
}
