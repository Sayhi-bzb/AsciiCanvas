import { afterEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";
import type { AnimationFrame } from "@/shared/types";

const makeFrame = (id: string, char: string): AnimationFrame => ({
  id,
  name: id,
  grid: [["0,0", { char, color: "#ffffff" }]],
});

describe("generated animation frames", () => {
  const initialState = useCanvasStore.getState();

  afterEach(() => {
    useCanvasStore.setState(initialState, true);
    applyFreeformSnapshotToYMaps([]);
  });

  it("inserts generated frames after the current frame", () => {
    const store = useCanvasStore.getState();
    store.createCanvasSession("animation", { size: { width: 8, height: 4 } });
    useCanvasStore
      .getState()
      .applyGeneratedAnimationFrames(
        [makeFrame("gen-a", "A"), makeFrame("gen-b", "B")],
        "insert-after-current",
        { fps: 12 }
      );

    const timeline = useCanvasStore.getState().animationTimeline;
    expect(timeline?.frames).toHaveLength(3);
    expect(timeline?.frames[1].grid[0][1].char).toBe("A");
    expect(timeline?.frames[2].grid[0][1].char).toBe("B");
    expect(timeline?.fps).toBe(12);
  });

  it("replaces the current animation with generated frames", () => {
    const store = useCanvasStore.getState();
    store.createCanvasSession("animation", { size: { width: 8, height: 4 } });
    useCanvasStore
      .getState()
      .applyGeneratedAnimationFrames(
        [makeFrame("gen-a", "A"), makeFrame("gen-b", "B")],
        "replace-animation"
      );

    const timeline = useCanvasStore.getState().animationTimeline;
    expect(timeline?.frames).toHaveLength(2);
    expect(timeline?.frames.map((frame) => frame.grid[0][1].char)).toEqual([
      "A",
      "B",
    ]);
    expect(useCanvasStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
    });
  });
});
