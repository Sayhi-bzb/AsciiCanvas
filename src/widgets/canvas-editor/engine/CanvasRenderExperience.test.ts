import { describe, expect, it } from 'vitest';
import { CanvasRenderExperience } from './CanvasRenderExperience';

describe('CanvasRenderExperience', () => {
  it('tracks exact frames, glyphs, latency, and long renders', () => {
    let now = 0;
    const experience = new CanvasRenderExperience(() => now);

    experience.recordViewportActivity();
    now = 12;
    experience.recordDirectFrame(240, 8);
    experience.markSettling('viewport-interaction');
    now = 55;
    experience.recordDirectFrame(180, 40);

    expect(experience.getStats()).toEqual({
      viewportActivities: 1,
      directFrames: 2,
      directGlyphs: 180,
      totalDirectGlyphs: 420,
      lastFrameDurationMs: 40,
      maxFrameDurationMs: 40,
      longFrames: 1,
      lastInputPaintMs: 12,
      lastSettleLatencyMs: 43,
    });
  });

  it('ignores non-viewport settling transitions', () => {
    let now = 0;
    const experience = new CanvasRenderExperience(() => now);

    experience.markSettling('content-interaction');
    now = 20;
    experience.recordDirectFrame(1, 2);

    expect(experience.getStats().lastSettleLatencyMs).toBeNull();
  });
});
