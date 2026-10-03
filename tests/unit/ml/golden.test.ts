import { describe, expect, it } from "vitest";

import { vectorFromMap, type HourlyColumns, computeFeatureMap } from "@/lib/ml/features";
import { runModel } from "@/lib/ml/ort";
import card from "@/public/models/model-card.json";
import fixture from "@/public/models/feature_fixture.json";
import golden from "@/public/models/golden_forecast.json";

describe("onnx golden vector", () => {
  it("builds the model-card tensor and matches Python within 1e-5", async () => {
    const names = card.feature_names;
    expect(names).toEqual(Object.keys(golden.features));
    const vector = vectorFromMap(names, golden.features);
    expect(vector).toHaveLength(names.length);
    for (const model of card.models) {
      const expected = golden.outputs[model.file as keyof typeof golden.outputs][0];
      const got = await runModel(model.file, vector, model.output_name);
      expect(Math.abs(got - expected)).toBeLessThanOrEqual(1e-5);
    }
  }, 120_000);

  it("recomputes the 96-hour fixture with the same feature names", () => {
    const columns = fixture.columns;
    const hourly: HourlyColumns = {
      times: fixture.times,
      bz_gsm: columns.bz_gsm,
      by_gsm: columns.by_gsm,
      speed: columns.speed,
      density: columns.density,
      pdyn: columns.pdyn,
      kp: columns.kp,
      dst: columns.dst,
      f107: columns.f107,
    };
    const map = computeFeatureMap(hourly, fixture.issue_time);
    for (const name of card.feature_names) {
      const expected = fixture.expected_features[name as keyof typeof fixture.expected_features];
      const got = map[name];
      expect(got).not.toBeNull();
      expect(got as number).toBeCloseTo(expected, 5);
    }
  });
});
