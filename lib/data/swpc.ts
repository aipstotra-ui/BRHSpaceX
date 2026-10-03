import {
  auroraSchema,
  dstSchema,
  f107Schema,
  forecast3daySchema,
  goesProtonSchema,
  goesXraySchema,
  kp1mSchema,
  kpForecastSchema,
  kpSchema,
  rtswMagSchema,
  rtswWindSchema,
  scalesSchema,
  snapshotJsonSchema,
} from "@/lib/data/schemas";

/** estimate: short proxy cache, in seconds. */
export const FEED_CACHE_SECONDS = 60;

export const LIVE_FEEDS = {
  kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
  kp_1m: "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",
  kp_forecast: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
  scales: "https://services.swpc.noaa.gov/products/noaa-scales.json",
  goes_protons: "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json",
  goes_xrays: "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json",
  rtsw_wind_1m: "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
  rtsw_mag_1m: "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
  dst: "https://services.swpc.noaa.gov/products/kyoto-dst.json",
  aurora: "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json",
  f107: "https://services.swpc.noaa.gov/json/f107_cm_flux.json",
  forecast_3day: "https://services.swpc.noaa.gov/text/3-day-forecast.txt",
} as const;

/** CelesTrak is read only from data/snapshots. */
export const SNAPSHOT_ONLY_FEEDS = [
  "celestrak_gp",
  "celestrak_supgp",
  "celestrak_satcat",
  "satcat_2022-010",
] as const;

export type LiveFeedId = keyof typeof LIVE_FEEDS;
export type SnapshotFeedId = (typeof SNAPSHOT_ONLY_FEEDS)[number];
export type FeedId = LiveFeedId | SnapshotFeedId;

const SNAPSHOT_ONLY = new Set<string>(SNAPSHOT_ONLY_FEEDS);

export function isFeedId(feed: string): feed is FeedId {
  return feed in LIVE_FEEDS || SNAPSHOT_ONLY.has(feed);
}

export function isSnapshotOnly(feed: FeedId): feed is SnapshotFeedId {
  return (SNAPSHOT_ONLY as Set<string>).has(feed);
}

export function filterActiveAscending<T extends { active?: boolean; time_tag?: string }>(
  rows: T[],
): T[] {
  return rows
    .filter((row) => row.active === true)
    .sort((left, right) => (left.time_tag ?? "").localeCompare(right.time_tag ?? ""));
}

export function filterPredictedKp<T extends { observed?: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.observed === "predicted");
}

export function normalizeFeed(feed: FeedId, payload: unknown): unknown {
  switch (feed) {
    case "kp":
      return kpSchema.parse(payload);
    case "kp_1m":
      return kp1mSchema.parse(payload);
    case "kp_forecast":
      return filterPredictedKp(kpForecastSchema.parse(payload));
    case "scales":
      return scalesSchema.parse(payload);
    case "goes_protons":
      return goesProtonSchema.parse(payload);
    case "goes_xrays":
      return goesXraySchema.parse(payload);
    case "rtsw_wind_1m":
      return filterActiveAscending(rtswWindSchema.parse(payload));
    case "rtsw_mag_1m":
      return filterActiveAscending(rtswMagSchema.parse(payload));
    case "dst":
      return dstSchema.parse(payload);
    case "aurora":
      return auroraSchema.parse(payload);
    case "f107":
      return f107Schema.parse(payload);
    case "forecast_3day":
      return forecast3daySchema.parse(payload);
    case "celestrak_gp":
    case "celestrak_supgp":
    case "celestrak_satcat":
    case "satcat_2022-010":
      return snapshotJsonSchema.parse(payload);
    default: {
      const unreachable: never = feed;
      return unreachable;
    }
  }
}
