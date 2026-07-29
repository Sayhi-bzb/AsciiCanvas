import { describe, expect, it, vi } from "vitest";
import { createMinimapCameraAnimator } from "./cameraAnimation";

describe("minimap camera animator", () => {
  it("eases to the target and finishes at the exact offset", () => {
    let offset = { x: 0, y: 0 };
    let now = 0;
    const callbacks: FrameRequestCallback[] = [];
    const animator = createMinimapCameraAnimator({
      setOffset: (updater) => {
        offset = updater(offset);
      },
      scheduler: {
        now: () => now,
        requestAnimationFrame: (callback) => {
          callbacks.push(callback);
          return callbacks.length;
        },
        cancelAnimationFrame: vi.fn(),
      },
    });

    animator.animateTo({ x: 180, y: -90 }, 180);
    now = 90;
    callbacks.shift()?.(now);
    expect(offset.x).toBeGreaterThan(90);
    expect(offset.y).toBeLessThan(-45);

    now = 180;
    callbacks.shift()?.(now);
    expect(offset).toEqual({ x: 180, y: -90 });
  });

  it("cancels an active animation before an immediate jump", () => {
    let offset = { x: 0, y: 0 };
    const cancelAnimationFrame = vi.fn();
    const animator = createMinimapCameraAnimator({
      setOffset: (updater) => {
        offset = updater(offset);
      },
      scheduler: {
        now: () => 0,
        requestAnimationFrame: () => 7,
        cancelAnimationFrame,
      },
    });

    animator.animateTo({ x: 10, y: 20 }, 180);
    animator.jumpTo({ x: 3, y: 4 });

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(offset).toEqual({ x: 3, y: 4 });
  });
});
