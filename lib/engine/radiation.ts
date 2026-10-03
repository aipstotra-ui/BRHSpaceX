import { marked, type Marked } from "@/lib/engine/marked";

/** GbmSaaPolygon5, closed ring. Latitude then east longitude. Operational boundary, not a flux contour. */
export const GBM_SAA_LAT = [
  -30, -19.867, -9.733, 0.4, 2, 2, -1, -6.155, -8.88, -14.22, -18.404, -30, -30,
] as const;

export const GBM_SAA_LON = [
  33.9, 12.398, -9.103, -30.605, -38.4, -45, -65, -84, -89.2, -94.3, -94.3, -86.1, 33.9,
] as const;

export const GBM_SAA_SOURCE =
  "https://raw.githubusercontent.com/USRA-STI/gdt-fermi/main/src/gdt/missions/fermi/gbm/saa.py";

export const ZOU_2015 = "https://agupubs.onlinelibrary.wiley.com/doi/10.1002/2015JA021312";

export const SPENVIS_DIPOLE = "https://www.spenvis.oma.be/help/background/magfield/rlambda.html";

export const GIRGIS_2023 = "https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2023SW003664";

export const GIRGIS_51_PDF = "https://catalog.lib.kyushu-u.ac.jp/opac_download_md/7330310/7330310.pdf";

/** Quiet NOAA-17 MEPED >70 MeV maxSAA example, about 840 km. Unit as printed: per steradian. */
export const QUIET_SAA_PROTON_FLUX_PER_SR = 399.5;

export function inSaa(lat: number, lon: number): boolean {
  const count = GBM_SAA_LAT.length - 1;
  let inside = false;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const yi = GBM_SAA_LAT[i];
    const xi = GBM_SAA_LON[i];
    const yj = GBM_SAA_LAT[j];
    const xj = GBM_SAA_LON[j];
    const crosses = yi > lat !== yj > lat;
    const xCross = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses && lon < xCross) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * SPENVIS equation (5): R = L cos^2(Lambda), so L = R / cos^2(Lambda).
 * Lambda is magnetic latitude in radians. Geographic latitude is not a substitute unless labeled an estimate.
 */
export function dipoleL(r: number, magneticLatitudeRad: number): number {
  const cosine = Math.cos(magneticLatitudeRad);
  return r / (cosine * cosine);
}

export function directionalQuietFlux(): Marked {
  return marked({
    value: QUIET_SAA_PROTON_FLUX_PER_SR,
    sigma: 0,
    unit: "protons/cm2/s/sr",
    isEstimate: false,
    label: "source",
    sourceUrl: ZOU_2015,
    assumptions: [
      "Zou et al. 2015 quiet example for 20 Oct 2004, NOAA-17, >70 MeV, L<2, Dst > -15 nT and Kp < 2.5. Not an AI1 flux and not an altitude.",
    ],
  });
}

export function omnidirectionalQuietFlux(): Marked {
  const value = QUIET_SAA_PROTON_FLUX_PER_SR * 4 * Math.PI;
  return marked({
    value,
    sigma: 0,
    unit: "protons/cm2/s",
    isEstimate: true,
    label: "estimate",
    sourceUrl: ZOU_2015,
    assumptions: [
      "Isotropic 4π conversion of the per-steradian quiet example. The conversion is an estimate, not a sourced omnidirectional flux.",
    ],
  });
}

export const GIRGIS_NOTES = [
  {
    label: "source" as const,
    sourceUrl: GIRGIS_2023,
    text: "Girgis et al. 2023 case, about 650 km at 98°: Dst=-210 nT versus quiet Dst=-7 nT raised SEU 19% and dose 17%. Not applied as the live multiplier.",
  },
  {
    label: "source" as const,
    sourceUrl: GIRGIS_51_PDF,
    text: "Same paper, about 650 km at 51°: Dst=-150 nT, dose up to +16% and excess SEU up to +11%. The 98° dose was +9% at Dst=-150 nT and +17% at Dst=-210 nT. Not applied as the live multiplier.",
  },
  {
    label: "source" as const,
    sourceUrl: ZOU_2015,
    text: "Zou et al. 2015: NOAA-17 >70 MeV maxSAA fell about 16.4%, from 399.5 to 333.9, on 9 Nov 2004. That is a trapped-flux decrease, not a SEP-access increase.",
  },
] as const;
