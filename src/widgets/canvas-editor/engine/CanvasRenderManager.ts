import {
  CANVAS_FRAME_ALL,
  CANVAS_FRAME_INVALIDATION,
  type CanvasFrameInvalidation,
} from "./FrameScheduler";

export type CanvasRenderLayer = "background" | "scratch" | "overlay";

const LAYER_BITS: Record<CanvasRenderLayer, CanvasFrameInvalidation> = {
  background: CANVAS_FRAME_INVALIDATION.background,
  scratch: CANVAS_FRAME_INVALIDATION.scratch,
  overlay: CANVAS_FRAME_INVALIDATION.overlay,
};

const inputsChanged = (
  previous: readonly unknown[] | undefined,
  next: readonly unknown[]
): boolean =>
  !previous ||
  previous.length !== next.length ||
  next.some((input, index) => input !== previous[index]);

/** Tracks layer dependencies and converts changed inputs to render invalidation. */
export class CanvasRenderManager {
  private readonly inputs = new Map<CanvasRenderLayer, readonly unknown[]>();

  update(next: Record<CanvasRenderLayer, readonly unknown[]>): CanvasFrameInvalidation {
    let invalidation = 0;
    (Object.keys(next) as CanvasRenderLayer[]).forEach((layer) => {
      const inputs = next[layer];
      if (!inputsChanged(this.inputs.get(layer), inputs)) return;
      this.inputs.set(layer, inputs);
      invalidation |= LAYER_BITS[layer];
    });
    return invalidation;
  }

  reset(): CanvasFrameInvalidation {
    this.inputs.clear();
    return CANVAS_FRAME_ALL;
  }

  static includes(
    invalidation: CanvasFrameInvalidation,
    layer: CanvasRenderLayer
  ): boolean {
    return (invalidation & LAYER_BITS[layer]) !== 0;
  }
}
