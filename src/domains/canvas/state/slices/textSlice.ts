import type { StateCreator } from "zustand";
import type { CanvasState, TextSlice } from "../interfaces";
import { transactWithHistory, yMainGrid } from "@/shared/lib/yjs-setup";
import { GridManager } from "@/shared/utils/grid";
import { placeCharInYMap } from "../utils";
import {
  deleteCellAt,
  resolveBackspaceAnchor,
} from "../gridOps";
import type { StructuredBoxNode, StructuredTextNode } from "@/shared/types";
import {
  createStructuredNodeId,
  getTextColumnWidth,
  trimTextToColumns,
  withPointWithinBounds,
  getStructuredNodeBounds,
} from "@/shared/utils/structured";
import {
  clampPointToBounds,
  isPointWithinBounds,
} from "../helpers/animationHelpers";
import {
  getCellOccupancy,
  splitGraphemes,
} from "@/shared/metrics";

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
  scene: CanvasState["structuredScene"],
  cursor: CanvasState["textCursor"]
) => {
  if (!cursor) return null;
  const candidates = scene.filter((node): node is StructuredTextNode => {
    if (node.type !== "text") return false;
    const bounds = getStructuredNodeBounds(node);
    return withPointWithinBounds(cursor, bounds, true);
  });
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.order - a.order)[0];
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const getNewlineTargetX = (
  grid: CanvasState["grid"],
  currentX: number,
  currentY: number
) => {
  let firstOccupiedX: number | null = null;

  grid.forEach((cell, key) => {
    if (!cell || cell.char === " ") return;
    const { x, y } = GridManager.fromKey(key);
    if (y !== currentY) return;
    firstOccupiedX =
      firstOccupiedX === null ? x : Math.min(firstOccupiedX, x);
  });

  if (firstOccupiedX === null || currentX <= firstOccupiedX) {
    return currentX;
  }

  let indentEndX = firstOccupiedX;
  for (let x = 0; x < firstOccupiedX; x++) {
    const cell = grid.get(GridManager.toKey(x, currentY));
    if (cell && cell.char !== " ") return currentX;
    indentEndX = x + 1;
  }

  return Math.min(currentX, indentEndX);
};

const findBoxNameTargetAtCursor = (
  scene: CanvasState["structuredScene"],
  cursor: CanvasState["textCursor"]
) => {
  if (!cursor) return null;
  const candidates = scene
    .filter((node): node is StructuredBoxNode => node.type === "box")
    .map((node) => ({ node, bounds: getStructuredNodeBounds(node) }))
    .filter(({ bounds }) => {
      const left = bounds.x + 1;
      const right = bounds.x + bounds.width - 2;
      if (left > right) return false;
      return cursor.y === bounds.y && cursor.x >= left && cursor.x <= right;
    });

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    if (a.node.order !== b.node.order) return b.node.order - a.node.order;
    return a.bounds.width - b.bounds.width;
  })[0];
};

export const createTextSlice: StateCreator<CanvasState, [], [], TextSlice> = (
  set,
  get
) => ({
  textCursor: null,
  setTextCursor: (pos) => set({ textCursor: pos, selections: [] }),

  writeTextString: (str, startPos) => {
    const {
      selections,
      fillSelectionsWithChar,
      textCursor,
      brushColor,
      canvasMode,
      canvasBounds,
      structuredScene,
      applyStructuredScene,
      getNextStructuredOrder,
    } = get();

    if (canvasMode === "structured") {
      const normalized = str.replace(/[\r\n]+/g, "");
      if (!normalized) return;
      const cursor = startPos || textCursor;
      if (!cursor) return;

      const boxNameTarget = findBoxNameTargetAtCursor(structuredScene, cursor);
      if (boxNameTarget) {
        const { node, bounds } = boxNameTarget;
        const labelCapacity = Math.max(0, bounds.width - 2);
        if (labelCapacity <= 0) return;
        const currentName = node.name || "";
        const labelStartX = bounds.x + 1;
        const cursorColumn = clamp(cursor.x - labelStartX, 0, labelCapacity);
        const insertAt = toCharIndexByColumn(currentName, cursorColumn);
        const chars = splitGraphemes(currentName);
        chars.splice(insertAt, 0, ...splitGraphemes(normalized));
        const nextName = trimTextToColumns(chars.join(""), labelCapacity);
        const nextScene = structuredScene.map((sceneNode) =>
          sceneNode.id === node.id
            ? { ...node, name: nextName || undefined }
            : sceneNode
        );
        applyStructuredScene(nextScene, true);
        set({
          textCursor: {
            x:
              labelStartX +
              clamp(cursorColumn + getTextColumnWidth(normalized), 0, labelCapacity),
            y: bounds.y,
          },
        });
        return;
      }

      const existingNode = findTextNodeAtCursor(structuredScene, cursor);
      if (!existingNode) {
        const nextNode: StructuredTextNode = {
          id: createStructuredNodeId(),
          type: "text",
          order: getNextStructuredOrder(),
          position: { ...cursor },
          text: normalized,
          style: { color: brushColor },
        };
        applyStructuredScene([...structuredScene, nextNode], true);
        set({
          textCursor: {
            x: cursor.x + getTextColumnWidth(normalized),
            y: cursor.y,
          },
        });
        return;
      }

      const columnOffset = Math.max(0, cursor.x - existingNode.position.x);
      const insertAt = toCharIndexByColumn(existingNode.text, columnOffset);
      const chars = splitGraphemes(existingNode.text);
      chars.splice(insertAt, 0, ...splitGraphemes(normalized));
      const nextText = chars.join("");
      const nextScene = structuredScene.map((node) =>
        node.id === existingNode.id
          ? { ...existingNode, text: nextText, style: { color: brushColor } }
          : node
      );
      applyStructuredScene(nextScene, true);
      set({
        textCursor: {
          x: cursor.x + getTextColumnWidth(normalized),
          y: cursor.y,
        },
      });
      return;
    }

    if (selections.length > 0 && str.length === 1) {
      fillSelectionsWithChar(str);
      return;
    }

    const fallbackSelectionStart =
      !startPos && !textCursor && selections.length > 0
        ? {
            x: Math.min(selections[0].start.x, selections[0].end.x),
            y: Math.min(selections[0].start.y, selections[0].end.y),
          }
        : null;

    const cursor = startPos || textCursor || fallbackSelectionStart;
    if (!cursor) return;

    const boundedCursor = clampPointToBounds(cursor, canvasBounds);
    let currentX = boundedCursor.x;
    let currentY = boundedCursor.y;
    const startX = boundedCursor.x;

    transactWithHistory(() => {
      for (const char of splitGraphemes(str)) {
        if (char === "\n") {
          if (
            canvasBounds &&
            currentY + 1 >= canvasBounds.height
          ) {
            break;
          }
          currentY++;
          currentX = startX;
          continue;
        }
        if (!isPointWithinBounds({ x: currentX, y: currentY }, canvasBounds)) {
          continue;
        }
        if (canvasBounds && currentX >= canvasBounds.width) {
          continue;
        }
        placeCharInYMap(yMainGrid, currentX, currentY, char, brushColor);
        currentX += getCellOccupancy(char);
      }
    });
    set({ textCursor: { x: currentX, y: currentY } });
  },

  pasteRichData: (cells, startPos) => {
    const { textCursor, selections, canvasMode, canvasBounds } = get();
    if (canvasMode === "structured") return;

    let pos = startPos || textCursor;
    if (!pos && selections.length > 0) {
      const sel = selections[0];
      pos = {
        x: Math.min(sel.start.x, sel.end.x),
        y: Math.min(sel.start.y, sel.end.y),
      };
    }
    if (!pos) return;

    const basePos = pos;
    transactWithHistory(() => {
      cells.forEach((cell) => {
        const nextPoint = {
          x: basePos.x + cell.x,
          y: basePos.y + cell.y,
        };
        if (!isPointWithinBounds(nextPoint, canvasBounds)) return;
        placeCharInYMap(
          yMainGrid,
          nextPoint.x,
          nextPoint.y,
          cell.char,
          cell.color
        );
      });
    });
  },

  moveTextCursor: (dx, dy) => {
    const { textCursor, grid, canvasBounds } = get();
    if (!textCursor) return;
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
    set({ textCursor: clampPointToBounds({ x: newX, y: newY }, canvasBounds) });
  },

  backspaceText: () => {
    const { textCursor, grid, canvasMode, structuredScene, applyStructuredScene } = get();
    if (!textCursor) return;

    if (canvasMode === "structured") {
      const boxNameTarget = findBoxNameTargetAtCursor(structuredScene, textCursor);
      if (boxNameTarget) {
        const { node, bounds } = boxNameTarget;
        const labelCapacity = Math.max(0, bounds.width - 2);
        const currentName = trimTextToColumns(node.name || "", labelCapacity);
        if (!currentName) return;
        const labelStartX = bounds.x + 1;
        const cursorColumn = clamp(textCursor.x - labelStartX, 0, labelCapacity);
        const deleteAt = toCharIndexByColumn(currentName, cursorColumn) - 1;
        if (deleteAt < 0) return;

        const chars = splitGraphemes(currentName);
        const removed = chars[deleteAt];
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
        set({
          textCursor: {
            x: Math.max(labelStartX, textCursor.x - getCellOccupancy(removed)),
            y: bounds.y,
          },
        });
        return;
      }

      const existingNode = findTextNodeAtCursor(structuredScene, textCursor);
      if (!existingNode) return;

      const columnOffset = Math.max(0, textCursor.x - existingNode.position.x);
      const deleteAt = toCharIndexByColumn(existingNode.text, columnOffset) - 1;
      if (deleteAt < 0) return;

      const chars = splitGraphemes(existingNode.text);
      const removed = chars[deleteAt];
      chars.splice(deleteAt, 1);
      const nextText = chars.join("");
      if (!nextText) {
        applyStructuredScene(
          structuredScene.filter((node) => node.id !== existingNode.id),
          true
        );
      } else {
        applyStructuredScene(
          structuredScene.map((node) =>
            node.id === existingNode.id
              ? { ...existingNode, text: nextText }
              : node
          ),
          true
        );
      }
      set({
        textCursor: {
          x: textCursor.x - getCellOccupancy(removed),
          y: textCursor.y,
        },
      });
      return;
    }

    transactWithHistory(() => {
      const { x, y } = textCursor;
      const deletePos = resolveBackspaceAnchor(grid, x, y);
      deleteCellAt(yMainGrid, deletePos.x, deletePos.y);
      set({ textCursor: deletePos });
    });
  },

  newlineText: () => {
    const { textCursor, grid, canvasMode, canvasBounds } = get();
    if (!textCursor) return;
    if (canvasMode === "structured") {
      set({ textCursor: { x: textCursor.x, y: textCursor.y + 1 } });
      return;
    }

    const currentY = textCursor.y;
    const currentX = textCursor.x;
    const targetX = getNewlineTargetX(grid, currentX, currentY);
    set({
      textCursor: clampPointToBounds(
        { x: targetX, y: currentY + 1 },
        canvasBounds
      ),
    });
  },

  indentText: () => {
    const { textCursor, canvasBounds } = get();
    if (!textCursor) return;
    set({
      textCursor: clampPointToBounds(
        { x: textCursor.x + 2, y: textCursor.y },
        canvasBounds
      ),
    });
  },
});
