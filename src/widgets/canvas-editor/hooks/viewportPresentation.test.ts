import { describe, expect, it } from 'vitest';
import {
  applyCanvasViewportPresentation,
  constrainCanvasViewportTransform,
  resetCanvasViewportPresentation,
  resolveCanvasViewportTransform,
} from './viewportPresentation';

describe('canvas viewport presentation', () => {
  it('maps the last rendered viewport to the presented viewport', () => {
    const transform = resolveCanvasViewportTransform(
      { offset: { x: 10, y: 20 }, zoom: 1 },
      { offset: { x: -88, y: -46 }, zoom: 1.2 }
    );

    expect(transform).toEqual({
      scale: 1.2,
      translateX: -100,
      translateY: -70,
    });
    expect(500 * transform.scale + transform.translateX).toBeCloseTo(500);
    expect(350 * transform.scale + transform.translateY).toBeCloseTo(350);
  });

  it('supports zoom-out and translation-only camera changes', () => {
    expect(
      resolveCanvasViewportTransform(
        { offset: { x: -100, y: -70 }, zoom: 1.2 },
        { offset: { x: 0, y: 0 }, zoom: 1 }
      )
    ).toEqual({
      scale: 1 / 1.2,
      translateX: 100 / 1.2,
      translateY: 70 / 1.2,
    });

    expect(
      resolveCanvasViewportTransform(
        { offset: { x: 10, y: 20 }, zoom: 1 },
        { offset: { x: 25, y: 5 }, zoom: 1 }
      )
    ).toEqual({
      scale: 1,
      translateX: 15,
      translateY: -15,
    });
  });

  it('applies a GPU transform and resets after a matching render', () => {
    const layer = document.createElement('div');

    applyCanvasViewportPresentation(
      layer,
      { offset: { x: 10, y: 20 }, zoom: 1 },
      { offset: { x: -88, y: -46 }, zoom: 1.2 }
    );
    expect(layer.style.transform).toBe('translate3d(-100px, -70px, 0) scale(1.2)');

    applyCanvasViewportPresentation(
      layer,
      { offset: { x: -88, y: -46 }, zoom: 1.2 },
      { offset: { x: -88, y: -46 }, zoom: 1.2 }
    );
    expect(layer.style.transform).toBe('none');

    layer.style.transform = 'scale(2)';
    resetCanvasViewportPresentation(layer);
    expect(layer.style.transform).toBe('none');
  });

  it('stays at identity until a valid rendered viewport exists', () => {
    const layer = document.createElement('div');
    layer.style.transform = 'scale(2)';

    applyCanvasViewportPresentation(layer, null, { offset: { x: 0, y: 0 }, zoom: 1 });

    expect(layer.style.transform).toBe('none');
  });

  it('keeps temporary panning inside the overscan coverage', () => {
    const constrained = constrainCanvasViewportTransform(
      { scale: 1, translateX: 400, translateY: -300 },
      { width: 1000, height: 800, overscan: 128 }
    );

    expect(constrained).toEqual({
      scale: 1,
      translateX: 128,
      translateY: -128,
    });
  });

  it('falls back to the rendered frame when zoom-out exceeds the buffer', () => {
    expect(
      constrainCanvasViewportTransform(
        { scale: 0.7, translateX: 0, translateY: 0 },
        { width: 1000, height: 800, overscan: 128 }
      )
    ).toBeNull();

    const layer = document.createElement('div');
    layer.style.transform = 'translate3d(10px, 10px, 0)';
    applyCanvasViewportPresentation(
      layer,
      { offset: { x: 0, y: 0 }, zoom: 1 },
      { offset: { x: 0, y: 0 }, zoom: 0.7 },
      { width: 1000, height: 800, overscan: 128 }
    );

    expect(layer.style.transform).toBe('none');
  });

  it('applies the requested transform while the buffer still covers the viewport', () => {
    const layer = document.createElement('div');

    applyCanvasViewportPresentation(
      layer,
      { offset: { x: 0, y: 0 }, zoom: 1 },
      { offset: { x: 80, y: -96 }, zoom: 1 },
      { width: 1000, height: 800, overscan: 128 }
    );

    expect(layer.style.transform).toBe('translate3d(80px, -96px, 0) scale(1)');
  });
});
