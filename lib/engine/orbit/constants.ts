/** WGS 84 GM, atmosphere included. https://earth-info.nga.mil/index.php?action=wgs84&dir=wgs84 */
export const MU_M3_S2 = 3.986004418e14;

/** WGS 84 equatorial radius, metres. */
export const RE_M = 6378137.0;

/** NGA.STND.0036 Table 3.5 geometric J2. Not the unprinted EGM2008 dynamic J2. */
export const J2_GEO = 1.082629821313e-3;

/** NASA GDC Orbit Primer apparent solar rate. */
export const SSO_RATE_DEG_PER_DAY = 0.9856;

export const WGS84_URL = "https://earth-info.nga.mil/index.php?action=wgs84&dir=wgs84";
export const J2_URL = "https://w3.uch.edu.tw/ccchang50/NGA.STND.0036_1.0.0_WGS84.pdf";
export const SSO_URL = "https://science.nasa.gov/wp-content/uploads/2023/05/GDC_OrbitPrimer.pdf";
export const SSO_800_URL = "https://ntrs.nasa.gov/api/citations/19930015517/downloads/19930015517.pdf";
export const VALLADO_SHADOW_URL =
  "https://raw.githubusercontent.com/poliastro/vallado-software/master/matlab/shadow.m";
export const SP8116_URL = "https://ntrs.nasa.gov/api/citations/19750014908/downloads/19750014908.pdf";
export const AURORAL_OVAL_URL = "http://www.spaceweather.gov/content/space-weather-glossary";
export const PYMSIS_URL = "https://swxtrec.github.io/pymsis/reference/generated/pymsis.calculate.html";
export const DOSE_ANCHOR_URL =
  "https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/";
export const SOLAR_ARRAY_URL = "https://www.spacex.com/spacexai/starmind";
export const FCC_FILING_URL = "https://regmedia.co.uk/2026/02/05/spacex-orbital-dc-sat-narrative.pdf";
export const NOAA_SCALES_URL = "https://www.spaceweather.gov/noaa-scales-explanation";
export const CELESTRAK_SNAPSHOT = "data/snapshots/celestrak_gp.json";

export const FCC_ALT_MIN_KM = 500;
export const FCC_ALT_MAX_KM = 2000;

/** Display text for the demo orbit. This is not an AI1 altitude. */
export const AI1_ALTITUDE_ASSUMPTION =
  "assumption; derived from Starlink CelesTrak snapshot; AI1 altitude not published.";

/** Estimates recorded in docs/research/orbit-model.md. */
export const SAMPLES_PER_ORBIT = 72;
export const EARTH_ROTATION_PHASES = 24;
export const ECLIPTIC_SAMPLES = 12;
export const OBLIQUITY_DEG = 23.439;
export const EARTH_ROTATION_RAD_S = 7.292115e-5;
export const SSO_TOLERANCE_DEG = 0.05;
export const SHELL_MIN_BIN_COUNT = 20;
export const SHELL_GAP_KM = 3;
export const DRAG_STEP_KM = 1;
export const LIFETIME_CAP_YEARS = 1_000_000;

export const SHADOW_RS_KM = 696000;
export const SHADOW_RE_KM = 6378.1363;
export const SHADOW_AU_KM = 149597870;

export const AURORAL_LAT_MIN_DEG = 60;
export const AURORAL_LAT_MAX_DEG = 80;
export const OUTER_BELT_L_MIN = 3;
export const OUTER_BELT_L_MAX = 8;

export const SOLAR_ARRAY_M2 = 840;
export const ANCHOR_ANNUAL_KRAD = 0.15;

export const VEHICLE_MASS_KG = 1000;
export const VEHICLE_DRAG_AREA_M2 = 10;
export const VEHICLE_CD = 2.2;
export const VEHICLE_EOL_KM = 120;

export const ACTIVITY_LOW_DENSITY = { f107: 70, ap: 4 };
export const ACTIVITY_MID = { f107: 150, ap: 15 };
export const ACTIVITY_HIGH_DENSITY = { f107: 250, ap: 80 };
