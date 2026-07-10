import { describe, expect, it } from "vitest";
import { resolveDragEndCommitDecision } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/commit/commitInteraction";

describe("drag-end commit interaction decisions", () => {
  it("commits brush scratches and saves eraser history", () => {
    expect(
      resolveDragEndCommitDecision({
        mode: "drawing",
        tool: "brush",
        canvasMode: "freeform",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "commitScratch" });

    expect(
      resolveDragEndCommitDecision({
        mode: "drawing",
        tool: "eraser",
        canvasMode: "freeform",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "forceHistorySave" });
  });

  it("commits freeform shape previews through scratch", () => {
    expect(
      resolveDragEndCommitDecision({
        mode: "shape-preview",
        tool: "box",
        canvasMode: "freeform",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "commitScratch" });
  });

  it("commits structured shape previews through structured shape creation", () => {
    expect(
      resolveDragEndCommitDecision({
        mode: "shape-preview",
        tool: "splitBox",
        canvasMode: "structured",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "commitStructuredShape" });
  });

  it("does nothing for shape previews without a drag start", () => {
    expect(
      resolveDragEndCommitDecision({
        mode: "shape-preview",
        tool: "box",
        canvasMode: "freeform",
        hasDragStart: false,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "none" });
  });

  it("flushes structured move and splitBox divider queues", () => {
    expect(
      resolveDragEndCommitDecision({
        mode: "structured-node-moving",
        tool: "select",
        canvasMode: "structured",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "flushStructuredMove" });

    expect(
      resolveDragEndCommitDecision({
        mode: "structured-splitbox-resizing",
        tool: "select",
        canvasMode: "structured",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: true,
      })
    ).toEqual({ type: "flushStructuredSplitBoxResize" });
  });

  it("saves history for direct structured resize writes", () => {
    expect(
      resolveDragEndCommitDecision({
        mode: "structured-box-resizing",
        tool: "select",
        canvasMode: "structured",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "forceHistorySave" });

    expect(
      resolveDragEndCommitDecision({
        mode: "structured-splitbox-resizing",
        tool: "select",
        canvasMode: "structured",
        hasDragStart: true,
        isStructuredSplitBoxDividerResize: false,
      })
    ).toEqual({ type: "forceHistorySave" });
  });
});
