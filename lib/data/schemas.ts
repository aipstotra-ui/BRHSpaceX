import { z } from "zod";

const nullableNumber = z.number().nullable();

export const kpSchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    Kp: z.number(),
    a_running: z.number(),
    station_count: z.number(),
  }),
);

export const kp1mSchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    kp_index: z.number(),
    estimated_kp: z.number(),
    kp: z.string(),
  }),
);

export const kpForecastSchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    kp: z.number(),
    observed: z.string(),
    noaa_scale: z.string().nullable(),
  }),
);

const scaleBandSchema = z.looseObject({
  Scale: z.string().nullable(),
  Text: z.string().nullable(),
});

export const scalesSchema = z.record(
  z.string(),
  z.looseObject({
    DateStamp: z.string(),
    TimeStamp: z.string(),
    R: scaleBandSchema,
    S: scaleBandSchema,
    G: scaleBandSchema,
  }),
);

export const goesProtonSchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    satellite: z.number(),
    flux: z.number(),
    energy: z.string(),
  }),
);

export const goesXraySchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    satellite: z.number(),
    flux: z.number(),
    observed_flux: z.number(),
    electron_correction: z.number(),
    electron_contaminaton: z.boolean(),
    energy: z.string(),
  }),
);

export const rtswWindSchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    active: z.boolean(),
    source: z.string(),
    proton_speed: z.number(),
    proton_density: z.number(),
    proton_temperature: z.number(),
    proton_vx_gse: nullableNumber,
    proton_vy_gse: nullableNumber,
    proton_vz_gse: nullableNumber,
    proton_vx_gsm: nullableNumber,
    proton_vy_gsm: nullableNumber,
    proton_vz_gsm: nullableNumber,
  }),
);

export const rtswMagSchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    active: z.boolean(),
    source: z.string(),
    bt: z.number().nullable(),
    bx_gsm: z.number().nullable(),
    by_gsm: z.number().nullable(),
    bz_gsm: z.number().nullable(),
  }),
);

export const dstSchema = z.array(
  z.looseObject({
    time_tag: z.string(),
    dst: z.number(),
  }),
);

export const auroraSchema = z.looseObject({
  "Observation Time": z.string(),
  "Forecast Time": z.string(),
  "Data Format": z.string(),
  coordinates: z.array(z.tuple([z.number(), z.number(), z.number()])),
  type: z.string().optional(),
});

export const f107Schema = z.array(
  z.looseObject({
    time_tag: z.string(),
    frequency: z.number(),
    flux: z.number(),
    reporting_schedule: z.string(),
    avg_begin_date: z.string().nullable(),
    ninety_day_mean: z.number().nullable(),
    rec_count: z.number().nullable(),
  }),
);

export const forecast3daySchema = z.object({
  text: z.string(),
});

export const snapshotJsonSchema = z.union([
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

export const donkiInstrumentSchema = z.looseObject({
  displayName: z.string(),
});

export const donkiSepSchema = z.array(
  z.looseObject({
    instruments: z.array(donkiInstrumentSchema).optional(),
  }),
);
