import { z } from "zod";

import ranges from "@/data/scenario/ranges.json";

const speed = ranges.speedKmS;
const density = ranges.densityCm3;
const bz = ranges.bzNt;
const duration = ranges.durationH;

function bounded(min: number, max: number, source: string) {
  return z.number().finite().min(min, `Below ${min}, the low end in ${source}`).max(max, `Above ${max}, the high end in ${source}`);
}

export const scenarioSchema = z.object({
  cmeSpeedKmS: bounded(speed.min, speed.max, speed.source),
  bzNt: bounded(bz.min, bz.max, bz.source),
  densityCm3: bounded(density.min, density.max, density.source),
  durationH: z
    .number()
    .finite()
    .gt(0, "Duration must be longer than 0 hours")
    .max(duration.max, `Above ${duration.max} hours, the longest Kp>=5 run in ${duration.source}`),
  arrivalTime: z.string().refine((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && time > Date.now();
  }, "Arrival time must be a UTC time after now"),
});

export type ScenarioInput = z.infer<typeof scenarioSchema>;
