import { describe, expect, it } from "vitest";
import type { AnimationTimeline } from "@/shared/types";
import {
  cloneAnimationFrame,
  clampPointToBounds,
  clampSelectionToBounds,
  createDuplicateAnimationFrameName,
  DEFAULT_ANIMATION_SIZE,
  MAX_ANIMATION_FPS,
  getCenteredAnimationOffset,
  getAnimationFrameDelayMs,
  normalizeAnimationCanvasSize,
  normalizeAnimationTimeline,
  updateAnimationFrameEntries,
} from "@/domains/animation/public";

describe("animationHelpers", () => {
  it("normalizes invalid canvas size inputs", () => {
    expect(normalizeAnimationCanvasSize(undefined)).toEqual(DEFAULT_ANIMATION_SIZE);
    expect(normalizeAnimationCanvasSize({ width: -1, height: 9999 })).toEqual({
      width: 1,
      height: 512,
    });
  });

  it("creates a usable default timeline", () => {
    const timeline = normalizeAnimationTimeline(undefined);
    expect(timeline.frames).toHaveLength(1);
    expect(timeline.currentFrameId).toBe(timeline.frames[0].id);
    expect(timeline.frames[0].name).toBe("Frame 1");
    expect(timeline.fps).toBe(10);
  });

  it("clamps timeline fps to the supported maximum", () => {
    const timeline = normalizeAnimationTimeline({
      fps: MAX_ANIMATION_FPS + 100,
      frames: [{ id: "f1", name: "Frame 1", grid: [] }],
      currentFrameId: "f1",
    });

    expect(timeline.fps).toBe(MAX_ANIMATION_FPS);
  });

  it("converts fps to playback delay with the supported maximum", () => {
    expect(getAnimationFrameDelayMs(1)).toBe(1000);
    expect(getAnimationFrameDelayMs(10)).toBe(100);
    expect(getAnimationFrameDelayMs(60)).toBeCloseTo(1000 / 60);
    expect(getAnimationFrameDelayMs(120)).toBeCloseTo(1000 / 60);
  });

  it("hydrates stable frame names for legacy timelines", () => {
    const timeline = normalizeAnimationTimeline(
      {
        frames: [
          { id: "f1", grid: [] },
          { id: "f2", name: "Idle", grid: [] },
        ],
        currentFrameId: "f1",
      } as Partial<AnimationTimeline>
    );

    expect(timeline.frames.map((frame) => frame.name)).toEqual([
      "Frame 1",
      "Idle",
    ]);
  });

  it("updates the targeted frame grid without mutating other timeline fields", () => {
    const timeline = normalizeAnimationTimeline({
      frames: [{ id: "f1", name: "Frame 1", grid: [] }],
      currentFrameId: "f1",
      fps: 8,
      loop: true,
    });
    const next = updateAnimationFrameEntries(timeline, "f1", [
      ["0,0", { char: "#", color: "#000" }],
    ]);

    expect(next.frames[0].grid).toEqual([
      ["0,0", { char: "#", color: "#000" }],
    ]);
    expect(next.fps).toBe(8);
    expect(timeline.frames[0].grid).toEqual([]);
  });

  it("preserves frame names when cloning frames", () => {
    expect(
      cloneAnimationFrame({
        id: "f1",
        name: "Idle",
        grid: [["0,0", { char: "#", color: "#000" }]],
      })
    ).toEqual({
      id: "f1",
      name: "Idle",
      grid: [["0,0", { char: "#", color: "#000" }]],
    });
  });

  it("creates duplicate frame names with numbered suffixes", () => {
    const frames = [
      { id: "f1", name: "2" },
      { id: "f2", name: "2 (1)" },
    ];

    expect(createDuplicateAnimationFrameName([{ id: "f1", name: "2" }], "2")).toBe(
      "2 (1)"
    );
    expect(createDuplicateAnimationFrameName(frames, "2")).toBe("2 (2)");
    expect(createDuplicateAnimationFrameName(frames, "2 (1)")).toBe("2 (2)");
    expect(createDuplicateAnimationFrameName(frames, "2 Copy Copy (1)")).toBe(
      "2 (2)"
    );
  });

  it("clamps points and selections to the fixed animation bounds", () => {
    const bounds = { width: 8, height: 6 };
    expect(clampPointToBounds({ x: -2, y: 12 }, bounds)).toEqual({
      x: 0,
      y: 5,
    });
    expect(
      clampSelectionToBounds(
        {
          start: { x: -1, y: 2 },
          end: { x: 12, y: 8 },
        },
        bounds
      )
    ).toEqual({
      start: { x: 0, y: 2 },
      end: { x: 7, y: 5 },
    });
  });

  it("centers the fixed animation canvas inside the viewport", () => {
    expect(
      getCenteredAnimationOffset(
        { width: 80, height: 25 },
        { width: 1600, height: 900 },
        1
      )
    ).toEqual({
      x: 440,
      y: 212.5,
    });
  });
});
