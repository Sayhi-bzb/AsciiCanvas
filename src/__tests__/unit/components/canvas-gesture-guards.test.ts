import { describe, expect, it } from "vitest";
import { shouldIgnoreMinimapGesture } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/core/gestureGuards";

const eventFrom = (target: Element) =>
  ({ target, composedPath: () => [target] }) as unknown as Event;

describe("canvas gesture guards", () => {
  it("ignores idle gestures that originate from the minimap", () => {
    const minimap = document.createElement("div");
    minimap.dataset.minimapRoot = "true";

    expect(
      shouldIgnoreMinimapGesture({
        event: eventFrom(minimap),
        interactionMode: "idle",
        hasDragStartGrid: false,
        isPanning: false,
      })
    ).toBe(true);
  });

  it("does not ignore minimap events during active gestures", () => {
    const minimap = document.createElement("div");
    minimap.dataset.minimapRoot = "true";

    expect(
      shouldIgnoreMinimapGesture({
        event: eventFrom(minimap),
        interactionMode: "drawing",
        hasDragStartGrid: false,
        isPanning: false,
      })
    ).toBe(false);
    expect(
      shouldIgnoreMinimapGesture({
        event: eventFrom(minimap),
        interactionMode: "idle",
        hasDragStartGrid: true,
        isPanning: false,
      })
    ).toBe(false);
    expect(
      shouldIgnoreMinimapGesture({
        event: eventFrom(minimap),
        interactionMode: "idle",
        hasDragStartGrid: false,
        isPanning: true,
      })
    ).toBe(false);
  });

  it("does not ignore non-minimap events", () => {
    expect(
      shouldIgnoreMinimapGesture({
        event: eventFrom(document.createElement("div")),
        interactionMode: "idle",
        hasDragStartGrid: false,
        isPanning: false,
      })
    ).toBe(false);
  });
});
