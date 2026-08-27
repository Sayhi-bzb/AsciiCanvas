type CanvasMemoryCategory =
  | "raster"
  | "cell-plane"
  | "worker-source"
  | "font";

export type CanvasMemoryPressure = "normal" | "constrained" | "critical";

const MIB = 1024 * 1024;

/** Central byte accounting and adaptive limits for canvas-owned memory. */
export class CanvasMemoryGovernor {
  readonly #baseBudget: number;
  readonly #usage = new Map<CanvasMemoryCategory, number>();
  #pressure: CanvasMemoryPressure = "normal";

  constructor(baseBudget = 64 * MIB) {
    this.#baseBudget = baseBudget;
  }

  report(category: CanvasMemoryCategory, bytes: number): void {
    this.#usage.set(category, Math.max(0, bytes));
  }

  setPressure(pressure: CanvasMemoryPressure): void {
    this.#pressure = pressure;
  }

  getLimit(category: CanvasMemoryCategory): number {
    const deviceMemory = typeof navigator === "undefined"
      ? 8
      : (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const deviceFactor = deviceMemory <= 4 ? 0.6 : deviceMemory <= 8 ? 0.85 : 1;
    const visibilityFactor = typeof document !== "undefined" && document.hidden ? 0.5 : 1;
    const pressureFactor = this.#pressure === "critical"
      ? 0.35
      : this.#pressure === "constrained"
        ? 0.65
        : 1;
    const share = category === "raster"
      ? 0.55
      : category === "cell-plane"
        ? 0.25
        : 0.1;
    return Math.max(2 * MIB, Math.floor(
      this.#baseBudget * share * deviceFactor * visibilityFactor * pressureFactor
    ));
  }

  getStats() {
    return {
      budget: this.#baseBudget,
      pressure: this.#pressure,
      totalBytes: [...this.#usage.values()].reduce((sum, bytes) => sum + bytes, 0),
      usage: Object.fromEntries(this.#usage),
      rasterLimit: this.getLimit("raster"),
    };
  }
}
