import { describe, expect, it } from "vitest";
import { resolveStructuredTemplatePreviewLayout } from "./structured-template-preview-layout";

describe("resolveStructuredTemplatePreviewLayout", () => {
  it("centers a wide preview inside the padded viewport", () => {
    const layout = resolveStructuredTemplatePreviewLayout({
      viewportWidth: 160,
      viewportHeight: 90,
      columns: 44,
      rows: 10,
      cellWidth: 5,
      cellHeight: 9,
    });

    expect(layout?.x).toBeCloseTo(8);
    expect(layout?.y).toBeGreaterThan(8);
    expect(layout?.width).toBeCloseTo(144);
    expect(layout?.height).toBeLessThanOrEqual(74);
  });

  it("centers a tall preview without cropping it", () => {
    const layout = resolveStructuredTemplatePreviewLayout({
      viewportWidth: 160,
      viewportHeight: 90,
      columns: 26,
      rows: 24,
      cellWidth: 5,
      cellHeight: 9,
    });

    expect(layout?.x).toBeGreaterThan(8);
    expect(layout?.y).toBeCloseTo(8);
    expect(layout?.width).toBeLessThanOrEqual(144);
    expect(layout?.height).toBeCloseTo(74);
  });

  it("caps enlargement for compact components", () => {
    const layout = resolveStructuredTemplatePreviewLayout({
      viewportWidth: 160,
      viewportHeight: 90,
      columns: 8,
      rows: 1,
      cellWidth: 5,
      cellHeight: 9,
    });

    expect(layout).toMatchObject({
      x: 40,
      y: 36,
      width: 80,
      height: 18,
      scale: 2,
    });
  });

  it("does not resolve an unmeasurable viewport", () => {
    expect(
      resolveStructuredTemplatePreviewLayout({
        viewportWidth: 0,
        viewportHeight: 90,
        columns: 8,
        rows: 1,
        cellWidth: 5,
        cellHeight: 9,
      })
    ).toBeNull();
  });
});
