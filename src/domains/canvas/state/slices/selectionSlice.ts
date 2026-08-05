import type { StateCreator } from "zustand";
import type { EditorState, SelectionSlice } from "../interfaces";
import { runCanvasTransaction, yMainGrid } from "../yjs";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionBounds } from "@/shared/utils/selection";
import { placeCharInYMap } from "../utils";
import type { GridCell } from "@/shared/types";
import { deleteRect } from "../gridOps";
import {  getStructuredNodeBounds,
  intersectsBounds,
  withPointWithinBounds,
} from "@/domains/structured-content/public";
import {
  deleteStructuredSplitBoxSplit,
  isStructuredSplitBoxLineHandle,
} from "@/domains/structured-content/public";
import {
  collapseGridSelectionTo,
  createGridSelectionState,
  gridRangeFromSelectionArea,
  getStaticGridSelectionAreas,
} from "@/domains/selection/public";
import { getCellOccupancy } from "@/shared/metrics";
import { cloneTextAttributes } from "@/shared/utils/ansi";
import { resolveSelectionCommands } from "../selectionCommandPort";
import { getStructuredTextSelectionRange } from "@/domains/structured-content/public";
import { clampPointToActiveSlide, isPointWithinActiveSlide } from "../slideBounds";

const resolveSelectionAreas = (state: EditorState) => {
  const staticSelections = getStaticGridSelectionAreas(state.staticGridSelection);
  return staticSelections.length > 0 ? staticSelections : state.selections;
};

const getActiveStructuredTextSelection = (state: EditorState) => {
  if (state.canvasMode !== "structured") return null;
  const range = getStructuredTextSelectionRange(state.structuredTextSelection);
  if (!range || !state.structuredTextSelection) return null;
  const node = state.structuredScene.find(
    (sceneNode) =>
      sceneNode.id === state.structuredTextSelection?.nodeId &&
      sceneNode.type === "text"
  );
  if (!node || node.type !== "text") return null;
  return { node, range };
};

export const createSelectionSlice: StateCreator<
  EditorState,
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  selections: [],
  addSelection: (area) =>
    set((s) => {
      const nextArea = area;
      const range = gridRangeFromSelectionArea(nextArea);
      return {
        selections: [...s.selections, nextArea],
        textCursor: null,
        editingStructuredTextNodeId: null,
        structuredTextSelection: null,
        staticGridSelection: {
          activeCell: { ...range.end },
          anchorCell: { ...range.start },
          ranges: [...s.staticGridSelection.ranges, range],
        },
        staticGridEditMode: "navigate" as const,
      };
    }),
  clearSelections: () =>
    set((state) => ({
      selections: [],
      staticGridSelection: collapseGridSelectionTo(
        state.staticGridSelection,
        state.staticGridSelection.activeCell
      ),
    })),
  clearInteractionState: () =>
    set((state) => ({
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      structuredGridFocus: null,
      staticGridSelection: createGridSelectionState(
        state.staticGridSelection.activeCell
      ),
      staticGridEditMode: "navigate" as const,
    })),
  canCopyOrCut: () => resolveSelectionCommands(set, get).canCopyOrCut(),
  deleteSelection: () => {
    const state = get();
    const {
      canvasMode,
      structuredScene,
      selectedStructuredNodeIds,
      selectedStructuredSplitHandle,
      applyStructuredScene,
      textCursor,
    } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") {
      const textSelection = getActiveStructuredTextSelection(state);
      if (textSelection) {
        state.replaceStructuredTextRange(
          textSelection.node.id,
          textSelection.range.start,
          textSelection.range.end,
          ""
        );
        return;
      }
      if (structuredScene.length === 0) return;
      const splitHandle = selectedStructuredSplitHandle?.handle;
      if (
        selectedStructuredSplitHandle &&
        splitHandle &&
        isStructuredSplitBoxLineHandle(splitHandle)
      ) {
        let didUpdate = false;
        const nextScene = structuredScene.map((node) => {
          if (
            node.id !== selectedStructuredSplitHandle.nodeId ||
            node.type !== "splitBox"
          ) {
            return node;
          }
          didUpdate = true;
          return deleteStructuredSplitBoxSplit(
            node,
            splitHandle
          );
        });
        if (didUpdate) {
          applyStructuredScene(nextScene, true);
          set({ selectedStructuredSplitHandle: null, structuredContextPoint: null });
        }
        return;
      }
      if (selectedStructuredNodeIds.length > 0) {
        const selectedIds = new Set(selectedStructuredNodeIds);
        const nextScene = structuredScene.filter((node) => !selectedIds.has(node.id));
        if (nextScene.length !== structuredScene.length) {
          applyStructuredScene(nextScene, true);
          set({ selectedStructuredNodeIds: [], selectedStructuredBoxId: null, selectedStructuredSplitHandle: null, structuredContextPoint: null });
        }
        return;
      }
      const bounds = selections.map((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        return {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        };
      });
      const nextScene = structuredScene.filter((node) => {
        const nodeBounds = getStructuredNodeBounds(node);
        if (
          textCursor &&
          withPointWithinBounds(textCursor, nodeBounds, true)
        ) {
          return false;
        }
        return !bounds.some((selectionBounds) =>
          intersectsBounds(nodeBounds, selectionBounds)
        );
      });
      if (nextScene.length !== structuredScene.length) {
        applyStructuredScene(nextScene, true);
      }
      return;
    }

    runCanvasTransaction(() => {
      selections.forEach((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        deleteRect(yMainGrid, minX, minY, maxX, maxY);
      });
    });
  },

  copySelection: (options) =>
    resolveSelectionCommands(set, get).copySelection(options),
  cutSelection: (options) =>
    resolveSelectionCommands(set, get).cutSelection(options),
  pasteFromClipboard: (options) =>
    resolveSelectionCommands(set, get).pasteFromClipboard(options),
  copySelectionAsPng: (withGrid) =>
    resolveSelectionCommands(set, get).copySelectionAsPng(withGrid),
  fillSelectionsWithChar: (char, options) => {
    const state = get();
    const { brushColor, canvasMode } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") return;
    if (selections.length === 0) return;

    const charWidth = getCellOccupancy(char);

    runCanvasTransaction(() => {
      selections.forEach((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x += charWidth) {
            if (x + charWidth - 1 > maxX) break;
            placeCharInYMap(
              yMainGrid,
              x,
              y,
              char,
              brushColor,
              options
            );
          }
        }
      });
    });
  },

  setSelectionTextAttributes: (attrs) => {
    const state = get();
    const { brushColor, canvasMode } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") return;
    if (selections.length === 0) return;

    const shouldMaterializeBlank =
      attrs.underline === true || attrs.strike === true;

    runCanvasTransaction(() => {
      selections.forEach((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const key = GridManager.toKey(x, y);
            const existingCell = yMainGrid.get(key) as GridCell | undefined;
            if (!existingCell && !shouldMaterializeBlank) continue;

            const nextAttrs = cloneTextAttributes(existingCell?.attrs) ?? {};
            Object.entries(attrs).forEach(([name, enabled]) => {
              const attrName = name as "bold" | "italic" | "underline" | "strike";
              if (enabled) {
                nextAttrs[attrName] = true;
              } else {
                delete nextAttrs[attrName];
              }
            });

            const normalizedAttrs = cloneTextAttributes(nextAttrs);
            const nextCell: GridCell = existingCell
              ? { ...existingCell }
              : { char: " ", color: brushColor };
            if (normalizedAttrs) {
              nextCell.attrs = normalizedAttrs;
            } else {
              delete nextCell.attrs;
            }
            if (
              nextCell.char === " " &&
              !nextCell.bgColor &&
              !cloneTextAttributes(nextCell.attrs)
            ) {
              yMainGrid.delete(key);
              continue;
            }
            yMainGrid.set(key, nextCell);
          }
        }
      });
    });
  },

  setSelectionBackgroundColor: (bgColor) => {
    const state = get();
    const { brushColor, canvasMode } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") return;
    if (selections.length === 0) return;

    runCanvasTransaction(() => {
      selections.forEach((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const key = GridManager.toKey(x, y);
            const existingCell = yMainGrid.get(key) as GridCell | undefined;
            if (!existingCell && !bgColor) continue;

            const nextCell: GridCell = existingCell
              ? { ...existingCell }
              : { char: " ", color: brushColor };
            if (bgColor) {
              nextCell.bgColor = bgColor;
            } else {
              delete nextCell.bgColor;
            }
            if (
              nextCell.char === " " &&
              !nextCell.bgColor &&
              !cloneTextAttributes(nextCell.attrs)
            ) {
              yMainGrid.delete(key);
              continue;
            }
            yMainGrid.set(key, nextCell);
          }
        }
      });
    });
  },

  fillArea: (area) => {
    const { brushColor, canvasMode } = get();
    if (canvasMode === "structured") return;
    const { minX, maxX, minY, maxY } = getSelectionBounds(area);

    runCanvasTransaction(() => {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const key = GridManager.toKey(x, y);
          const existingCell = yMainGrid.get(key) as GridCell | undefined;

          if (existingCell) {
            yMainGrid.set(key, {
              ...existingCell,
              char: existingCell.char,
              color: brushColor,
            });
          }
        }
      }
    });
  },

  moveSelections: (dx, dy) => {
    const state = get();
    if (state.selections.length === 0) return;
    const selections = state.selections.map((area) => ({
      start: { x: area.start.x + dx, y: area.start.y + dy },
      end: { x: area.end.x + dx, y: area.end.y + dy },
    }));
    if (
      selections.some(
        (area) =>
          !isPointWithinActiveSlide(state, area.start) ||
          !isPointWithinActiveSlide(state, area.end)
      )
    ) return;
    set({ selections });
  },

  expandSelection: (dx, dy) => {
    const { selections } = get();
    if (selections.length === 0) return;

    // Only expand the last selection (most recent)
    const lastIndex = selections.length - 1;
    const lastSelection = selections[lastIndex];

    const newSelections = [...selections];
    newSelections[lastIndex] = {
      start: { ...lastSelection.start },
      end: clampPointToActiveSlide(get(), {
        x: lastSelection.end.x + dx,
        y: lastSelection.end.y + dy,
      }),
    };

    set({ selections: newSelections });
  },
});
