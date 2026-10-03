import { useCallback, useEffect, useMemo, useState } from "react";
import type { EvalResult, FluxGrid, MissionConfig, ParetoPayload, Track } from "@3rok/cesium-plugin";
import {
  groundTrack,
  ssoInclinationDeg,
  useDebounced,
  useEngineData,
} from "@3rok/cesium-plugin";
import { createHttpClient, loadStatic } from "../api/client";
import {
  chipPreset,
  earthFromParams,
  nearestOffline,
  offlineIsApproximate,
  type ChipSummary,
  type OfflineGrid,
  type ParamsFile,
} from "../api/offline";
import type { SensitivityBar } from "../components/charts";

export const DEFAULT_CONFIG: MissionConfig = {
  altitude_km: 800,
  inclination: "sso",
  ltan_hours: 6,
  shield_mm_Al: 5,
  radiator_area_m2: null,
  chip_id: "google_trillium_tpu_v6e",
  chip_preset: "commercial",
  solar_phase: 1,
  load_strategy: "constant",
};

interface SensitivityFile {
  bars: SensitivityBar[];
  disclaimer?: string;
  baseline?: { lifetime_years?: number | null };
}

interface BaselineFile {
  result: EvalResult;
  disclaimer?: string;
}

export type LinkState = "live" | "offline" | "scoring";

export function useMission() {
  const [config, setConfig] = useState<MissionConfig>(DEFAULT_CONFIG);
  const [pareto, setPareto] = useState<ParetoPayload | null>(null);
  const [saa, setSaa] = useState<FluxGrid | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityFile | null>(null);
  const [chips, setChips] = useState<ChipSummary[]>([]);
  const [params, setParams] = useState<ParamsFile | null>(null);
  const [baseline, setBaseline] = useState<EvalResult | null>(null);
  const [offlineGrid, setOfflineGrid] = useState<OfflineGrid | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [oemName, setOemName] = useState<string | null>(null);
  const [oemFile, setOemFile] = useState<Blob | null>(null);
  const [oemResult, setOemResult] = useState<EvalResult | null>(null);
  const [oemTrack, setOemTrack] = useState<Track | null>(null);
  const [oemNote, setOemNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const client = useMemo(() => createHttpClient(""), []);
  const engine = useEngineData(client, config, {
    debounceMs: 350,
    enabled: oemFile == null,
  });
  const debounced = useDebounced(config, 350);
  const earth = useMemo(() => earthFromParams(params), [params]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [base, front, grid, flux, sense, chipFile, paramFile] = await Promise.all([
        loadStatic<BaselineFile>("baseline.json").catch(() => null),
        loadStatic<ParetoPayload>("pareto_front.json").catch(() => null),
        loadStatic<OfflineGrid>("offline_grid.json").catch(() => null),
        loadStatic<FluxGrid>("saa_flux_grid.json").catch(() => null),
        loadStatic<SensitivityFile>("sensitivity.json").catch(() => null),
        loadStatic<{ chips: ChipSummary[] }>("chips.json").catch(() => null),
        loadStatic<ParamsFile>("params.json").catch(() => null),
      ]);
      if (cancel) return;
      if (base?.result) setBaseline((current) => current ?? base.result);
      if (front) setPareto((current) => current ?? front);
      if (grid) setOfflineGrid((current) => current ?? grid);
      if (flux) setSaa((current) => current ?? flux);
      if (sense) setSensitivity((current) => current ?? sense);
      if (chipFile?.chips) setChips((current) => (current.length ? current : chipFile.chips));
      if (paramFile) setParams((current) => current ?? paramFile);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [front, flux, chipFile, paramFile] = await Promise.all([
          client.optimize(),
          client.saaGrid(),
          fetch("/api/chips").then(async (response) => {
            if (!response.ok) throw new Error("chips");
            return (await response.json()) as { chips: ChipSummary[] };
          }),
          fetch("/api/params").then(async (response) => {
            if (!response.ok) throw new Error("params");
            return (await response.json()) as ParamsFile;
          }),
        ]);
        if (cancel) return;
        setPareto(front);
        setSaa(flux);
        setChips(chipFile.chips);
        setParams(paramFile);
        const sense = await fetch("/api/sensitivity");
        if (sense.ok && !cancel) setSensitivity((await sense.json()) as SensitivityFile);
      } catch {
        /* Static files already on screen. Live calls report through useEngineData. */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [client]);

  useEffect(() => {
    if (!oemFile || !client.evaluateOem) return undefined;
    const controller = new AbortController();
    client
      .evaluateOem(oemFile, debounced, controller.signal)
      .then((evaluation) => {
        setOemResult(evaluation.result);
        setOemTrack(evaluation.track);
        setOemNote(evaluation.disclaimer ?? null);
        setMessage(null);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : String(error));
      });
    return () => controller.abort();
  }, [client, oemFile, debounced]);

  const offline = useMemo(
    () => nearestOffline(offlineGrid, config),
    [offlineGrid, config],
  );

  const localTrack = useMemo(() => {
    const inclination =
      config.inclination === "sso"
        ? ssoInclinationDeg(config.altitude_km, earth)
        : Number(config.inclination);
    return groundTrack(config.altitude_km, inclination, { earth, samples: 360 });
  }, [config.altitude_km, config.inclination, earth]);

  let result: EvalResult | null = null;
  let link: LinkState = "scoring";
  if (oemResult) {
    result = oemResult;
    link = "live";
  } else if (engine.status === "error" || engine.result == null) {
    result = offline.result ?? baseline;
    link = engine.status === "loading" ? "scoring" : "offline";
  } else {
    result = engine.result;
    link = engine.status === "loading" ? "scoring" : "live";
  }

  const track =
    oemTrack ?? (engine.status === "ready" && engine.track ? engine.track : localTrack);
  const approximate =
    link === "offline" && offlineIsApproximate(config, offline.distance);

  const patch = useCallback((partial: Partial<MissionConfig>) => {
    setSelectedId(null);
    setConfig((current) => ({ ...current, ...partial }));
  }, []);

  const applyPareto = useCallback((point: ParetoPayload["pareto_front"][number]) => {
    const preset = point.config.chip_preset === "rad_hard" ? "rad_hard" : "commercial";
    setOemFile(null);
    setOemName(null);
    setOemResult(null);
    setOemTrack(null);
    setOemNote(null);
    setSelectedId(point.id ?? null);
    setConfig((current) => ({
      ...current,
      altitude_km: point.config.altitude_km,
      inclination: point.config.inclination === "sso" ? "sso" : 30,
      ltan_hours: point.config.ltan_hours,
      shield_mm_Al: point.config.shield_mm_Al,
      chip_preset: preset,
      chip_id: preset === "rad_hard" ? "bae_rad750" : "google_trillium_tpu_v6e",
      load_strategy:
        point.config.load_strategy === "load_follow_sun" ? "load_follow_sun" : "constant",
    }));
  }, []);

  const toggleChip = useCallback(() => {
    setConfig((current) => {
      const rad = chipPreset(current) === "rad_hard";
      return {
        ...current,
        chip_preset: rad ? "commercial" : "rad_hard",
        chip_id: rad ? "google_trillium_tpu_v6e" : "bae_rad750",
      };
    });
  }, []);

  async function uploadOem(file: Blob, name: string) {
    setOemFile(file);
    setOemName(name);
    setMessage(null);
  }

  function clearOem() {
    setOemFile(null);
    setOemName(null);
    setOemResult(null);
    setOemTrack(null);
    setOemNote(null);
  }

  return {
    config,
    patch,
    result,
    link,
    track,
    saa,
    pareto,
    sensitivity,
    chips,
    selectedId,
    applyPareto,
    toggleChip,
    playing,
    setPlaying,
    uploadOem,
    clearOem,
    oemName,
    oemNote,
    message,
    approximate,
    engineError: engine.error,
  };
}
