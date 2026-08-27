import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasRenderActivity } from "./CanvasRenderActivity";

afterEach(() => vi.useRealTimers());

describe("CanvasRenderActivity", () => {
  it("settles viewport and content activity independently", () => {
    vi.useFakeTimers();
    const activity = new CanvasRenderActivity();
    const modes: string[] = [];
    activity.subscribe((mode) => modes.push(mode));

    activity.markContentActivity();
    expect(activity.getMode()).toBe("content-interaction");
    activity.markViewportActivity();
    expect(activity.getMode()).toBe("viewport-interaction");

    vi.advanceTimersByTime(80);
    expect(activity.getMode()).toBe("viewport-interaction");
    vi.advanceTimersByTime(40);
    expect(activity.getMode()).toBe("settled");
    expect(modes).toEqual([
      "content-interaction",
      "viewport-interaction",
      "settled",
    ]);
  });

  it("extends the settle deadline after repeated activity", () => {
    vi.useFakeTimers();
    const activity = new CanvasRenderActivity();
    activity.markViewportActivity();
    vi.advanceTimersByTime(100);
    activity.markViewportActivity();
    vi.advanceTimersByTime(100);
    expect(activity.getMode()).toBe("viewport-interaction");
    vi.advanceTimersByTime(20);
    expect(activity.getMode()).toBe("settled");
  });
});
