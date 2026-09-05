import type { CanvasRenderActivityMode } from './CanvasRenderActivity';

/** @internal */
export type CanvasRenderExperienceStats = {
  viewportActivities: number;
  directFrames: number;
  directGlyphs: number;
  totalDirectGlyphs: number;
  fullContentFrames: number;
  partialContentFrames: number;
  totalDirtyCellArea: number;
  lastFrameDurationMs: number | null;
  maxFrameDurationMs: number;
  p95FrameDurationMs: number;
  longFrames: number;
  lastInputPaintMs: number | null;
  lastSettleLatencyMs: number | null;
  managedInputBatches: number;
  managedInputTextLength: number;
  firstManagedInputBatches: number;
  burstManagedInputBatches: number;
  boundaryManagedInputBatches: number;
  imeManagedInputBatches: number;
  firstManagedInputCommitP95Ms: number;
  burstManagedInputCommitP95Ms: number;
  burstManagedInputCommitMaxMs: number;
  managedInputCommitP95Ms: number;
  managedInputCommitMaxMs: number;
};

const LONG_FRAME_MS = 34;
const FRAME_DURATION_SAMPLE_LIMIT = 512;
const INPUT_LATENCY_SAMPLE_LIMIT = 512;

const p95 = (samples: Float64Array, length: number) => {
  const values = Array.from(samples.subarray(0, length)).sort(
    (left, right) => left - right
  );
  return values[Math.max(0, Math.ceil(values.length * 0.95) - 1)] ?? 0;
};

/** Tracks exact visible-region rendering without owning rendering state. */
export class CanvasRenderExperience {
  readonly #now: () => number;
  #viewportActivities = 0;
  #directFrames = 0;
  #directGlyphs = 0;
  #totalDirectGlyphs = 0;
  #fullContentFrames = 0;
  #partialContentFrames = 0;
  #totalDirtyCellArea = 0;
  #lastFrameDurationMs: number | null = null;
  #maxFrameDurationMs = 0;
  readonly #frameDurations = new Float64Array(FRAME_DURATION_SAMPLE_LIMIT);
  #frameDurationSamples = 0;
  #nextFrameDurationSample = 0;
  #longFrames = 0;
  #lastViewportActivityAt: number | null = null;
  #lastInputPaintMs: number | null = null;
  #settleStartedAt: number | null = null;
  #lastSettleLatencyMs: number | null = null;
  #managedInputBatches = 0;
  #managedInputTextLength = 0;
  #firstManagedInputBatches = 0;
  #burstManagedInputBatches = 0;
  #boundaryManagedInputBatches = 0;
  #imeManagedInputBatches = 0;
  readonly #firstManagedInputLatencies = new Float64Array(INPUT_LATENCY_SAMPLE_LIMIT);
  #firstManagedInputLatencySamples = 0;
  #nextFirstManagedInputLatencySample = 0;
  readonly #burstManagedInputLatencies = new Float64Array(INPUT_LATENCY_SAMPLE_LIMIT);
  #burstManagedInputLatencySamples = 0;
  #nextBurstManagedInputLatencySample = 0;
  #burstManagedInputCommitMaxMs = 0;
  readonly #managedInputCommitDurations = new Float64Array(INPUT_LATENCY_SAMPLE_LIMIT);
  #managedInputCommitDurationSamples = 0;
  #nextManagedInputCommitDurationSample = 0;
  #managedInputCommitMaxMs = 0;

  constructor(now: () => number = () => performance.now()) {
    this.#now = now;
  }

  recordViewportActivity(): void {
    this.#viewportActivities += 1;
    this.#lastViewportActivityAt = this.#now();
  }

  markSettling(previous: CanvasRenderActivityMode): void {
    if (previous !== 'viewport-interaction') return;
    this.#settleStartedAt = this.#now();
  }

  recordDirectFrame(
    glyphs: number,
    durationMs: number,
    details: { kind?: 'full' | 'partial'; dirtyCellArea?: number } = {}
  ): void {
    this.#directFrames += 1;
    this.#directGlyphs = glyphs;
    this.#totalDirectGlyphs += glyphs;
    if (details.kind === 'partial') this.#partialContentFrames += 1;
    else this.#fullContentFrames += 1;
    this.#totalDirtyCellArea += details.dirtyCellArea ?? 0;
    this.#lastFrameDurationMs = durationMs;
    this.#maxFrameDurationMs = Math.max(this.#maxFrameDurationMs, durationMs);
    this.#frameDurations[this.#nextFrameDurationSample] = durationMs;
    this.#nextFrameDurationSample =
      (this.#nextFrameDurationSample + 1) % FRAME_DURATION_SAMPLE_LIMIT;
    this.#frameDurationSamples = Math.min(
      this.#frameDurationSamples + 1,
      FRAME_DURATION_SAMPLE_LIMIT
    );
    if (durationMs > LONG_FRAME_MS) this.#longFrames += 1;

    const now = this.#now();
    if (this.#lastViewportActivityAt !== null) {
      this.#lastInputPaintMs = now - this.#lastViewportActivityAt;
      this.#lastViewportActivityAt = null;
    }
    if (this.#settleStartedAt !== null) {
      this.#lastSettleLatencyMs = now - this.#settleStartedAt;
      this.#settleStartedAt = null;
    }
  }

  recordManagedInputBatch(sample: {
    kind: 'first' | 'burst' | 'boundary' | 'ime';
    textLength: number;
    latencyMs: number;
    commitDurationMs: number;
  }): void {
    this.#managedInputBatches += 1;
    this.#managedInputTextLength += sample.textLength;
    this.#managedInputCommitDurations[this.#nextManagedInputCommitDurationSample] =
      sample.commitDurationMs;
    this.#nextManagedInputCommitDurationSample =
      (this.#nextManagedInputCommitDurationSample + 1) % INPUT_LATENCY_SAMPLE_LIMIT;
    this.#managedInputCommitDurationSamples = Math.min(
      this.#managedInputCommitDurationSamples + 1,
      INPUT_LATENCY_SAMPLE_LIMIT
    );
    this.#managedInputCommitMaxMs = Math.max(
      this.#managedInputCommitMaxMs,
      sample.commitDurationMs
    );
    if (sample.kind === 'first') {
      this.#firstManagedInputBatches += 1;
      this.#firstManagedInputLatencies[this.#nextFirstManagedInputLatencySample] =
        sample.latencyMs;
      this.#nextFirstManagedInputLatencySample =
        (this.#nextFirstManagedInputLatencySample + 1) % INPUT_LATENCY_SAMPLE_LIMIT;
      this.#firstManagedInputLatencySamples = Math.min(
        this.#firstManagedInputLatencySamples + 1,
        INPUT_LATENCY_SAMPLE_LIMIT
      );
    } else if (sample.kind === 'burst') {
      this.#burstManagedInputBatches += 1;
      this.#burstManagedInputLatencies[this.#nextBurstManagedInputLatencySample] =
        sample.latencyMs;
      this.#nextBurstManagedInputLatencySample =
        (this.#nextBurstManagedInputLatencySample + 1) % INPUT_LATENCY_SAMPLE_LIMIT;
      this.#burstManagedInputLatencySamples = Math.min(
        this.#burstManagedInputLatencySamples + 1,
        INPUT_LATENCY_SAMPLE_LIMIT
      );
      this.#burstManagedInputCommitMaxMs = Math.max(
        this.#burstManagedInputCommitMaxMs,
        sample.latencyMs
      );
    } else if (sample.kind === 'boundary') {
      this.#boundaryManagedInputBatches += 1;
    } else {
      this.#imeManagedInputBatches += 1;
    }
  }

  getStats(): CanvasRenderExperienceStats {
    const durations = Array.from(
      this.#frameDurations.subarray(0, this.#frameDurationSamples)
    ).sort((left, right) => left - right);
    const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
    return {
      viewportActivities: this.#viewportActivities,
      directFrames: this.#directFrames,
      directGlyphs: this.#directGlyphs,
      totalDirectGlyphs: this.#totalDirectGlyphs,
      fullContentFrames: this.#fullContentFrames,
      partialContentFrames: this.#partialContentFrames,
      totalDirtyCellArea: this.#totalDirtyCellArea,
      lastFrameDurationMs: this.#lastFrameDurationMs,
      maxFrameDurationMs: this.#maxFrameDurationMs,
      p95FrameDurationMs: durations[p95Index] ?? 0,
      longFrames: this.#longFrames,
      lastInputPaintMs: this.#lastInputPaintMs,
      lastSettleLatencyMs: this.#lastSettleLatencyMs,
      managedInputBatches: this.#managedInputBatches,
      managedInputTextLength: this.#managedInputTextLength,
      firstManagedInputBatches: this.#firstManagedInputBatches,
      burstManagedInputBatches: this.#burstManagedInputBatches,
      boundaryManagedInputBatches: this.#boundaryManagedInputBatches,
      imeManagedInputBatches: this.#imeManagedInputBatches,
      firstManagedInputCommitP95Ms: p95(
        this.#firstManagedInputLatencies,
        this.#firstManagedInputLatencySamples
      ),
      burstManagedInputCommitP95Ms: p95(
        this.#burstManagedInputLatencies,
        this.#burstManagedInputLatencySamples
      ),
      burstManagedInputCommitMaxMs: this.#burstManagedInputCommitMaxMs,
      managedInputCommitP95Ms: p95(
        this.#managedInputCommitDurations,
        this.#managedInputCommitDurationSamples
      ),
      managedInputCommitMaxMs: this.#managedInputCommitMaxMs,
    };
  }
}
