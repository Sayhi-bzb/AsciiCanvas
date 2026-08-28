import { describe, expect, it, vi } from "vitest";
import { CanvasMemoryGovernor } from "./CanvasMemoryGovernor";

describe("CanvasMemoryGovernor", () => {
  it("shrinks category limits under an explicit pressure floor", () => {
    const governor = new CanvasMemoryGovernor(64 * 1024 * 1024);
    const normal = governor.getLimit("raster");
    governor.setPressure("critical");
    expect(governor.getLimit("raster")).toBeLessThan(normal);
  });

  it("accounts measurable memory categories", () => {
    const governor = new CanvasMemoryGovernor();
    governor.report("raster", 100);
    governor.report("worker-source", 20);
    expect(governor.getStats()).toMatchObject({ totalBytes: 120 });
  });

  it("keeps low-memory devices below the high-memory workspace pool", () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "deviceMemory");
    try {
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 4 });
      const low = new CanvasMemoryGovernor().getStats().nominalBudget;
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 16 });
      const high = new CanvasMemoryGovernor().getStats().nominalBudget;
      expect(low).toBeLessThan(high);
    } finally {
      if (descriptor) Object.defineProperty(navigator, "deviceMemory", descriptor);
      else delete (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    }
  });

  it("uses hysteresis for automatic pressure transitions", () => {
    const governor = new CanvasMemoryGovernor(64 * 1024 * 1024);
    const nominalBudget = governor.getStats().nominalBudget;

    governor.report("raster", nominalBudget * 0.81);
    expect(governor.getPolicy().pressure).toBe("constrained");
    governor.report("raster", nominalBudget * 0.75);
    expect(governor.getPolicy().pressure).toBe("constrained");
    governor.report("raster", nominalBudget * 0.69);
    expect(governor.getPolicy().pressure).toBe("normal");
    governor.report("raster", nominalBudget * 0.96);
    expect(governor.getPolicy().pressure).toBe("critical");
    governor.report("raster", nominalBudget * 0.84);
    expect(governor.getPolicy().pressure).toBe("constrained");
  });

  it("forces constrained policy while hidden and notifies once per transition", () => {
    const governor = new CanvasMemoryGovernor();
    const listener = vi.fn();
    governor.subscribe(listener);

    governor.setVisibility(true);
    governor.setVisibility(true);
    expect(governor.getPolicy()).toEqual({ pressure: "constrained", hidden: true });
    expect(listener).toHaveBeenCalledTimes(1);

    governor.setVisibility(false);
    expect(governor.getPolicy()).toEqual({ pressure: "normal", hidden: false });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies visibility changes when usage already has the same pressure", () => {
    const governor = new CanvasMemoryGovernor();
    const listener = vi.fn();
    const nominalBudget = governor.getStats().nominalBudget;
    governor.report("raster", nominalBudget * 0.81);
    governor.subscribe(listener);

    governor.setVisibility(true);
    governor.setVisibility(false);

    expect(listener).toHaveBeenNthCalledWith(1, {
      pressure: "constrained",
      hidden: true,
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      pressure: "constrained",
      hidden: false,
    });
  });
});
