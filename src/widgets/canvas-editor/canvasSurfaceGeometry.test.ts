import { describe, expect, it } from 'vitest';
import {
  CANVAS_OVERSCAN_PX,
  offsetCanvasViewportForSurface,
  resolveCanvasSurfaceGeometry,
} from './canvasSurfaceGeometry';

describe('canvas surface geometry', () => {
  it('adds a fixed gutter around the visible viewport', () => {
    expect(resolveCanvasSurfaceGeometry({ width: 1024, height: 768 })).toEqual({
      viewportWidth: 1024,
      viewportHeight: 768,
      width: 1024 + CANVAS_OVERSCAN_PX * 2,
      height: 768 + CANVAS_OVERSCAN_PX * 2,
      left: -CANVAS_OVERSCAN_PX,
      top: -CANVAS_OVERSCAN_PX,
      overscan: CANVAS_OVERSCAN_PX,
    });
  });

  it('preserves screen coordinates after the surface is moved into the gutter', () => {
    const geometry = resolveCanvasSurfaceGeometry({ width: 800, height: 600 });
    const logicalOffset = { x: -240, y: 90 };
    const renderOffset = offsetCanvasViewportForSurface(logicalOffset, geometry);
    const worldPoint = { x: 320, y: 180 };
    const zoom = 1.25;

    expect(geometry.left + worldPoint.x * zoom + renderOffset.x).toBe(
      worldPoint.x * zoom + logicalOffset.x
    );
    expect(geometry.top + worldPoint.y * zoom + renderOffset.y).toBe(
      worldPoint.y * zoom + logicalOffset.y
    );
  });
});
