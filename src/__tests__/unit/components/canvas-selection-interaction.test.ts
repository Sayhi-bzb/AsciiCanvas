import { describe, expect, it } from "vitest";
import { resolveSelectionCommitDecision } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/preview/selectionInteraction";
import type { StructuredBoxNode } from "@/shared/types";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 1, y: 1 },
  end: { x: 5, y: 3 },
  style: { color: "#ffffff" },
};

describe("selection interaction commit decisions", () => {
  it("returns none without a selection", () => {
    expect(
      resolveSelectionCommitDecision({
        selection: null,
        tool: "select",
        canvasMode: "freeform",
        structuredScene: [],
      })
    ).toEqual({ type: "none" });
  });

  it("commits fill selections before mode-specific selection behavior", () => {
    const selection = { start: { x: 0, y: 0 }, end: { x: 2, y: 2 } };

    expect(
      resolveSelectionCommitDecision({
        selection,
        tool: "fill",
        canvasMode: "structured",
        structuredScene: [boxNode],
      })
    ).toEqual({ type: "fill", selection });
  });

  it("turns single-cell freeform selections into a text cursor", () => {
    const selection = { start: { x: 4, y: 7 }, end: { x: 4, y: 7 } };

    expect(
      resolveSelectionCommitDecision({
        selection,
        tool: "select",
        canvasMode: "freeform",
        structuredScene: [],
      })
    ).toEqual({ type: "setTextCursor", point: selection.start });
  });

  it("keeps multi-cell freeform selections as selection areas", () => {
    const selection = { start: { x: 4, y: 7 }, end: { x: 6, y: 9 } };

    expect(
      resolveSelectionCommitDecision({
        selection,
        tool: "select",
        canvasMode: "freeform",
        structuredScene: [],
      })
    ).toEqual({ type: "addSelection", selection });
  });

  it("selects structured nodes intersecting the selection", () => {
    expect(
      resolveSelectionCommitDecision({
        selection: { start: { x: 0, y: 0 }, end: { x: 6, y: 4 } },
        tool: "select",
        canvasMode: "structured",
        structuredScene: [boxNode],
      })
    ).toEqual({ type: "setStructuredSelection", ids: [boxNode.id] });
  });

  it("focuses the structured grid when no node intersects", () => {
    const selection = { start: { x: 9, y: 9 }, end: { x: 10, y: 10 } };

    expect(
      resolveSelectionCommitDecision({
        selection,
        tool: "select",
        canvasMode: "structured",
        structuredScene: [boxNode],
      })
    ).toEqual({ type: "setStructuredGridFocus", point: selection.start });
  });
});
