import { describe, expect, it } from "vitest";
import { createDocumentInteractionResetPatch } from "./editorTransitions";

describe("editor transitions", () => {
  it("creates a complete document interaction reset", () => {
    expect(createDocumentInteractionResetPatch()).toEqual({
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      structuredGridFocus: null,
      staticGridSelection: {
        activeCell: { x: 0, y: 0 },
        anchorCell: { x: 0, y: 0 },
        primaryRange: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        additionalRanges: [],
      },
      staticGridEditMode: "navigate",
      hoveredGrid: null,
      scratchLayer: null,
      canvasColorPickerTarget: null,
    });
  });

  it("does not share mutable reset values between transitions", () => {
    const first = createDocumentInteractionResetPatch();
    const second = createDocumentInteractionResetPatch();

    expect(first.selections).not.toBe(second.selections);
    expect(first.selectedStructuredNodeIds).not.toBe(
      second.selectedStructuredNodeIds
    );
    expect(first.staticGridSelection).not.toBe(second.staticGridSelection);
    expect(first.staticGridSelection.activeCell).not.toBe(
      second.staticGridSelection.activeCell
    );
    expect(first.staticGridSelection.primaryRange).not.toBe(
      second.staticGridSelection.primaryRange
    );
    expect(first.staticGridSelection.additionalRanges).not.toBe(
      second.staticGridSelection.additionalRanges
    );
  });
});
