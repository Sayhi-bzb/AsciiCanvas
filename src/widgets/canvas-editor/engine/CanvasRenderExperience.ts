import type { CanvasRenderActivityMode } from './CanvasRenderActivity';

type CanvasRenderExperienceStats = {
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
  mainThreadGlyphs: number;
  lastPresentationLatencyMs: number | null;
  maxPresentationGapMs: number;
  longPresentationGaps: number;
  lastSettleLatencyMs: number | null;
};

const LONG_PRESENTATION_GAP_MS = 34;

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
  #mainThreadGlyphs = 0;
  #lastViewportActivityAt: number | null = null;
  #lastPresentationAt: number | null = null;
  #lastPresentationLatencyMs: number | null = null;
  #maxPresentationGapMs = 0;
  #longPresentationGaps = 0;
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
      const now = this.#now();
      if (this.#lastViewportActivityAt !== null) {
        this.#lastPresentationLatencyMs = now - this.#lastViewportActivityAt;
        this.#lastViewportActivityAt = null;
      }
      if (this.#lastPresentationAt !== null) {
        const gap = now - this.#lastPresentationAt;
        this.#maxPresentationGapMs = Math.max(this.#maxPresentationGapMs, gap);
        if (gap > LONG_PRESENTATION_GAP_MS) this.#longPresentationGaps += 1;
      }
      this.#lastPresentationAt = now;
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
    this.#lastViewportActivityAt = this.#now();
  }

  recordViewportSceneInvalidation(): void {
    this.#viewportSceneInvalidations += 1;
  }

  recordViewportMissingBaseline(): void {
    this.#viewportMissingBaselines += 1;
  }

  markSettling(previous: CanvasRenderActivityMode): void {
    if (previous !== 'viewport-interaction') return;
    this.#settleStartedAt = this.#now();
    this.#lastViewportActivityAt = null;
    this.#lastPresentationAt = null;
  }

  recordDirectGlyphFrame(glyphs: number): void {
    this.#directGlyphFrames += 1;
    this.#directGlyphs = glyphs;
    this.#mainThreadGlyphs += glyphs;
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
      mainThreadGlyphs: this.#mainThreadGlyphs,
      lastPresentationLatencyMs: this.#lastPresentationLatencyMs,
      maxPresentationGapMs: this.#maxPresentationGapMs,
      longPresentationGaps: this.#longPresentationGaps,
      lastSettleLatencyMs: this.#lastSettleLatencyMs,
    };
  }
}
