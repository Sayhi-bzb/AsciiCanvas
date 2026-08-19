import { describe, expect, it } from "vitest";
import {
  isSelectionTool,
  isShapeTool,
  resolveDrawingShapeDragStartDecision,
  resolveSelectionDragStartDecision,
} from "@/widgets/canvas-editor/hooks/interaction/gestures/dragStartInteraction";

const start = { x: 4, y: 6 };

describe("canvas drag-start interaction decisions", () => {
  it("identifies selection tools per canvas mode", () => {
    expect(isSelectionTool("select", "freeform")).toBe(true);
    expect(isSelectionTool("fill", "freeform")).toBe(true);
    expect(isSelectionTool("select", "structured")).toBe(true);
    expect(isSelectionTool("fill", "structured")).toBe(false);
  });

  it("identifies shape tools per canvas mode", () => {
    expect(isShapeTool("box", "freeform")).toBe(true);
    expect(isShapeTool("circle", "freeform")).toBe(true);
    expect(isShapeTool("stepline", "freeform")).toBe(true);
    expect(isShapeTool("box", "structured")).toBe(true);
    expect(isShapeTool("splitBox", "structured")).toBe(true);
    expect(isShapeTool("arrowLine", "structured")).toBe(true);
    expect(isShapeTool("arrowLine", "freeform")).toBe(false);
    expect(isShapeTool("circle", "structured")).toBe(false);
  });

  it("starts normal selection and clears the previous freeform selection", () => {
    expect(
      resolveSelectionDragStartDecision({
        tool: "select",
        canvasMode: "freeform",
        start,
        shiftKey: false,
        anchorGrid: null,
      })
    ).toEqual({
      type: "selection",
      interactionAnchor: start,
      dragStart: start,
      preview: { start, end: start },
      clearExistingSelection: true,
      clearInteractionState: false,
      activateStaticGridCell: start,
      nextAnchor: start,
    });
  });

  it("keeps the previous anchor for shift-extend selection previews", () => {
    const anchorGrid = { x: 1, y: 2 };

    expect(
      resolveSelectionDragStartDecision({
        tool: "select",
        canvasMode: "freeform",
        start,
        shiftKey: true,
        anchorGrid,
      })
    ).toEqual({
      type: "selection",
      interactionAnchor: start,
      dragStart: anchorGrid,
      preview: { start: anchorGrid, end: start },
      clearExistingSelection: false,
      clearInteractionState: true,
      activateStaticGridCell: null,
      nextAnchor: null,
    });
  });


  it("starts brush drawing with the first scratch point", () => {
    expect(
      resolveDrawingShapeDragStartDecision({
        tool: "brush",
        canvasMode: "freeform",
        start,
        brushChar: "#",
      })
    ).toEqual({
      type: "drawing",
      state: { type: "drawing", tool: "brush", start, lastGrid: start, lastPlacedGrid: start },
      scratchPoint: { ...start, char: "#" },
    });
  });

  it("starts eraser drawing with the first erased point", () => {
    expect(
      resolveDrawingShapeDragStartDecision({
        tool: "eraser",
        canvasMode: "freeform",
        start,
        brushChar: "#",
      })
    ).toEqual({
      type: "drawing",
      state: { type: "drawing", tool: "eraser", start, lastGrid: start, lastPlacedGrid: start },
      erasePoint: start,
    });
  });

  it("ignores non-shape structured tools after structured hit handling", () => {
    expect(
      resolveDrawingShapeDragStartDecision({
        tool: "text",
        canvasMode: "structured",
        start,
        brushChar: "#",
      })
    ).toEqual({ type: "ignore" });
  });

  it("starts structured shape preview for structured shape tools", () => {
    expect(
      resolveDrawingShapeDragStartDecision({
        tool: "splitBox",
        canvasMode: "structured",
        start,
        brushChar: "#",
      })
    ).toEqual({
      type: "shape-preview",
      state: { type: "shapePreview", tool: "splitBox", start, current: start, axis: null },
    });
  });
});
