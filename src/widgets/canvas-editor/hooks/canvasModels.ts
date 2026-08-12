import { canvasCommands, canvasQueries } from "@/domains/canvas/public";
import type { CanvasState } from "@/domains/canvas/public";

export type CanvasRenderModel = Pick<CanvasState,
  | "offset"
  | "zoom"
  | "grid"
  | "scratchLayer"
  | "textCursor"
  | "selections"
  | "staticGridSelection"
  | "staticGridEditMode"
  | "showGrid"
  | "hoveredGrid"
  | "tool"
  | "canvasMode"
  | "slideDeck"
  | "structuredScene"
  | "selectedStructuredNodeIds"
  | "selectedStructuredBoxId"
  | "structuredContextPoint"
  | "structuredGridFocus"
  | "editingStructuredTextNodeId"
  | "structuredTextSelection"
  | "canvasColorPickerTarget"
>;

export type CanvasEditorModel = Pick<CanvasState,
  | "textCursor"
  | "staticGridSelection"
  | "staticGridEditMode"
  | "selections"
  | "offset"
  | "zoom"
  | "structuredGridFocus"
  | "selectedStructuredNodeIds"
  | "structuredScene"
  | "structuredComponents"
  | "brushColor"
  | "canvasColorPickerTarget"
  | "activeCanvasHasSavedViewport"
> & {
  writeTextString: typeof canvasCommands.text.write;
  backspaceText: typeof canvasCommands.text.backspace;
  deleteTextForward: typeof canvasCommands.text.deleteForward;
  newlineText: typeof canvasCommands.text.newline;
  indentText: typeof canvasCommands.text.indent;
  moveTextCursor: typeof canvasCommands.text.moveCursor;
  moveStaticGridFocus: typeof canvasCommands.staticGrid.moveFocus;
  moveStructuredGridFocus: typeof canvasCommands.interaction.moveStructuredGridFocus;
  setTextCursor: typeof canvasCommands.interaction.setTextCursor;
  setOffset: typeof canvasCommands.viewport.setOffset;
  moveSelections: typeof canvasCommands.selection.move;
  expandSelection: typeof canvasCommands.selection.expand;
  fillSelectionsWithChar: typeof canvasCommands.selection.fillWithChar;
  clearSelections: typeof canvasCommands.selection.clear;
  setStructuredGridFocus: typeof canvasCommands.interaction.setStructuredGridFocus;
  setSelectedStructuredNodeIds: typeof canvasCommands.interaction.setSelectedStructuredNodeIds;
  setSelectedStructuredSplitHandle: typeof canvasCommands.interaction.setSelectedStructuredSplitHandle;
  setEditingStructuredTextNodeId: typeof canvasCommands.interaction.setEditingStructuredTextNodeId;
  setStructuredTextSelection: typeof canvasCommands.interaction.setStructuredTextSelection;
  setCanvasColorPickerTarget: typeof canvasCommands.interaction.setColorPickerTarget;
  setHoveredGrid: typeof canvasCommands.interaction.setHoveredGrid;
  getNextStructuredOrder: typeof canvasQueries.getNextStructuredOrder;
  applyStructuredScene: typeof canvasCommands.structured.applyScene;
  setStructuredContextPoint: typeof canvasCommands.interaction.setStructuredContextPoint;
};
