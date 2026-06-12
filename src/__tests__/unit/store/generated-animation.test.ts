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

  it("duplicates selected animation frames after the selected range", () => {
    const store = useCanvasStore.getState();
    store.createCanvasSession("animation", { size: { width: 8, height: 4 } });
    useCanvasStore
      .getState()
      .applyGeneratedAnimationFrames(
        [
          makeFrame("gen-a", "A"),
          makeFrame("gen-b", "B"),
          makeFrame("gen-c", "C"),
        ],
        "replace-animation"
      );

    const sourceFrames = useCanvasStore.getState().animationTimeline?.frames ?? [];
    const duplicatedIds = useCanvasStore
      .getState()
      .duplicateAnimationFrames([sourceFrames[0].id, sourceFrames[2].id]);
    const timeline = useCanvasStore.getState().animationTimeline;

    expect(duplicatedIds).toHaveLength(2);
    expect(timeline?.frames.map((frame) => frame.grid[0][1].char)).toEqual([
      "A",
      "B",
      "C",
      "A",
      "C",
    ]);
    expect(timeline?.currentFrameId).toBe(duplicatedIds[0]);
  });

  it("removes selected animation frames and keeps a valid current frame", () => {
    const store = useCanvasStore.getState();
    store.createCanvasSession("animation", { size: { width: 8, height: 4 } });
    useCanvasStore
      .getState()
      .applyGeneratedAnimationFrames(
        [
          makeFrame("gen-a", "A"),
          makeFrame("gen-b", "B"),
          makeFrame("gen-c", "C"),
        ],
        "replace-animation"
      );

    const sourceFrames = useCanvasStore.getState().animationTimeline?.frames ?? [];
    const fallbackIds = useCanvasStore
      .getState()
      .removeAnimationFrames([sourceFrames[0].id, sourceFrames[1].id]);
    const timeline = useCanvasStore.getState().animationTimeline;

    expect(fallbackIds).toEqual([sourceFrames[2].id]);
    expect(timeline?.frames.map((frame) => frame.grid[0][1].char)).toEqual(["C"]);
    expect(timeline?.currentFrameId).toBe(sourceFrames[2].id);
  });

  it("keeps one empty frame when removing all selected animation frames", () => {
    const store = useCanvasStore.getState();
    store.createCanvasSession("animation", { size: { width: 8, height: 4 } });
    useCanvasStore
      .getState()
      .applyGeneratedAnimationFrames(
        [makeFrame("gen-a", "A"), makeFrame("gen-b", "B")],
        "replace-animation"
      );

    const sourceFrames = useCanvasStore.getState().animationTimeline?.frames ?? [];
    const fallbackIds = useCanvasStore
      .getState()
      .removeAnimationFrames(sourceFrames.map((frame) => frame.id));
    const timeline = useCanvasStore.getState().animationTimeline;

    expect(fallbackIds).toHaveLength(1);
    expect(timeline?.frames).toHaveLength(1);
    expect(timeline?.frames[0].grid).toEqual([]);
    expect(timeline?.currentFrameId).toBe(fallbackIds[0]);
  });
});
