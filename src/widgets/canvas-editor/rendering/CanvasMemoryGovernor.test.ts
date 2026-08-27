import { describe, expect, it } from "vitest";
import { CanvasMemoryGovernor } from "./CanvasMemoryGovernor";

describe("CanvasMemoryGovernor", () => {
  it("shrinks category limits under pressure", () => {
    const governor = new CanvasMemoryGovernor(64 * 1024 * 1024);
    const normal = governor.getLimit("raster");
    governor.setPressure("critical");
    expect(governor.getLimit("raster")).toBeLessThan(normal);
  });

  it("accounts memory by owner", () => {
    const governor = new CanvasMemoryGovernor();
    governor.report("raster", 100);
    governor.report("font", 20);
    expect(governor.getStats()).toMatchObject({ totalBytes: 120 });
  });
});
