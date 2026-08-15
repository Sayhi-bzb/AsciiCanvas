import type { StateCreator } from "zustand";
import type { EditorState, TextSlice } from "../interfaces";
import type { CanvasDocumentRegistry } from "../CanvasDocumentRegistry";
import { GridManager } from "@/shared/utils/grid";
import { collapseGridSelectionTo, getStaticGridViewState } from "@/domains/selection/public";
import { placeCharInYMap, placeStyledCellInYMap } from "../utils";
import {
  deleteCellAt,
  resolveBackspaceAnchor,
} from "../gridOps";
import type { NodeBounds } from "@/shared/types";
import type { StructuredBoxNode, StructuredTextNode } from "@/domains/structured-content/public";
import {
  createStructuredNodeId,
  getTextColumnWidth,
  trimTextToColumns,
  withPointWithinBounds,
  getStructuredNodeBounds,
} from "@/domains/structured-content/public";
import {
  getCellOccupancy,
  isWideCell,
  splitGraphemes,
} from "@/shared/metrics";
import {
  getStructuredTextCaretPoint,
  getStructuredTextOffsetAtPoint,
  getStructuredTextSelectionRange,
  normalizeStructuredTextSelection,
  replaceStructuredTextRange as replaceStructuredTextNodeRange,
} from "@/domains/structured-content/public";
import { clampPointToActiveSlide, isPointWithinActiveSlide } from "../slideBounds";

const toCharIndexByColumn = (text: string, columnOffset: number) => {
  if (columnOffset <= 0) return 0;
  let width = 0;
  const chars = splitGraphemes(text);
  for (let i = 0; i < chars.length; i++) {
    const charWidth = getCellOccupancy(chars[i]);
    if (width + charWidth > columnOffset) return i;
    width += charWidth;
  }
  return chars.length;
};

const findTextNodeAtCursor = (
  scene: EditorState["structuredScene"],
  cursor: EditorState["textCursor"],
  preferredNodeId?: string | null
) => {
  if (!cursor) return null;
  const candidates = scene.filter((node): node is StructuredTextNode => {
    if (node.type !== "text") return false;
    const bounds = getStructuredNodeBounds(node);
    return withPointWithinBounds(cursor, bounds, true);
  });
  if (candidates.length === 0) return null;
  const preferredNode = candidates.find((node) => node.id === preferredNodeId);
  if (preferredNode) return preferredNode;
  return [...candidates].sort((a, b) => b.order - a.order)[0];
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const getBoxNameTextCapacity = (bounds: NodeBounds) =>
  Math.max(0, bounds.width - 5);

const getBoxNameTextStartX = (bounds: NodeBounds) =>
  bounds.x + 3;

const getNewlineTargetX = (
  grid: EditorState["grid"],
  currentX: number,
  currentY: number
) => {
  const hasCell = (x: number) => grid.has(GridManager.toKey(x, currentY));
  let seedX: number | null = null;
  for (const key of grid.keys()) {
    const point = GridManager.fromKey(key);
    if (point.y !== currentY || point.x > currentX) continue;
    seedX = seedX === null ? point.x : Math.max(seedX, point.x);
  }
  if (seedX === null) return currentX;

  let runStartX = seedX;
  while (hasCell(runStartX - 1)) runStartX -= 1;
  return Math.min(currentX, runStartX);
};

const isWideFollowerRichCell = (
  cell: { x: number; y: number; char: string },
  cellsBySourcePoint: Map<string, { char: string }>
) => {
  if (cell.char !== " ") return false;
  const leftCell = cellsBySourcePoint.get(GridManager.toKey(cell.x - 1, cell.y));
  return !!leftCell && isWideCell(leftCell.char);
};

const findBoxNameTargetAtCursor = (
  scene: EditorState["structuredScene"],
  cursor: EditorState["textCursor"]
) => {
  if (!cursor) return null;
  const candidates = scene
    .filter((node): node is StructuredBoxNode => node.type === "box")
    .map((node) => ({ node, bounds: getStructuredNodeBounds(node) }))
    .filter(({ bounds }) => {
      const left = getBoxNameTextStartX(bounds);
      const right = left + getBoxNameTextCapacity(bounds) - 1;
      if (left > right) return false;
      return cursor.y === bounds.y && cursor.x >= left && cursor.x <= right;
    });

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    if (a.node.order !== b.node.order) return b.node.order - a.node.order;
    return a.bounds.width - b.bounds.width;
  })[0];
};

export const createTextSlice = (
  documents: CanvasDocumentRegistry
): StateCreator<EditorState, [], [], TextSlice> => (set, get) => ({
  textCursor: null,
  editingStructuredTextNodeId: null,
  structuredTextSelection: null,
  setTextCursor: (pos) =>
    set((state) => {
      const nextPos = pos ? clampPointToActiveSlide(state, pos) : null;
      return {
        textCursor: nextPos,
        selections: [],
        ...(state.canvasMode === "structured" && nextPos ? { structuredGridFocus: null } : {}),
        ...(nextPos ? {} : { editingStructuredTextNodeId: null, structuredTextSelection: null }),
        ...(nextPos
          ? {
              staticGridSelection: collapseGridSelectionTo(state.staticGridSelection, nextPos),
              staticGridEditMode: "text-edit" as const,
            }
          : {}),
      };
    }),
  setEditingStructuredTextNodeId: (id) =>
    set((state) => {
      if (!id) return { editingStructuredTextNodeId: null, structuredTextSelection: null };
      const node = state.structuredScene.find(
        (sceneNode) => sceneNode.id === id && sceneNode.type === "text"
      );
      return {
        editingStructuredTextNodeId: node ? id : null,
        structuredTextSelection: node ? state.structuredTextSelection : null,
      };
    }),
  setStructuredTextSelection: (selection) =>
    set((state) => {
      if (!selection) return { structuredTextSelection: null };
      const node = state.structuredScene.find(
        (sceneNode) => sceneNode.id === selection.nodeId && sceneNode.type === "text"
      );
      if (!node || node.type !== "text") return { structuredTextSelection: null };
      return {
        structuredTextSelection: normalizeStructuredTextSelection(
          selection,
          splitGraphemes(node.text).length
        ),
      };
    }),
  replaceStructuredTextRange: (nodeId, start, end, text, styleRanges) => {
    const state = get();
    if (state.canvasMode !== "structured") return;
    const targetNode = state.structuredScene.find(
      (node): node is StructuredTextNode =>
        node.id === nodeId && node.type === "text"
    );
    if (!targetNode) return;
    const replacementTextNode = replaceStructuredTextNodeRange(
      targetNode,
      start,
      end,
      text,
      styleRanges
    );
    const nextScene = state.structuredScene.map((node) => {
      if (node.id !== nodeId || node.type !== "text") return node;
      return replacementTextNode;
    });
    state.applyStructuredScene(nextScene, true);
    const cursorOffset = Math.max(
      0,
      Math.min(
        splitGraphemes(replacementTextNode.text).length,
        start + splitGraphemes(text).length
      )
    );
    set({
      textCursor: getStructuredTextCaretPoint(replacementTextNode, cursorOffset),
      editingStructuredTextNodeId: nodeId,
      structuredTextSelection: null,
      selectedStructuredNodeIds: [nodeId],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      structuredGridFocus: null,
    });
  },

  writeTextString: (str, startPos, options) => {
    const {
      selections,
      staticGridSelection,
      staticGridEditMode,
      fillSelectionsWithChar,
      textCursor,
      brushColor,
      canvasMode,
      structuredScene,
      applyStructuredScene,
      getNextStructuredOrder,
      editingStructuredTextNodeId,
      structuredGridFocus,
    } = get();

    if (canvasMode === "structured") {
      const normalized = str.replace(/\r\n?/g, "\n");
      if (!normalized) return;
      const selectedRange = getStructuredTextSelectionRange(
        get().structuredTextSelection
      );
      const selectedNodeId = get().structuredTextSelection?.nodeId;
      if (selectedRange && selectedNodeId) {
        get().replaceStructuredTextRange(
          selectedNodeId,
          selectedRange.start,
          selectedRange.end,
          normalized
        );
        return;
      }
      const cursor = startPos || textCursor || structuredGridFocus;
      if (!cursor) return;

      const boxNameTarget = findBoxNameTargetAtCursor(structuredScene, cursor);
      if (boxNameTarget) {
        const inlineText = normalized.replace(/\n+/g, "");
        if (!inlineText) return;
        const { node, bounds } = boxNameTarget;
        const labelCapacity = getBoxNameTextCapacity(bounds);
        if (labelCapacity <= 0) return;
        const currentName = node.name || "";
        const labelStartX = getBoxNameTextStartX(bounds);
        const cursorColumn = clamp(cursor.x - labelStartX, 0, labelCapacity);
        const insertAt = toCharIndexByColumn(currentName, cursorColumn);
        const chars = splitGraphemes(currentName);
        const insertedChars = splitGraphemes(inlineText);
        chars.splice(insertAt, 0, ...insertedChars);
        const nextName = chars.join("");
        const nextScene = structuredScene.map((sceneNode) =>
          sceneNode.id === node.id
            ? { ...node, name: nextName || undefined }
            : sceneNode
        );
        applyStructuredScene(nextScene, true);
        const nextCursorText = trimTextToColumns(
          chars.slice(0, insertAt + insertedChars.length).join(""),
          labelCapacity
        );
        const nextCursorColumn = getTextColumnWidth(nextCursorText);
        set({
          textCursor: {
            x: labelStartX + nextCursorColumn,
            y: bounds.y,
          },
          structuredGridFocus: null,
        });
        return;
      }

      const existingNode = findTextNodeAtCursor(
        structuredScene,
        cursor,
        editingStructuredTextNodeId
      );
      if (!existingNode) {
        const nodeId = createStructuredNodeId();
        const nextNode: StructuredTextNode = {
          id: nodeId,
          type: "text",
          order: getNextStructuredOrder(),
          position: { ...cursor },
          text: normalized,
          style: { color: brushColor },
        };
        applyStructuredScene([...structuredScene, nextNode], true);
        set({
          textCursor: getStructuredTextCaretPoint(
            nextNode,
            splitGraphemes(normalized).length
          ),
          editingStructuredTextNodeId: nodeId,
          structuredTextSelection: null,
          selectedStructuredNodeIds: [nodeId],
          selectedStructuredBoxId: null,
          structuredGridFocus: null,
        });
        return;
      }

      const insertAt = getStructuredTextOffsetAtPoint(existingNode, cursor);
      get().replaceStructuredTextRange(
        existingNode.id,
        insertAt,
        insertAt,
        normalized
      );
      return;
    }

    const staticGridView = getStaticGridViewState({
      selection: staticGridSelection,
      editMode: staticGridEditMode,
      textCursor,
      selections,
    });

    if (staticGridView.hasSelection && str.length === 1) {
      fillSelectionsWithChar(str, options);
      return;
    }

    const fallbackSelectionStart = !startPos && !textCursor && staticGridView.hasSelection
      ? staticGridView.selectionAreas[0].start
      : null;

    const cursor = startPos || textCursor || fallbackSelectionStart || staticGridView.activeCell;

    let currentX = cursor.x;
    let currentY = cursor.y;
    const startX = cursor.x;

    documents.mutateGrid((gridWriter) => {
      let index = 0;
      while (index < str.length) {
        if (str[index] === "\r" && str[index + 1] === "\n") {
          currentY++;
          currentX = startX;
          index += 2;
          continue;
        }
        if (str[index] === "\n" || str[index] === "\r") {
          currentY++;
          currentX = startX;
          index += 1;
          continue;
        }

        const char = splitGraphemes(str.slice(index))[0] ?? str[index];
        const charWidth = getCellOccupancy(char);
        const state = get();
        if (
          isPointWithinActiveSlide(state, { x: currentX, y: currentY }) &&
          isPointWithinActiveSlide(state, { x: currentX + charWidth - 1, y: currentY })
        ) {
          placeCharInYMap(
          gridWriter,
          currentX,
          currentY,
          char,
          brushColor,
          options
          );
        }
        currentX += charWidth;
        index += char.length;
      }
    });
    set((state) => ({
      textCursor: clampPointToActiveSlide(state, { x: currentX, y: currentY }),
    }));
  },

  pasteRichData: (cells, startPos) => {
    const {
      textCursor,
      selections,
      staticGridSelection,
      staticGridEditMode,
      canvasMode,
    } = get();
    if (canvasMode === "structured") return;

    const staticGridView = getStaticGridViewState({
      selection: staticGridSelection,
      editMode: staticGridEditMode,
      textCursor,
      selections,
    });

    let pos = startPos || textCursor;
    if (!pos && staticGridView.hasSelection) {
      pos = staticGridView.selectionAreas[0].start;
    }
    pos = pos || staticGridView.activeCell;

    const basePos = pos;
    const cellsBySourcePoint = new Map(
      cells.map((cell) => [GridManager.toKey(cell.x, cell.y), cell])
    );
    documents.mutateGrid((gridWriter) => {
      cells.forEach((cell) => {
        if (isWideFollowerRichCell(cell, cellsBySourcePoint)) return;
        const nextPoint = {
          x: basePos.x + cell.x,
          y: basePos.y + cell.y,
        };
        placeStyledCellInYMap(
          gridWriter,
          nextPoint.x,
          nextPoint.y,
          cell.char,
          {
            color: cell.color,
            ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
            ...(cell.attrs ? { attrs: cell.attrs } : {}),
            ...(cell.href ? { href: cell.href } : {}),
          },
          { preserveTargetBackground: true }
        );
      });
    });
  },

  moveTextCursor: (dx, dy) => {
    const {
      textCursor,
      grid,
      canvasMode,
      structuredScene,
      editingStructuredTextNodeId,
    } = get();
    if (!textCursor) return;
    if (canvasMode === "structured" && editingStructuredTextNodeId && dy === 0 && dx !== 0) {
      const node = structuredScene.find(
        (sceneNode): sceneNode is StructuredTextNode =>
          sceneNode.id === editingStructuredTextNodeId && sceneNode.type === "text"
      );
      if (node) {
        const currentOffset = getStructuredTextOffsetAtPoint(node, textCursor);
        const textLength = splitGraphemes(node.text).length;
        const nextOffset = Math.max(0, Math.min(textLength, currentOffset + dx));
        set({ textCursor: getStructuredTextCaretPoint(node, nextOffset) });
        return;
      }
    }
    let newX = textCursor.x;
    const newY = textCursor.y + dy;
    if (dx > 0) {
      const cell = grid.get(GridManager.toKey(newX, textCursor.y));
      newX += getCellOccupancy(cell?.char || " ");
    } else if (dx < 0) {
      const leftKey = GridManager.toKey(newX - 1, textCursor.y);
      const leftCell = grid.get(leftKey);
      if (!leftCell) {
        const farLeftCell = grid.get(GridManager.toKey(newX - 2, textCursor.y));
        newX -= farLeftCell && getCellOccupancy(farLeftCell.char) === 2 ? 2 : 1;
      } else {
        newX -= 1;
      }
    }
    set((state) => ({
      textCursor: clampPointToActiveSlide(state, { x: newX, y: newY }),
    }));
  },

  backspaceText: () => {
    const { textCursor, grid, canvasMode, structuredScene, applyStructuredScene, editingStructuredTextNodeId } = get();
    if (!textCursor) return;

    if (canvasMode === "structured") {
      const selectedRange = getStructuredTextSelectionRange(
        get().structuredTextSelection
      );
      const selectedNodeId = get().structuredTextSelection?.nodeId;
      if (selectedRange && selectedNodeId) {
        get().replaceStructuredTextRange(
          selectedNodeId,
          selectedRange.start,
          selectedRange.end,
          ""
        );
        return;
      }
      const boxNameTarget = findBoxNameTargetAtCursor(structuredScene, textCursor);
      if (boxNameTarget) {
        const { node, bounds } = boxNameTarget;
        const labelCapacity = getBoxNameTextCapacity(bounds);
        const currentName = node.name || "";
        if (!currentName) return;
        const labelStartX = getBoxNameTextStartX(bounds);
        const cursorColumn = clamp(textCursor.x - labelStartX, 0, labelCapacity);
        const visibleNameBeforeCursor = trimTextToColumns(currentName, cursorColumn);
        const deleteAt = splitGraphemes(visibleNameBeforeCursor).length - 1;
        if (deleteAt < 0) return;

        const chars = splitGraphemes(currentName);
        chars.splice(deleteAt, 1);
        const nextName = chars.join("");
        const nextCursorColumn = getTextColumnWidth(chars.slice(0, deleteAt).join(""));
        applyStructuredScene(
          structuredScene.map((sceneNode) =>
            sceneNode.id === node.id
              ? { ...node, name: nextName || undefined }
              : sceneNode
          ),
          true
        );
        set({
          textCursor: {
            x: labelStartX + nextCursorColumn,
            y: bounds.y,
          },
        });
        return;
      }

      const existingNode = findTextNodeAtCursor(
        structuredScene,
        textCursor,
        editingStructuredTextNodeId
      );
      if (!existingNode) return;

      const deleteAt = getStructuredTextOffsetAtPoint(existingNode, textCursor) - 1;
      if (deleteAt < 0) return;

      get().replaceStructuredTextRange(
        existingNode.id,
        deleteAt,
        deleteAt + 1,
        ""
      );
      return;
    }

    documents.mutateGrid((gridWriter) => {
      const { x, y } = textCursor;
      const deletePos = resolveBackspaceAnchor(grid, x, y);
      deleteCellAt(gridWriter, deletePos.x, deletePos.y);
      set({ textCursor: deletePos });
    });
  },

  deleteTextForward: () => {
    const {
      textCursor,
      canvasMode,
      structuredScene,
      applyStructuredScene,
      editingStructuredTextNodeId,
    } = get();
    if (!textCursor || canvasMode !== "structured") return;

    const selectedRange = getStructuredTextSelectionRange(
      get().structuredTextSelection
    );
    const selectedNodeId = get().structuredTextSelection?.nodeId;
    if (selectedRange && selectedNodeId) {
      get().replaceStructuredTextRange(
        selectedNodeId,
        selectedRange.start,
        selectedRange.end,
        ""
      );
      return;
    }

    const boxNameTarget = findBoxNameTargetAtCursor(structuredScene, textCursor);
    if (!boxNameTarget) {
      const existingNode = findTextNodeAtCursor(
        structuredScene,
        textCursor,
        editingStructuredTextNodeId
      );
      if (!existingNode) return;
      const deleteAt = getStructuredTextOffsetAtPoint(existingNode, textCursor);
      if (deleteAt >= splitGraphemes(existingNode.text).length) return;
      get().replaceStructuredTextRange(
        existingNode.id,
        deleteAt,
        deleteAt + 1,
        ""
      );
      return;
    }

    const { node, bounds } = boxNameTarget;
    const labelCapacity = getBoxNameTextCapacity(bounds);
    const currentName = node.name || "";
    if (!currentName) return;

    const labelStartX = getBoxNameTextStartX(bounds);
    const cursorColumn = clamp(textCursor.x - labelStartX, 0, labelCapacity);
    const visibleNameBeforeCursor = trimTextToColumns(currentName, cursorColumn);
    const deleteAt = splitGraphemes(visibleNameBeforeCursor).length;
    const chars = splitGraphemes(currentName);
    if (deleteAt >= chars.length) return;

    chars.splice(deleteAt, 1);
    const nextName = chars.join("");
    applyStructuredScene(
      structuredScene.map((sceneNode) =>
        sceneNode.id === node.id
          ? { ...node, name: nextName || undefined }
          : sceneNode
      ),
      true
    );
    set({ textCursor: { x: textCursor.x, y: bounds.y } });
  },

  newlineText: () => {
    const { textCursor, grid, canvasMode, structuredScene, editingStructuredTextNodeId } = get();
    if (!textCursor) return;
    if (canvasMode === "structured") {
      const selectedRange = getStructuredTextSelectionRange(
        get().structuredTextSelection
      );
      const selectedNodeId = get().structuredTextSelection?.nodeId;
      if (selectedRange && selectedNodeId) {
        get().replaceStructuredTextRange(
          selectedNodeId,
          selectedRange.start,
          selectedRange.end,
          "\n"
        );
        return;
      }

      const existingNode = findTextNodeAtCursor(
        structuredScene,
        textCursor,
        editingStructuredTextNodeId
      );
      if (existingNode) {
        const insertAt = getStructuredTextOffsetAtPoint(existingNode, textCursor);
        get().replaceStructuredTextRange(
          existingNode.id,
          insertAt,
          insertAt,
          "\n"
        );
        return;
      }

      set({ textCursor: { x: textCursor.x, y: textCursor.y + 1 } });
      return;
    }

    const currentY = textCursor.y;
    const currentX = textCursor.x;
    const targetX = getNewlineTargetX(grid, currentX, currentY);
    set({
      textCursor: { x: targetX, y: currentY + 1 },
    });
  },

  indentText: () => {
    const { textCursor } = get();
    if (!textCursor) return;
    set({
      textCursor: { x: textCursor.x + 2, y: textCursor.y },
    });
  },
});
