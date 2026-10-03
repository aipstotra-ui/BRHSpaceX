import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SourceBadge } from "@/components/ui/SourceBadge";
import type { SourceLabel } from "@/lib/types";

const labels: SourceLabel[] = ["source", "estimate", "UNVERIFIED"];

describe("SourceBadge", () => {
  it("renders each label word", () => {
    for (const label of labels) {
      const html = renderToStaticMarkup(<SourceBadge label={label} />);
      expect(html).toContain(label);
      expect(html).toContain(`data-source-label="${label}"`);
    }
  });
});
