import type {
  EvalResult,
  FluxGrid,
  MissionConfig,
  OemEvaluation,
  ParetoPayload,
  PhysicsClient,
  SaaGridQuery,
  Track,
} from "@3rok/cesium-plugin";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (body.detail != null) return JSON.stringify(body.detail);
  } catch {
    /* body was not JSON */
  }
  return `${response.status} ${response.statusText}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

/** HTTP client for the FastAPI service. Vite proxies `/api` to uvicorn. */
export function createHttpClient(base = ""): PhysicsClient {
  return {
    evaluate(config: MissionConfig, signal?: AbortSignal): Promise<EvalResult> {
      return fetch(`${base}/api/evaluate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
        signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as EvalResult;
      });
    },
    optimize(signal?: AbortSignal): Promise<ParetoPayload> {
      return getJson(`${base}/api/optimize`, signal);
    },
    saaGrid(query?: SaaGridQuery, signal?: AbortSignal): Promise<FluxGrid> {
      const params = new URLSearchParams();
      if (query?.altitude_km != null) params.set("altitude_km", String(query.altitude_km));
      if (query?.particle) params.set("particle", query.particle);
      if (query?.solar) params.set("solar", query.solar);
      if (query?.lat_step != null) params.set("lat_step", String(query.lat_step));
      if (query?.lon_step != null) params.set("lon_step", String(query.lon_step));
      const search = params.toString();
      const suffix = search ? `?${search}` : "";
      return getJson(`${base}/api/saa-grid${suffix}`, signal);
    },
    track(config, signal): Promise<Track> {
      const params = new URLSearchParams({
        altitude_km: String(config.altitude_km),
        inclination: String(config.inclination),
        n_samples: "360",
      });
      return getJson(`${base}/api/track?${params}`, signal);
    },
    async evaluateOem(file: Blob, config: MissionConfig, signal?: AbortSignal): Promise<OemEvaluation> {
      const body = new FormData();
      body.append("file", file, "track.oem");
      body.append("config", JSON.stringify(config));
      const response = await fetch(`${base}/api/evaluate-oem`, { method: "POST", body, signal });
      if (!response.ok) throw new Error(await readError(response));
      return (await response.json()) as OemEvaluation;
    },
  };
}

export async function loadStatic<T>(name: string): Promise<T> {
  const response = await fetch(`/data/${name}`);
  if (!response.ok) throw new Error(`Missing offline file ${name}`);
  return (await response.json()) as T;
}
