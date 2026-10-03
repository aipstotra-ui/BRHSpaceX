import type { ChipSpec, PayloadConfig, SourceLabel } from "@/lib/types";

import type { DeviceSeu } from "@/lib/engine/impact";

const NVL72 = "https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/";
const SPACEX = "https://www.spacex.com/spacexai/starmind";
const HEISE = "https://www.heise.de/en/news/SpaceXAI-s-Starmind-AI1-Satellite-Carries-Nvidia-Technology-11424154.html";
const H100_PAPER = "https://advancedclustering.com/wp-content/uploads/2022/03/gtc22-whitepaper-hopper.pdf";
const H100_PRODUCT = "https://www.nvidia.com/en-us/data-center/h100/";
const STARCLOUD = "https://blogs.nvidia.com/blog/starcloud/";
const AGX_DS =
  "https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/5380/Jetson_AGX_Orin_Series_Data_Sheet_DS-10662-001_v1.5.pdf";
const ORIN_NODE =
  "https://hc34.hotchips.org/assets/program/conference/day2/ADAS%20and%20Grace/HC2022.NVIDIA.Mike_Ditty.v6.pdf";
const ORIN_TID = "https://doi.org/10.1109/REDW61050.2023.10265818";
const NX_DS = "https://developer.nvidia.com/downloads/jetson-orin-nx-module-series-data-sheet";
const NX_SEU = "https://upcommons.upc.edu/bitstreams/ef814395-1619-43ee-ba00-6a89f0c16d83/download";
const TPU = "https://docs.cloud.google.com/tpu/docs/v6e";
const TPU_BLOG =
  "https://research.google/blog/exploring-a-space-based-scalable-ai-infrastructure-system-design/";
const SAM = "https://www.microchip.com/DS60001593";

export interface MemoryTiles {
  count: number;
  label: SourceLabel;
  note: string;
}

export interface ChipPreset {
  id: string;
  title: string;
  spec: ChipSpec;
  payload: PayloadConfig;
  labels: Record<keyof ChipSpec, SourceLabel>;
  payloadLabels: Record<keyof PayloadConfig, SourceLabel>;
  notes: string[];
  memoryUnit: "GB" | "KB";
  nodeKnown: boolean;
  peakKind: "compute" | "solar" | "unverified";
  deviceSeu?: DeviceSeu;
  memoryTiles: MemoryTiles;
  inletC?: { value: number; label: SourceLabel; note: string };
}

const unverifiedChip: Record<keyof ChipSpec, SourceLabel> = {
  vendor: "UNVERIFIED",
  name: "UNVERIFIED",
  nodeNm: "UNVERIFIED",
  acceleratorCount: "UNVERIFIED",
  cpuCount: "UNVERIFIED",
  memoryType: "UNVERIFIED",
  memoryCapacity: "UNVERIFIED",
  eccScheme: "UNVERIFIED",
  avgPowerKw: "UNVERIFIED",
  peakPowerKw: "UNVERIFIED",
  opTempMinC: "UNVERIFIED",
  opTempMaxC: "UNVERIFIED",
  shieldingMmAl: "UNVERIFIED",
  seuCrossSection: "UNVERIFIED",
  tidLimitKradSi: "UNVERIFIED",
  latchupLet: "UNVERIFIED",
  dieArea: "UNVERIFIED",
};

const estimatePayload: Record<keyof PayloadConfig, SourceLabel> = {
  radiatorAreaM2: "UNVERIFIED",
  radiatorSides: "estimate",
  tSinkK: "estimate",
  emissivity: "estimate",
};

function blankSpec(over: Partial<ChipSpec>): ChipSpec {
  return {
    vendor: "Custom",
    name: "Custom",
    nodeNm: 0,
    acceleratorCount: 0,
    cpuCount: 0,
    memoryType: "unspecified",
    memoryCapacity: 0,
    eccScheme: "UNVERIFIED",
    avgPowerKw: 0,
    peakPowerKw: 0,
    opTempMinC: 0,
    opTempMaxC: 0,
    shieldingMmAl: 0,
    ...over,
  };
}

function blankPayload(area: number): PayloadConfig {
  return {
    radiatorAreaM2: area,
    radiatorSides: 2,
    tSinkK: 200,
    emissivity: 0.9,
  };
}

const nvl72Spec = blankSpec({
  vendor: "NVIDIA",
  name: "NVL72",
  nodeNm: 0,
  acceleratorCount: 72,
  cpuCount: 36,
  memoryType: "HBM4",
  memoryCapacity: 20700,
  eccScheme: "UNVERIFIED",
  avgPowerKw: 175,
  peakPowerKw: 250,
  opTempMinC: 0,
  opTempMaxC: 45,
});

const nvl72Labels: Record<keyof ChipSpec, SourceLabel> = {
  ...unverifiedChip,
  vendor: "source",
  name: "source",
  acceleratorCount: "source",
  cpuCount: "source",
  memoryType: "source",
  memoryCapacity: "source",
  avgPowerKw: "source",
  peakPowerKw: "source",
  opTempMaxC: "source",
};

export const PRESETS: ChipPreset[] = [
  {
    id: "ai1-spacex",
    title: "Starmind AI1 (spacex.com sheet)",
    spec: nvl72Spec,
    payload: blankPayload(160),
    labels: nvl72Labels,
    payloadLabels: { ...estimatePayload, radiatorAreaM2: "source" },
    memoryUnit: "GB",
    nodeKnown: false,
    peakKind: "compute",
    memoryTiles: {
      count: 72,
      label: "estimate",
      note: "HBM grouping uses one tile per GPU. A stack count is not published. Capacity stays the published 20.7 TB.",
    },
    inletC: {
      value: 45,
      label: "source",
      note: "NVL72 liquid inlet, not a die limit.",
    },
    notes: [
      `NVL72: 72 Rubin GPUs, 36 Vera CPUs, 20.7 TB HBM4, 288 GB/GPU. ${NVL72}`,
      "3,600 PFLOPS NVFP4 (sparse).",
      `Average compute 175 kW, peak compute 250 kW, radiator 160 m², solar 210 kW. ${SPACEX}`,
      "Liquid inlet 45 °C is shown beside the radiator temperature.",
      "TSMC N3 is UNVERIFIED. nodeNm 0 is not a measurement.",
      "HBM ECC is UNVERIFIED and is not recorded as none.",
      "Two radiator sides are an estimate. That reading places 160 m² inside the 320 K to 340 K band.",
      "Emissivity 0.9 and sink temperature 200 K are estimates.",
      "Orbit is described as sun-synchronous. No altitude is used.",
    ],
  },
  {
    id: "ai1-alternate",
    title: "Starmind AI1 (alternate sheet)",
    spec: { ...nvl72Spec, avgPowerKw: 120, peakPowerKw: 150 },
    payload: blankPayload(110),
    labels: nvl72Labels,
    payloadLabels: { ...estimatePayload, radiatorAreaM2: "source" },
    memoryUnit: "GB",
    nodeKnown: false,
    peakKind: "solar",
    memoryTiles: {
      count: 72,
      label: "estimate",
      note: "HBM grouping uses one tile per GPU. A stack count is not published. Capacity stays the published 20.7 TB.",
    },
    inletC: {
      value: 45,
      label: "source",
      note: "NVL72 liquid inlet, not a die limit.",
    },
    notes: [
      `Average compute 120 kW. Peak 150 kW on this sheet is peak solar, not peak compute. Radiator 110 m². ${HEISE}`,
      `Same NVL72 counts and 20.7 TB HBM4. ${NVL72}`,
      "TSMC N3 is UNVERIFIED. HBM ECC is UNVERIFIED.",
      "Emissivity 0.9, sink 200 K, and two radiator sides are estimates.",
      "No altitude is used.",
    ],
  },
  {
    id: "h100-starcloud",
    title: "NVIDIA H100 (Starcloud-1)",
    spec: blankSpec({
      vendor: "NVIDIA",
      name: "H100",
      memoryType: "HBM3",
      memoryCapacity: 80,
      eccScheme: "SECDED",
      acceleratorCount: 1,
    }),
    payload: blankPayload(0),
    labels: {
      ...unverifiedChip,
      vendor: "source",
      name: "source",
      acceleratorCount: "source",
      memoryType: "source",
      memoryCapacity: "source",
      eccScheme: "source",
    },
    payloadLabels: estimatePayload,
    memoryUnit: "GB",
    nodeKnown: false,
    peakKind: "unverified",
    memoryTiles: {
      count: 5,
      label: "source",
      note: "SXM product has five HBM3 stacks. The Starcloud-1 board form factor is UNVERIFIED, so this stack count is the product, not a confirmed flight layout.",
    },
    notes: [
      `SXM product: 80 GB HBM3, five stacks, up to 700 W configurable, SECDED, TSMC 4N. ${H100_PAPER} ${H100_PRODUCT}`,
      "TSMC 4N is a process name, not a nanometer node and not N3. nodeNm 0 is not a measurement.",
      `Starcloud-1 flight form factor is UNVERIFIED. 700 W and 350 W are not assigned to the flight unit. Power 0 is not a measurement. ${STARCLOUD}`,
      "H100 SEU cross-section is UNVERIFIED.",
      "Product bandwidth 3.35 TB/s is the shipping table. It is not used in the rate.",
    ],
  },
  {
    id: "orin-agx",
    title: "Jetson AGX Orin 64GB",
    spec: blankSpec({
      vendor: "NVIDIA",
      name: "Jetson AGX Orin 64GB",
      nodeNm: 8,
      acceleratorCount: 1,
      memoryType: "LPDDR5",
      memoryCapacity: 64,
      avgPowerKw: 0.05,
      peakPowerKw: 0.06,
      tidLimitKradSi: 19,
    }),
    payload: blankPayload(0),
    labels: {
      ...unverifiedChip,
      vendor: "source",
      name: "source",
      nodeNm: "source",
      acceleratorCount: "source",
      memoryType: "source",
      memoryCapacity: "source",
      avgPowerKw: "source",
      peakPowerKw: "source",
      tidLimitKradSi: "source",
    },
    payloadLabels: estimatePayload,
    memoryUnit: "GB",
    nodeKnown: true,
    peakKind: "compute",
    memoryTiles: {
      count: 1,
      label: "estimate",
      note: "One module is drawn as one memory tile. That grouping is an estimate.",
    },
    notes: [
      `64 GB 256-bit LPDDR5. Module power modes include 15 W, 30 W, 50 W, and up to 60 W. Average uses the 50 W mode and peak uses 60 W. ${AGX_DS}`,
      `Samsung 8nm. ${ORIN_NODE}`,
      "Commercial 64 GB and 32 GB DRAM ECC is UNVERIFIED. Industrial JAOi has ECC. This preset does not record none.",
      `TID functional limit 19 krad(Si), one test campaign. ${ORIN_TID}`,
      "AGX SEU cross-section is UNVERIFIED. The NX device number is not copied here.",
      "Latch-up is UNVERIFIED.",
    ],
  },
  {
    id: "orin-nx",
    title: "Jetson Orin NX 16GB",
    spec: blankSpec({
      vendor: "NVIDIA",
      name: "Jetson Orin NX 16GB",
      nodeNm: 8,
      acceleratorCount: 1,
      memoryType: "LPDDR5",
      memoryCapacity: 16,
      avgPowerKw: 0.015,
      peakPowerKw: 0.04,
    }),
    payload: blankPayload(0),
    labels: {
      ...unverifiedChip,
      vendor: "source",
      name: "source",
      nodeNm: "source",
      acceleratorCount: "source",
      memoryType: "source",
      memoryCapacity: "source",
      avgPowerKw: "source",
      peakPowerKw: "source",
    },
    payloadLabels: estimatePayload,
    memoryUnit: "GB",
    nodeKnown: true,
    peakKind: "compute",
    deviceSeu: {
      cm2: 3.52e-10,
      sourceUrl: NX_SEU,
      note: "GPU SEU 3.52e-10 cm2 at 480 MeV protons, TRIUMF BL1B, device cross-section. Bounds 1.42e-10 to 7.26e-10 cm2. SoC SEU at 15 W is 3.90e-9 cm2 and is not the rate used.",
    },
    memoryTiles: {
      count: 1,
      label: "estimate",
      note: "One module is drawn as one memory tile. That grouping is an estimate.",
    },
    notes: [
      `16 GB 128-bit LPDDR5, 102 GB/s. Power modes 10 W, 15 W, 25 W, and 40 W. Average uses 15 W and peak uses 40 W. ${NX_DS}`,
      "DRAM ECC is UNVERIFIED and is not recorded as none.",
      `GPU device SEU 3.52e-10 cm2. SoC SEU at 15 W is 3.90e-9 cm2. ${NX_SEU}`,
      "Latch-up is UNVERIFIED. The AGX 19 krad(Si) result is not copied onto this module.",
    ],
  },
  {
    id: "tpu-v6e",
    title: "Google TPU v6e Trillium",
    spec: blankSpec({
      vendor: "Google",
      name: "TPU v6e Trillium",
      acceleratorCount: 1,
      memoryType: "HBM",
      memoryCapacity: 32,
      tidLimitKradSi: 2,
    }),
    payload: blankPayload(0),
    labels: {
      ...unverifiedChip,
      vendor: "source",
      name: "source",
      acceleratorCount: "source",
      memoryType: "source",
      memoryCapacity: "source",
      tidLimitKradSi: "source",
    },
    payloadLabels: estimatePayload,
    memoryUnit: "GB",
    nodeKnown: false,
    peakKind: "unverified",
    memoryTiles: {
      count: 1,
      label: "UNVERIFIED",
      note: "One chip is drawn as one memory tile. HBM generation and stack count are not stated.",
    },
    notes: [
      `32 GB HBM, 1638 GBps. Generation is not stated. ${TPU}`,
      "Process node, power, ECC, and SEU cross-section are UNVERIFIED. Power 0 is not a measurement.",
      `HBM first irregularity 2 krad(Si). No hard TID failure to 15 krad(Si), n = 1 chip. The stored limit is the first-irregularity point. ${TPU_BLOG}`,
    ],
  },
  {
    id: "samrh71",
    title: "Microchip SAMRH71",
    spec: blankSpec({
      vendor: "Microchip",
      name: "SAMRH71",
      cpuCount: 1,
      memoryType: "Flash",
      memoryCapacity: 128,
      eccScheme: "Flash ECC up to 2-error correction; SRAM ECC up to 1-error correction",
      tidLimitKradSi: 100,
      latchupLet: 62.5,
    }),
    payload: blankPayload(0),
    labels: {
      ...unverifiedChip,
      vendor: "source",
      name: "source",
      cpuCount: "source",
      memoryType: "source",
      memoryCapacity: "source",
      eccScheme: "source",
      tidLimitKradSi: "source",
      latchupLet: "source",
    },
    payloadLabels: estimatePayload,
    memoryUnit: "KB",
    nodeKnown: false,
    peakKind: "unverified",
    memoryTiles: {
      count: 1,
      label: "source",
      note: "The tile is the 128 Kbyte flash. TCM SRAM 384 Kbyte, multiport SRAM 768 Kbyte, and the 16 Kbyte caches are not added.",
    },
    notes: [
      `Flash 128 Kbyte. Arm Cortex-M7, 100 MHz typical. Other memories stay in this note and are not summed. ${SAM}`,
      "TID 100 krad(Si), revisions C and E.",
      "Revision C: no SEL below LET 62.5 MeV.cm2/mg at 125 °C. Revision E: 78. The stored LET is revision C. It is not an SEU cross-section.",
      "SEU cross-section, process node, and wattage are UNVERIFIED. Power 0 is not a measurement.",
      "Bit count uses a decimal kilobyte. That conversion is an estimate.",
    ],
  },
  {
    id: "custom",
    title: "Custom",
    spec: blankSpec({}),
    payload: blankPayload(0),
    labels: unverifiedChip,
    payloadLabels: estimatePayload,
    memoryUnit: "GB",
    nodeKnown: false,
    peakKind: "unverified",
    memoryTiles: {
      count: 0,
      label: "UNVERIFIED",
      note: "No memory tiles until a capacity is entered.",
    },
    notes: ["Custom starts empty. A 0 in an unverified field is not a measurement."],
  },
];

export const DEFAULT_PRESET_ID = "ai1-spacex";

export function getPreset(id: string): ChipPreset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[PRESETS.length - 1];
}

export function badgeForField(
  preset: ChipPreset,
  key: keyof ChipSpec,
  value: ChipSpec[keyof ChipSpec],
): SourceLabel {
  if (value !== preset.spec[key]) {
    return "estimate";
  }
  return preset.labels[key];
}

export function badgeForPayload(
  preset: ChipPreset,
  key: keyof PayloadConfig,
  value: number,
): SourceLabel {
  if (value !== preset.payload[key]) {
    return "estimate";
  }
  return preset.payloadLabels[key];
}
