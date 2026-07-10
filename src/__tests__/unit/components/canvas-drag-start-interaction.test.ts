import { describe, expect, it } from "vitest";
import {
  isSelectionTool,
  isShapeTool,
  resolveDrawingShapeDragStartDecision,
  resolveDragStartRouteDecision,
  resolveSelectionDragStartDecision,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/dragStartInteraction";

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
    expect(isShapeTool("circle", "structured")).toBe(false);
  });

  it("routes drag starts before grid-specific handling", () => {
    expect(
      resolveDragStartRouteDecision({
        canvasMode: "freeform",
        tool: "select",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: true,
        hasCanvasRect: true,
      })
    ).toEqual({ type: "color-picker" });

    expect(
      resolveDragStartRouteDecision({
        canvasMode: "freeform",
        tool: "pan",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: true,
      })
    ).toEqual({ type: "pan" });

    expect(
      resolveDragStartRouteDecision({
        canvasMode: "animation",
        tool: "pan",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: true,
      })
    ).toEqual({ type: "primary-canvas" });

    expect(
      resolveDragStartRouteDecision({
        canvasMode: "freeform",
        tool: "select",
        button: 1,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: true,
      })
    ).toEqual({ type: "pan" });

    expect(
      resolveDragStartRouteDecision({
        canvasMode: "freeform",
        tool: "select",
        button: 0,
        isCtrlOrMetaPressed: false,
        hasColorPickerTarget: false,
        hasCanvasRect: false,
      })
    ).toEqual({ type: "ignore" });
  });
  it("starts normal selection and clears the previous freeform selection", () => {
    expect(
      resolveSelectionDragStartDecision({
        tool: "select",
        canvasMode: "freeform",
        start,
        shiftKey: false,
        anchorGrid: null,
        canvasBounds: null,
      })
    ).toEqual({
      type: "selection",
      interactionAnchor: start,
      dragStart: start,
      preview: { start, end: start },
      clearExistingSelection: true,
      clearInteractionState: false,
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
        canvasBounds: null,
      })
    ).toEqual({
      type: "selection",
      interactionAnchor: start,
      dragStart: anchorGrid,
      preview: { start: anchorGrid, end: start },
      clearExistingSelection: false,
      clearInteractionState: true,
      nextAnchor: null,
    });
  });

  it("clamps animation selection previews to canvas bounds", () => {
    expect(
      resolveSelectionDragStartDecision({
        tool: "select",
        canvasMode: "animation",
        start: { x: 9, y: 4 },
        shiftKey: false,
        anchorGrid: null,
        canvasBounds: { width: 5, height: 3 },
      })
    ).toMatchObject({
      preview: { start: { x: 4, y: 2 }, end: { x: 4, y: 2 } },
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
      event: { type: "startDrawing", tool: "brush", start },
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
      event: { type: "startDrawing", tool: "eraser", start },
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
      event: { type: "startShapePreview", tool: "splitBox", start },
    });
  });
});
