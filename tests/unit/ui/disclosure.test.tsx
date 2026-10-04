import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Disclosure, FieldCounts } from "@/components/ui/Disclosure";

describe("Disclosure", () => {
  it("is closed unless asked to start open", () => {
    const closed = renderToStaticMarkup(<Disclosure title="More fields">body</Disclosure>);
    expect(closed).toContain("<details");
    expect(closed).not.toMatch(/<details[^>]* open/);
    expect(renderToStaticMarkup(<Disclosure title="More fields" defaultOpen>body</Disclosure>)).toMatch(/<details[^>]* open/);
  });

  it("is native details and summary, so the keyboard works without script", () => {
    const html = renderToStaticMarkup(<Disclosure title="More fields">body</Disclosure>);
    expect(html).toMatch(/<summary[^>]*>More fields/);
    expect(html).toContain("<details");
  });

  it("keeps the meta in the summary, which stays visible while the body is closed", () => {
    const html = renderToStaticMarkup(
      <Disclosure title="Activity" meta={<span>3 entries</span>}>
        hidden detail
      </Disclosure>,
    );
    const summary = html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
    expect(summary).toContain("3 entries");
    expect(summary).not.toContain("hidden detail");
  });
});

describe("FieldCounts", () => {
  it("counts the hidden fields by label, with the badge each field has", () => {
    const html = renderToStaticMarkup(
      <FieldCounts labels={["source", "estimate", "estimate", "UNVERIFIED", "source", "estimate"]} />,
    );
    expect(html).toContain("6 fields");
    expect(html).toContain('data-source-label="source"');
    expect(html).toContain('data-source-label="estimate"');
    expect(html).toContain('data-source-label="UNVERIFIED"');
    // Only the UNVERIFIED count is visible; source and estimate counts are hidden with their badges.
    const visible = html.replace(/<span[^>]*hidden=""[^>]*>.*?<\/span> \d+<\/span>/g, "").replace(/<[^>]+>/g, " ");
    expect(visible.replace(/\s+/g, " ").trim()).toBe("6 fields UNVERIFIED 1");
    expect(html).toContain('field-counts__item" hidden=""><span data-source-label="source" hidden=""></span> 2');
    expect(html).toContain('field-counts__item" hidden=""><span data-source-label="estimate" hidden=""></span> 3');
  });

  it("does not mention a label nothing has", () => {
    const html = renderToStaticMarkup(<FieldCounts labels={["estimate", "estimate"]} />);
    expect(html).toContain('data-source-label="estimate"');
    expect(html).not.toContain('data-source-label="UNVERIFIED"');
    expect(html).not.toContain('data-source-label="source"');
  });

  it("surfaces an UNVERIFIED field even when it is the only one", () => {
    expect(renderToStaticMarkup(<FieldCounts labels={["UNVERIFIED"]} />)).toContain('data-source-label="UNVERIFIED"');
  });
});
