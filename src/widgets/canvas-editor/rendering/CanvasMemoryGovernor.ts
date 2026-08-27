type CanvasMemoryCategory = "raster" | "cell-plane" | "worker-source";

type CanvasMemoryPressure = "normal" | "constrained" | "critical";

export type CanvasMemoryPolicy = {
  pressure: CanvasMemoryPressure;
  hidden: boolean;
};

const MIB = 1024 * 1024;
const CATEGORY_SHARES: Record<CanvasMemoryCategory, number> = {
  raster: 0.55,
  "cell-plane": 0.25,
  "worker-source": 0.2,
};
const PRESSURE_FACTORS: Record<CanvasMemoryPressure, number> = {
  normal: 1,
  constrained: 0.65,
  critical: 0.35,
};
const PRESSURE_RANK: Record<CanvasMemoryPressure, number> = {
  normal: 0,
  constrained: 1,
  critical: 2,
};

const maxPressure = (...pressures: CanvasMemoryPressure[]) =>
  pressures.reduce((highest, pressure) =>
    PRESSURE_RANK[pressure] > PRESSURE_RANK[highest] ? pressure : highest
  , "normal");

/** Workspace-owned byte accounting and adaptive cache policy. */
export class CanvasMemoryGovernor {
  readonly #baseBudget: number;
  readonly #usage = new Map<CanvasMemoryCategory, number>();
  readonly #listeners = new Set<(policy: CanvasMemoryPolicy) => void>();
  #usagePressure: CanvasMemoryPressure = "normal";
  #forcedPressure: CanvasMemoryPressure = "normal";
  #pressure: CanvasMemoryPressure = "normal";
  #hidden = false;

  constructor(baseBudget = 96 * MIB) {
    this.#baseBudget = baseBudget;
  }

  report(category: CanvasMemoryCategory, bytes: number): void {
    const normalized = Math.max(0, bytes);
    if (this.#usage.get(category) === normalized) return;
    this.#usage.set(category, normalized);
    this.#usagePressure = this.#resolveUsagePressure();
    this.#syncPolicy();
  }

  /** Compatibility pressure floor for tests and explicit platform signals. */
  setPressure(pressure: CanvasMemoryPressure): void {
    if (this.#forcedPressure === pressure) return;
    this.#forcedPressure = pressure;
    this.#syncPolicy();
  }

  setVisibility(hidden: boolean): void {
    if (this.#hidden === hidden) return;
    this.#hidden = hidden;
    this.#syncPolicy(true);
  }

  subscribe(listener: (policy: CanvasMemoryPolicy) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  getLimit(category: CanvasMemoryCategory): number {
    return Math.max(
      2 * MIB,
      Math.floor(this.#getNominalLimit(category) * PRESSURE_FACTORS[this.#pressure])
    );
  }

  getPolicy(): CanvasMemoryPolicy {
    return { pressure: this.#pressure, hidden: this.#hidden };
  }

  getStats() {
    const usage = {
      raster: this.#usage.get("raster") ?? 0,
      "cell-plane": this.#usage.get("cell-plane") ?? 0,
      "worker-source": this.#usage.get("worker-source") ?? 0,
    };
    return {
      baseBudget: this.#baseBudget,
      nominalBudget: this.#getNominalBudget(),
      pressure: this.#pressure,
      hidden: this.#hidden,
      totalBytes: Object.values(usage).reduce((sum, bytes) => sum + bytes, 0),
      usage,
      limits: {
        raster: this.getLimit("raster"),
        "cell-plane": this.getLimit("cell-plane"),
        "worker-source": this.getLimit("worker-source"),
      },
    };
  }

  #getDeviceFactor() {
    const deviceMemory = typeof navigator === "undefined"
      ? 8
      : (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    return deviceMemory <= 4 ? 0.6 : deviceMemory <= 8 ? 0.85 : 1;
  }

  #getNominalBudget() {
    return Math.floor(this.#baseBudget * this.#getDeviceFactor());
  }

  #getNominalLimit(category: CanvasMemoryCategory) {
    return this.#getNominalBudget() * CATEGORY_SHARES[category];
  }

  #resolveUsagePressure(): CanvasMemoryPressure {
    const total = [...this.#usage.values()].reduce((sum, bytes) => sum + bytes, 0);
    // Category shares drive local eviction, but idle categories lend their budget
    // to the mandatory visible working set. Global pressure follows the pool.
    const ratio = total / this.#getNominalBudget();

    if (this.#usagePressure === "critical") {
      if (ratio >= 0.85) return "critical";
      if (ratio >= 0.7) return "constrained";
      return "normal";
    }
    if (this.#usagePressure === "constrained") {
      if (ratio >= 0.95) return "critical";
      return ratio >= 0.7 ? "constrained" : "normal";
    }
    if (ratio >= 0.95) return "critical";
    if (ratio >= 0.8) return "constrained";
    return "normal";
  }

  #syncPolicy(forceNotify = false) {
    const pressure = maxPressure(
      this.#usagePressure,
      this.#forcedPressure,
      this.#hidden ? "constrained" : "normal"
    );
    if (pressure === this.#pressure && !forceNotify) return;
    this.#pressure = pressure;
    const policy = this.getPolicy();
    this.#listeners.forEach((listener) => listener(policy));
  }
}
