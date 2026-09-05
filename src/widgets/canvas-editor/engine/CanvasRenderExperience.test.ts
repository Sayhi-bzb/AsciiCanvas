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
      fullContentFrames: 2,
      partialContentFrames: 0,
      totalDirtyCellArea: 0,
      lastFrameDurationMs: 40,
      maxFrameDurationMs: 40,
      p95FrameDurationMs: 40,
      longFrames: 1,
      lastInputPaintMs: 12,
      lastSettleLatencyMs: 43,
    });
  });

  it('separates full and partial content frames', () => {
    const experience = new CanvasRenderExperience();

    experience.recordDirectFrame(100, 4, { kind: 'full' });
    experience.recordDirectFrame(3, 1, { kind: 'partial', dirtyCellArea: 5 });

    expect(experience.getStats()).toMatchObject({
      directFrames: 2,
      totalDirectGlyphs: 103,
      fullContentFrames: 1,
      partialContentFrames: 1,
      totalDirtyCellArea: 5,
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

  it('bounds frame samples while reporting nearest-rank p95', () => {
    const experience = new CanvasRenderExperience();
    for (let duration = 1; duration <= 600; duration += 1) {
      experience.recordDirectFrame(1, duration);
    }

    expect(experience.getStats().p95FrameDurationMs).toBe(575);
  });
});
