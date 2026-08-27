import { describe, expect, it } from 'vitest';
import { CANVAS_FRAME_INVALIDATION } from '../engine/FrameScheduler';
import {
  resolveCanvasRenderPasses,
  shouldDrawCanvasHotPatch,
} from './useCanvasRenderer';

describe('canvas render passes', () => {
  it('keeps dynamic interaction updates off the content surface', () => {
    expect(resolveCanvasRenderPasses(CANVAS_FRAME_INVALIDATION.overlay)).toEqual({
      content: false,
      interaction: true,
    });
    expect(resolveCanvasRenderPasses(CANVAS_FRAME_INVALIDATION.scratch)).toEqual({
      content: false,
      interaction: true,
    });
  });

  it('redraws both surfaces for viewport changes', () => {
    expect(
      resolveCanvasRenderPasses(
        CANVAS_FRAME_INVALIDATION.background |
          CANVAS_FRAME_INVALIDATION.scratch |
          CANVAS_FRAME_INVALIDATION.overlay
      )
    ).toEqual({ content: true, interaction: true });
  });

  it('keeps large content invalidations off the synchronous glyph path', () => {
    expect(shouldDrawCanvasHotPatch({ x: 0, y: 0, width: 16, height: 16 })).toBe(true);
    expect(shouldDrawCanvasHotPatch({ x: 0, y: 0, width: 17, height: 16 })).toBe(false);
  });
});
