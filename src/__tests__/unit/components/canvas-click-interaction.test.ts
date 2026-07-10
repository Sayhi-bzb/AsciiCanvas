import { describe, expect, it } from "vitest";
import { resolveCanvasClickDecision } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/clickInteraction";
import type { CanvasLinkHit } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/core/linkHitTesting";

const linkHit: CanvasLinkHit = {
  y: 2,
  startX: 1,
  endX: 4,
  href: "https://example.com",
};

describe("canvas click interaction decisions", () => {
  it("consumes pending color-picker clicks before other click routes", () => {
    expect(
      resolveCanvasClickDecision({
        colorPickerClickPending: true,
        interactionMode: "idle",
        canvasMode: "structured",
        tool: "text",
        point: { x: 1, y: 2 },
        linkHit,
        shouldOpenLink: true,
      })
    ).toEqual({ type: "consume-color-picker-click" });
  });

  it("ignores clicks while an interaction is active", () => {
    expect(
      resolveCanvasClickDecision({
        colorPickerClickPending: false,
        interactionMode: "drawing",
        canvasMode: "freeform",
        tool: "brush",
        point: { x: 1, y: 2 },
        linkHit,
        shouldOpenLink: true,
      })
    ).toEqual({ type: "none" });
  });

  it("routes structured text tool clicks to caret placement", () => {
    expect(
      resolveCanvasClickDecision({
        colorPickerClickPending: false,
        interactionMode: "idle",
        canvasMode: "structured",
        tool: "text",
        point: { x: 3, y: 4 },
        linkHit,
        shouldOpenLink: true,
      })
    ).toEqual({ type: "structured-text-caret", point: { x: 3, y: 4 } });
  });

  it("does not route structured text clicks without a grid point", () => {
    expect(
      resolveCanvasClickDecision({
        colorPickerClickPending: false,
        interactionMode: "idle",
        canvasMode: "structured",
        tool: "text",
        point: null,
        linkHit,
        shouldOpenLink: true,
      })
    ).toEqual({ type: "none" });
  });

  it("routes eligible link clicks after structured text clicks", () => {
    expect(
      resolveCanvasClickDecision({
        colorPickerClickPending: false,
        interactionMode: "idle",
        canvasMode: "freeform",
        tool: "select",
        point: { x: 1, y: 2 },
        linkHit,
        shouldOpenLink: true,
      })
    ).toEqual({ type: "open-link", hit: linkHit });
  });

  it("ignores link hits without the open modifier", () => {
    expect(
      resolveCanvasClickDecision({
        colorPickerClickPending: false,
        interactionMode: "idle",
        canvasMode: "freeform",
        tool: "select",
        point: { x: 1, y: 2 },
        linkHit,
        shouldOpenLink: false,
      })
    ).toEqual({ type: "none" });
  });
});

