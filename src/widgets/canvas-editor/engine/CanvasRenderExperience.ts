import type { CanvasRenderActivityMode } from './CanvasRenderActivity';

/** @internal */
export type CanvasRenderExperienceStats = {
  viewportActivities: number;
  directFrames: number;
  directGlyphs: number;
  totalDirectGlyphs: number;
  lastFrameDurationMs: number | null;
  maxFrameDurationMs: number;
  longFrames: number;
  lastInputPaintMs: number | null;
  lastSettleLatencyMs: number | null;
};

const LONG_FRAME_MS = 34;

/** Tracks exact visible-region rendering without owning rendering state. */
export class CanvasRenderExperience {
  readonly #now: () => number;
  #viewportActivities = 0;
  #directFrames = 0;
  #directGlyphs = 0;
  #totalDirectGlyphs = 0;
  #lastFrameDurationMs: number | null = null;
  #maxFrameDurationMs = 0;
  #longFrames = 0;
  #lastViewportActivityAt: number | null = null;
  #lastInputPaintMs: number | null = null;
  #settleStartedAt: number | null = null;
  #lastSettleLatencyMs: number | null = null;

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

  recordDirectFrame(glyphs: number, durationMs: number): void {
    this.#directFrames += 1;
    this.#directGlyphs = glyphs;
    this.#totalDirectGlyphs += glyphs;
    this.#lastFrameDurationMs = durationMs;
    this.#maxFrameDurationMs = Math.max(this.#maxFrameDurationMs, durationMs);
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

  getStats(): CanvasRenderExperienceStats {
    return {
      viewportActivities: this.#viewportActivities,
      directFrames: this.#directFrames,
      directGlyphs: this.#directGlyphs,
      totalDirectGlyphs: this.#totalDirectGlyphs,
      lastFrameDurationMs: this.#lastFrameDurationMs,
      maxFrameDurationMs: this.#maxFrameDurationMs,
      longFrames: this.#longFrames,
      lastInputPaintMs: this.#lastInputPaintMs,
      lastSettleLatencyMs: this.#lastSettleLatencyMs,
    };
  }
}
