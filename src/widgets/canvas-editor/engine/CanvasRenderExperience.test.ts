import { describe, expect, it } from 'vitest';
import { CanvasRenderExperience } from './CanvasRenderExperience';

describe('CanvasRenderExperience', () => {
  it('records compositor presentation, rebase, and settle quality', () => {
    let now = 100;
    const experience = new CanvasRenderExperience(() => now);

    experience.recordPresentation('presented');
    experience.recordPresentation('constrained');
    experience.recordPresentation('out-of-coverage');
    experience.recordViewportRebase();
    experience.recordDeferredViewportRender('pan');
    experience.recordDeferredViewportRender('zoom');
    experience.recordViewportActivity();
    experience.recordViewportSceneInvalidation();
    experience.recordViewportMissingBaseline();
    experience.markSettling('viewport-interaction');
    now = 114;
    experience.recordDirectGlyphFrame(240);

    expect(experience.getStats()).toEqual({
      presentationFrames: 2,
      constrainedFrames: 1,
      coverageMissFrames: 1,
      viewportRebases: 1,
      deferredPanRenders: 1,
      deferredZoomRenders: 1,
      viewportSceneInvalidations: 1,
      viewportMissingBaselines: 1,
      viewportActivities: 1,
      directGlyphFrames: 1,
      directGlyphs: 240,
      lastSettleLatencyMs: 14,
    });
  });
});
