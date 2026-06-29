import type { StateCreator } from "zustand";
import type { CanvasState, SelectionSlice } from "../interfaces";
import { transactWithHistory, yMainGrid } from "@/shared/lib/yjs-setup";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionBounds } from "@/shared/utils/selection";
import {
  copySelectionToPngClipboard,
  exportStructuredF12Text,
} from "@/domains/export";
import { placeCharInYMap } from "../utils";
import { clipboard, feedback } from "@/shared/services/effects";
import type { GridCell } from "@/shared/types";
import { deleteRect } from "../gridOps";
import {
  buildClipboardPayload,
  hasClipboardSource,
  readClipboardPayload,
  writeClipboardPayload,
} from "@/domains/actions/adapters/clipboardActions";
import { getStructuredNodeBounds, intersectsBounds, withPointWithinBounds } from "@/shared/utils/structured";
import { clampSelectionToBounds } from "../helpers/animationHelpers";
import {
  collapseGridSelectionTo,
  createGridSelectionState,
  gridRangeFromSelectionArea,
  getStaticGridSelectionAreas,
} from "../helpers/staticGridModel";
import { getCellOccupancy } from "@/shared/metrics";
import { cloneTextAttributes } from "@/shared/utils/ansi";

const resolveSelectionAreas = (state: CanvasState) => {
  const staticSelections = getStaticGridSelectionAreas(state.staticGridSelection);
  return staticSelections.length > 0 ? staticSelections : state.selections;
};

export const createSelectionSlice: StateCreator<
  CanvasState,
  [],
  [],
  SelectionSlice
> = (set, get) => ({
  selections: [],
  addSelection: (area) =>
    set((s) => {
      const nextArea = clampSelectionToBounds(area, s.canvasBounds);
      const range = gridRangeFromSelectionArea(nextArea);
      return {
        selections: [...s.selections, nextArea],
        textCursor: null,
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
      staticGridSelection: createGridSelectionState(
        state.staticGridSelection.activeCell
      ),
      staticGridEditMode: "navigate" as const,
    })),
  canCopyOrCut: () => {
    const state = get();
    const { textCursor, canvasMode, structuredScene } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") return structuredScene.length > 0;
    return hasClipboardSource(selections, textCursor);
  },

  deleteSelection: () => {
    const state = get();
    const { canvasMode, structuredScene, applyStructuredScene, textCursor } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") {
      if (structuredScene.length === 0) return;
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

    transactWithHistory(() => {
      selections.forEach((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        deleteRect(yMainGrid, minX, minY, maxX, maxY);
      });
    });
  },

  copySelection: async (options) => {
    const state = get();
    const {
      grid,
      textCursor,
      brushColor,
      canvasMode,
      structuredScene,
    } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") {
      const copied = await clipboard.writeText(
        exportStructuredF12Text(structuredScene)
      );
      if (!copied) {
        feedback.error("Copy failed", {
          description: "Could not write structured export to clipboard.",
        });
      }
      return;
    }
    const payload = buildClipboardPayload(
      grid,
      selections,
      textCursor,
      brushColor,
      options?.ansi ? "ansi" : "plain"
    );
    if (!payload) return;
    await writeClipboardPayload(payload, {
      event: options?.event,
      withRich: !!options?.rich && !options?.ansi,
    });
  },

  cutSelection: async (options) => {
    const state = get();
    const {
      grid,
      textCursor,
      brushColor,
      deleteSelection,
      erasePoints,
      canvasMode,
    } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") {
      feedback.warning("Cut disabled in structured mode", {
        description: "Use delete on selected nodes instead.",
      });
      return;
    }
    const payload = buildClipboardPayload(grid, selections, textCursor, brushColor);
    if (!payload) return;

    const copied = await writeClipboardPayload(payload, {
      event: options?.event,
      withRich: false,
    });
    if (!copied) return;

    if (selections.length > 0) {
      deleteSelection();
    } else if (textCursor) {
      erasePoints([textCursor]);
    }
  },

  pasteFromClipboard: async (options) => {
    const { pasteRichData, writeTextString, canvasMode, brushColor } = get();
    if (canvasMode === "structured") {
      feedback.warning("Paste disabled in structured mode", {
        description: "Structured mode only accepts node-based editing.",
      });
      return;
    }
    const payload = await readClipboardPayload(
      options?.eventDataTransfer,
      brushColor
    );

    if (payload.richCells) {
      pasteRichData(payload.richCells);
      return;
    }

    if (payload.plainText) {
      writeTextString(payload.plainText);
    }
  },

  copySelectionAsPng: async (withGrid) => {
    const state = get();
    const { grid } = state;
    const selections = resolveSelectionAreas(state);
    if (selections.length === 0) return;
    try {
      await copySelectionToPngClipboard(grid, selections, withGrid);
      feedback.success("Snapshot Copied", {
        description: withGrid
          ? "Image with grid lines is ready to paste."
          : "Image without grid lines is ready to paste.",
      });
    } catch {
      feedback.error("Snapshot Failed", {
        description: "Could not write image to clipboard.",
      });
    }
  },

  fillSelectionsWithChar: (char) => {
    const state = get();
    const { brushColor, canvasMode } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") return;
    if (selections.length === 0) return;

    const charWidth = getCellOccupancy(char);

    transactWithHistory(() => {
      selections.forEach((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x += charWidth) {
            if (x + charWidth - 1 > maxX) break;
            placeCharInYMap(yMainGrid, x, y, char, brushColor);
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

    transactWithHistory(() => {
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
    const { canvasMode } = state;
    const selections = resolveSelectionAreas(state);
    if (canvasMode === "structured") return;
    if (selections.length === 0) return;

    transactWithHistory(() => {
      selections.forEach((area) => {
        const { minX, maxX, minY, maxY } = getSelectionBounds(area);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const key = GridManager.toKey(x, y);
            const existingCell = yMainGrid.get(key) as GridCell | undefined;
            if (!existingCell) continue;

            const nextCell = { ...existingCell };
            if (bgColor) {
              nextCell.bgColor = bgColor;
            } else {
              delete nextCell.bgColor;
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

    transactWithHistory(() => {
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
    const { selections, canvasBounds } = get();
    if (selections.length === 0) return;

    set({
      selections: selections.map((area) => ({
        ...clampSelectionToBounds(
          {
            start: { x: area.start.x + dx, y: area.start.y + dy },
            end: { x: area.end.x + dx, y: area.end.y + dy },
          },
          canvasBounds
        ),
      })),
    });
  },

  expandSelection: (dx, dy) => {
    const { selections, canvasBounds } = get();
    if (selections.length === 0) return;

    // Only expand the last selection (most recent)
    const lastIndex = selections.length - 1;
    const lastSelection = selections[lastIndex];

    const newSelections = [...selections];
    newSelections[lastIndex] = clampSelectionToBounds(
      {
        start: { ...lastSelection.start },
        end: { x: lastSelection.end.x + dx, y: lastSelection.end.y + dy },
      },
      canvasBounds
    );

    set({ selections: newSelections });
  },
});
