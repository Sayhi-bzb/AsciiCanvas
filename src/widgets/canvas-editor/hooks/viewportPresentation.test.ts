import { describe, expect, it } from 'vitest';
import {
  applyCanvasViewportPresentation,
  CanvasViewportRebaseGate,
  constrainCanvasViewportTransform,
  resetCanvasViewportPresentation,
  resolveCanvasViewportTransform,
  resolveCanvasViewportRenderDecision,
  shouldDeferCanvasViewportRender,
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

  it('preserves continuous diagonal presentation without changing camera state', () => {
    const layer = document.createElement('div');
    const rendered = { offset: { x: 0, y: 0 }, zoom: 1 };
    const presented = { offset: { x: 10.24, y: -4.76 }, zoom: 1 };

    expect(applyCanvasViewportPresentation(
      layer,
      rendered,
      presented,
      { width: 1000, height: 800, overscan: 128 }
    )).toBe('presented');
    expect(layer.style.transform).toBe(
      'translate3d(10.24px, -4.76px, 0) scale(1)'
    );
    expect(presented).toEqual({ offset: { x: 10.24, y: -4.76 }, zoom: 1 });
  });

  it('applies a GPU transform and resets after a matching render', () => {
    const layer = document.createElement('div');

    expect(applyCanvasViewportPresentation(
      layer,
      { offset: { x: 10, y: 20 }, zoom: 1 },
      { offset: { x: -88, y: -46 }, zoom: 1.2 }
    )).toBe('presented');
    expect(layer.style.transform).toBe('translate3d(-100px, -70px, 0) scale(1.2)');

    expect(applyCanvasViewportPresentation(
      layer,
      { offset: { x: -88, y: -46 }, zoom: 1.2 },
      { offset: { x: -88, y: -46 }, zoom: 1.2 }
    )).toBe('identity');
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

  it('reports constrained presentation so the caller can rebase once', () => {
    const layer = document.createElement('div');

    expect(applyCanvasViewportPresentation(
      layer,
      { offset: { x: 0, y: 0 }, zoom: 1 },
      { offset: { x: 400, y: -300 }, zoom: 1 },
      { width: 1000, height: 800, overscan: 128 }
    )).toBe('constrained');
    expect(layer.style.transform).toBe('translate3d(128px, -128px, 0) scale(1)');
  });

  it('deduplicates overscan rebases until a rendered frame completes', () => {
    const gate = new CanvasViewportRebaseGate();
    const rebases: number[] = [];

    expect(gate.request('constrained', () => rebases.push(1))).toBe(true);
    expect(gate.isPending()).toBe(true);
    expect(gate.request('constrained', () => rebases.push(2))).toBe(false);
    gate.complete();
    expect(gate.isPending()).toBe(false);
    expect(gate.request('constrained', () => rebases.push(3))).toBe(true);
    expect(rebases).toEqual([1, 3]);
  });

  it('releases each overscan boundary after its rebase frame completes', () => {
    const layer = document.createElement('div');
    const gate = new CanvasViewportRebaseGate();
    const rebases: number[] = [];
    let rendered = { offset: { x: 0, y: 0 }, zoom: 1 };

    [400, 800, 1200].forEach((x) => {
      const presented = { offset: { x, y: 0 }, zoom: 1 };
      const status = applyCanvasViewportPresentation(
        layer,
        rendered,
        presented,
        { width: 1000, height: 800, overscan: 128 }
      );
      expect(status).toBe('constrained');
      expect(gate.request(status, () => rebases.push(x))).toBe(true);
      expect(shouldDeferCanvasViewportRender(
        { viewport: rendered, sceneInputs: [] },
        presented,
        [],
        'viewport-interaction',
        gate.isPending()
      )).toBe(false);

      rendered = presented;
      gate.complete();
      expect(applyCanvasViewportPresentation(
        layer,
        rendered,
        presented,
        { width: 1000, height: 800, overscan: 128 }
      )).toBe('identity');
    });

    expect(rebases).toEqual([400, 800, 1200]);
  });

  it('defers pan and zoom presentation while scene inputs stay unchanged', () => {
    const scene = {};
    const rendered = {
      viewport: { offset: { x: 0, y: 0 }, zoom: 0.75 },
      sceneInputs: [scene, 3],
    };

    expect(shouldDeferCanvasViewportRender(
      rendered,
      { offset: { x: 10.25, y: -4.75 }, zoom: 0.75 },
      [scene, 3],
      'viewport-interaction'
    )).toBe(true);
    expect(resolveCanvasViewportRenderDecision(
      rendered,
      { offset: { x: 10, y: -5 }, zoom: 0.8 },
      [scene, 3],
      'viewport-interaction'
    )).toBe('defer-zoom');
    expect(shouldDeferCanvasViewportRender(
      rendered,
      { offset: { x: 10, y: -5 }, zoom: 0.8 },
      [scene, 3],
      'viewport-interaction'
    )).toBe(true);
    expect(shouldDeferCanvasViewportRender(
      rendered,
      { offset: { x: 10, y: -5 }, zoom: 0.8 },
      [scene, 4],
      'viewport-interaction'
    )).toBe(false);
    expect(shouldDeferCanvasViewportRender(
      rendered,
      { offset: { x: 10, y: -5 }, zoom: 0.75 },
      [scene, 3],
      'viewport-interaction',
      true
    )).toBe(false);
  });

  it('holds the last valid presentation until zoom-out is rebased', () => {
    expect(
      constrainCanvasViewportTransform(
        { scale: 0.7, translateX: 0, translateY: 0 },
        { width: 1000, height: 800, overscan: 128 }
      )
    ).toBeNull();

    const layer = document.createElement('div');
    layer.style.transform = 'translate3d(10px, 10px, 0)';
    expect(applyCanvasViewportPresentation(
      layer,
      { offset: { x: 0, y: 0 }, zoom: 1 },
      { offset: { x: 0, y: 0 }, zoom: 0.7 },
      { width: 1000, height: 800, overscan: 128 }
    )).toBe('out-of-coverage');

    expect(layer.style.transform).toBe('translate3d(10px, 10px, 0)');
  });

  it('requests one rebase when zoom leaves the presentation coverage', () => {
    const layer = document.createElement('div');
    const gate = new CanvasViewportRebaseGate();
    let rebases = 0;
    const status = applyCanvasViewportPresentation(
      layer,
      { offset: { x: 0, y: 0 }, zoom: 1 },
      { offset: { x: 0, y: 0 }, zoom: 0.5 },
      { width: 1000, height: 800, overscan: 128 }
    );

    expect(status).toBe('out-of-coverage');
    expect(gate.request(status, () => { rebases += 1; })).toBe(true);
    expect(gate.request(status, () => { rebases += 1; })).toBe(false);
    expect(rebases).toBe(1);
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
