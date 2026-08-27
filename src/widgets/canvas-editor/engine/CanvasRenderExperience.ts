import type { CanvasRenderActivityMode } from './CanvasRenderActivity';

export type CanvasRenderExperienceStats = {
  presentationFrames: number;
  constrainedFrames: number;
  coverageMissFrames: number;
  viewportRebases: number;
  deferredPanRenders: number;
  deferredZoomRenders: number;
  viewportSceneInvalidations: number;
  viewportMissingBaselines: number;
  viewportActivities: number;
  directGlyphFrames: number;
  directGlyphs: number;
  lastSettleLatencyMs: number | null;
};

/** Tracks user-visible camera presentation without owning rendering state. */
export class CanvasRenderExperience {
  readonly #now: () => number;
  #presentationFrames = 0;
  #constrainedFrames = 0;
  #coverageMissFrames = 0;
  #viewportRebases = 0;
  #deferredPanRenders = 0;
  #deferredZoomRenders = 0;
  #viewportSceneInvalidations = 0;
  #viewportMissingBaselines = 0;
  #viewportActivities = 0;
  #directGlyphFrames = 0;
  #directGlyphs = 0;
  #settleStartedAt: number | null = null;
  #lastSettleLatencyMs: number | null = null;

  constructor(now: () => number = () => performance.now()) {
    this.#now = now;
  }

  recordPresentation(
    status:
      | 'identity'
      | 'presented'
      | 'constrained'
      | 'out-of-coverage'
      | 'unavailable'
  ): void {
    if (status === 'presented' || status === 'constrained') {
      this.#presentationFrames += 1;
    }
    if (status === 'constrained') this.#constrainedFrames += 1;
    if (status === 'out-of-coverage') this.#coverageMissFrames += 1;
  }

  recordViewportRebase(): void {
    this.#viewportRebases += 1;
  }

  recordDeferredViewportRender(kind: 'pan' | 'zoom'): void {
    if (kind === 'pan') this.#deferredPanRenders += 1;
    else this.#deferredZoomRenders += 1;
  }

  recordViewportActivity(): void {
    this.#viewportActivities += 1;
  }

  recordViewportSceneInvalidation(): void {
    this.#viewportSceneInvalidations += 1;
  }

  recordViewportMissingBaseline(): void {
    this.#viewportMissingBaselines += 1;
  }

  markSettling(previous: CanvasRenderActivityMode): void {
    if (previous === 'viewport-interaction') this.#settleStartedAt = this.#now();
  }

  recordDirectGlyphFrame(glyphs: number): void {
    this.#directGlyphFrames += 1;
    this.#directGlyphs = glyphs;
    if (this.#settleStartedAt === null) return;
    this.#lastSettleLatencyMs = this.#now() - this.#settleStartedAt;
    this.#settleStartedAt = null;
  }

  getStats(): CanvasRenderExperienceStats {
    return {
      presentationFrames: this.#presentationFrames,
      constrainedFrames: this.#constrainedFrames,
      coverageMissFrames: this.#coverageMissFrames,
      viewportRebases: this.#viewportRebases,
      deferredPanRenders: this.#deferredPanRenders,
      deferredZoomRenders: this.#deferredZoomRenders,
      viewportSceneInvalidations: this.#viewportSceneInvalidations,
      viewportMissingBaselines: this.#viewportMissingBaselines,
      viewportActivities: this.#viewportActivities,
      directGlyphFrames: this.#directGlyphFrames,
      directGlyphs: this.#directGlyphs,
      lastSettleLatencyMs: this.#lastSettleLatencyMs,
    };
  }
}
