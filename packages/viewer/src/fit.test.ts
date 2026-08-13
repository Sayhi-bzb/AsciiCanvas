import { describe, expect, it } from "vitest";
import { calculateCharDeskFitZoom } from "./fit.js";

const metrics = {
  mode: "width" as const,
  naturalWidth: 300,
  naturalHeight: 200,
  availableWidth: 600,
  availableHeight: 400,
  baseFontSize: 15,
  maxFontSize: 20,
  minZoom: 0.25,
  maxZoom: 4,
};

describe("calculateCharDeskFitZoom", () => {
  it("limits automatic enlargement by effective font size", () => {
    expect(calculateCharDeskFitZoom(metrics)).toBeCloseTo(20 / 15);
  });

  it("allows wide documents to shrink below the base font size", () => {
    expect(
      calculateCharDeskFitZoom({
        ...metrics,
        naturalWidth: 1200,
        availableWidth: 600,
      })
    ).toBe(0.5);
  });

  it("uses width, height, and font limits for contain", () => {
    expect(
      calculateCharDeskFitZoom({
        ...metrics,
        mode: "contain",
        availableHeight: 100,
      })
    ).toBe(0.5);
  });

  it("respects the global zoom range", () => {
    expect(
      calculateCharDeskFitZoom({
        ...metrics,
        naturalWidth: 10_000,
      })
    ).toBe(0.25);
    expect(
      calculateCharDeskFitZoom({
        ...metrics,
        naturalWidth: 1,
        baseFontSize: 1,
        maxFontSize: 100,
      })
    ).toBe(4);
  });
});
