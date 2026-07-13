import type { StateCreator } from "zustand";
import type { CanvasState, DrawingSlice } from "../interfaces";
import { runCanvasTransaction, yMainGrid } from "@/shared/lib/yjs-setup";
import { GridManager } from "@/shared/utils/grid";
import type { GridPoint, StructuredBoxNode, StructuredNode } from "@/shared/types";
import { placeCharInMap, placeCharInYMap } from "../utils";
import { deleteCellAt } from "../gridOps";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import {
  getBoxPoints,
  getCirclePoints,
  createDefaultSplitBoxRoot,
  getLShapeLinePoints,
  getSplitBoxPoints,
  getStepLinePoints,
} from "@/shared/utils/shapes";
import { createStructuredNodeId } from "@/shared/utils/structured";
import {
  duplicateStructuredNodes,
  reorderStructuredNodes,
} from "@/domains/structured-content/public";
import {
  addStructuredSplitBoxSplit,
  canSplitStructuredSplitBoxLeaf,
  getStructuredSplitBoxLeafAtPoint,
} from "@/domains/structured-content/public";
import { filterGridPointsToBounds, filterPointsToBounds } from "@/domains/animation/public";
import { cloneTextAttributes } from "@/shared/utils/ansi";
import { splitGraphemes } from "@/shared/metrics";
import {
  getStructuredTextSelectionRange,
  updateStructuredTextStyleRanges,
} from "@/shared/utils/structuredTextRanges";

const getFilledRectPoints = (
  start: { x: number; y: number },
  end: { x: number; y: number }
): GridPoint[] => {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const points: GridPoint[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      points.push({ x, y, char: " " });
    }
  }
  return points;
};

export const createDrawingSlice: StateCreator<
  CanvasState,
  [],
  [],
  DrawingSlice
> = (set, get) => ({
  scratchLayer: null,

  setScratchLayer: (points) => {
    const { brushColor, canvasBounds } = get();
    const layer = new Map();
    filterGridPointsToBounds(points, canvasBounds).forEach((p) => {
      if (p.bgColor || p.attrs || p.href) {
        layer.set(GridManager.toKey(p.x, p.y), {
          char: p.char,
          color: p.color || brushColor,
          ...(p.bgColor ? { bgColor: p.bgColor } : {}),
          ...(p.attrs ? { attrs: p.attrs } : {}),
          ...(p.href ? { href: p.href } : {}),
        });
        return;
      }
      placeCharInMap(layer, p.x, p.y, p.char, p.color || brushColor);
    });
    set({ scratchLayer: layer });
  },

  addScratchPoints: (points) => {
    const { brushColor, canvasBounds } = get();
    set((state) => {
      const layer = new Map(state.scratchLayer || []);
      filterGridPointsToBounds(points, canvasBounds).forEach((p) => {
        if (p.bgColor || p.attrs || p.href) {
          layer.set(GridManager.toKey(p.x, p.y), {
            char: p.char,
            color: p.color || brushColor,
            ...(p.bgColor ? { bgColor: p.bgColor } : {}),
            ...(p.attrs ? { attrs: p.attrs } : {}),
            ...(p.href ? { href: p.href } : {}),
          });
          return;
        }
        placeCharInMap(layer, p.x, p.y, p.char, p.color || brushColor);
      });
      return { scratchLayer: layer };
    });
  },

  updateScratchForShape: (tool, start, end, options) => {
    let points: GridPoint[] = [];
    const color = get().brushColor;
    switch (tool) {
      case "box":
        points = getBoxPoints(start, end);
        break;
      case "splitBox":
        points = getSplitBoxPoints(start, end, {
          verticalSplitRatio: 0.36,
          topSplitRatio: 0.25,
          bottomSplitRatio: 0.75,
          root: createDefaultSplitBoxRoot({
            verticalSplitRatio: 0.36,
            topSplitRatio: 0.25,
            bottomSplitRatio: 0.75,
          }),
        });
        break;
      case "bg":
        points = getFilledRectPoints(start, end).map((point) => ({
          ...point,
          color: COLOR_PRIMARY_TEXT,
          bgColor: color,
        }));
        break;
      case "circle":
        points = getCirclePoints(start, end);
        break;
      case "stepline":
        points = getStepLinePoints(start, end);
        break;
      case "line": {
        const isVerticalFirst = options?.axis === "vertical";
        points = getLShapeLinePoints(start, end, isVerticalFirst);
        break;
      }
    }
    const coloredPoints = filterGridPointsToBounds(
      points.map((p) => ({ ...p, color: p.color || color })),
      get().canvasBounds
    );
    get().setScratchLayer(coloredPoints);
  },

  commitScratch: () => {
    const { scratchLayer, canvasMode } = get();
    if (canvasMode === "structured") {
      set({ scratchLayer: null });
      return;
    }
    if (!scratchLayer || scratchLayer.size === 0) return;
    runCanvasTransaction(() => {
      GridManager.iterate(scratchLayer, (cell, x, y) => {
        const key = GridManager.toKey(x, y);
        if (cell.bgColor && cell.char === " ") {
          const existingCell = yMainGrid.get(key);
          yMainGrid.set(key, {
            ...(existingCell ?? { char: " ", color: cell.color }),
            bgColor: cell.bgColor,
          });
          return;
        }
        if (cell.bgColor || cell.attrs || cell.href) {
          yMainGrid.set(key, {
            char: cell.char,
            color: cell.color,
            ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
            ...(cell.attrs ? { attrs: cell.attrs } : {}),
            ...(cell.href ? { href: cell.href } : {}),
          });
          return;
        }
        placeCharInYMap(yMainGrid, x, y, cell.char, cell.color);
      });
    });
    set({ scratchLayer: null });
  },

  clearScratch: () => set({ scratchLayer: null }),
  clearCanvas: () => {
    const { canvasMode, applyStructuredScene } = get();
    if (canvasMode === "structured") {
      applyStructuredScene([], true);
      set({ scratchLayer: null, selections: [], textCursor: null, editingStructuredTextNodeId: null, structuredTextSelection: null, selectedStructuredNodeIds: [], selectedStructuredBoxId: null, selectedStructuredSplitHandle: null, structuredContextPoint: null });
      return;
    }
    runCanvasTransaction(() => yMainGrid.clear());
    set({ scratchLayer: null, selections: [], textCursor: null, editingStructuredTextNodeId: null, structuredTextSelection: null, selectedStructuredNodeIds: [], selectedStructuredBoxId: null, selectedStructuredSplitHandle: null, structuredContextPoint: null });
  },

  erasePoints: (points, shouldSaveHistory = true) => {
    const { canvasMode, canvasBounds } = get();
    if (canvasMode === "structured") return;
    const boundedPoints = filterPointsToBounds(points, canvasBounds);
    if (boundedPoints.length === 0) return;
    runCanvasTransaction(() => {
      boundedPoints.forEach((p) => {
        deleteCellAt(yMainGrid, p.x, p.y);
      });
    }, shouldSaveHistory);
  },

  commitStructuredShape: (tool, start, end, options) => {
    const state = get();
    if (state.canvasMode !== "structured") return;
    if (tool !== "box" && tool !== "splitBox" && tool !== "line" && tool !== "bg") return;

    const axis =
      options?.axis ??
      (Math.abs(end.y - start.y) > Math.abs(end.x - start.x)
        ? "vertical"
        : "horizontal");

    const node: StructuredNode =
      tool === "box"
        ? {
            id: createStructuredNodeId(),
            type: "box",
            order: state.getNextStructuredOrder(),
            start: { ...start },
            end: { ...end },
            style: { color: state.brushColor },
          }
        : tool === "splitBox"
          ? {
              id: createStructuredNodeId(),
              type: "splitBox",
              order: state.getNextStructuredOrder(),
              start: { ...start },
              end: { ...end },
              verticalSplitRatio: 0.36,
              topSplitRatio: 0.25,
              bottomSplitRatio: 0.75,
              root: createDefaultSplitBoxRoot({
                verticalSplitRatio: 0.36,
                topSplitRatio: 0.25,
                bottomSplitRatio: 0.75,
              }),
              style: { color: state.brushColor },
            }
        : tool === "bg"
          ? {
              id: createStructuredNodeId(),
              type: "bg",
              order: state.getNextStructuredOrder(),
              start: { ...start },
              end: { ...end },
              style: { color: COLOR_PRIMARY_TEXT, bgColor: state.brushColor },
            }
        : {
            id: createStructuredNodeId(),
            type: "line",
            order: state.getNextStructuredOrder(),
            start: { ...start },
            end: { ...end },
            axis,
            style: { color: state.brushColor },
          };

    state.applyStructuredScene([...state.structuredScene, node], true);
    set({
      scratchLayer: null,
      selectedStructuredNodeIds: [node.id],
      selectedStructuredBoxId: node.type === "box" ? node.id : null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      structuredGridFocus: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
    });
  },
  setSelectedStructuredNodeIds: (ids) =>
    set((state) => {
      const validIds = ids.filter((id, index) =>
        ids.indexOf(id) === index && state.structuredScene.some((node) => node.id === id)
      );
      const selectedBox =
        validIds.length === 1
          ? state.structuredScene.find((node) => node.id === validIds[0] && node.type === "box")
          : null;
      const keepsEditing =
        !!state.editingStructuredTextNodeId &&
        validIds.includes(state.editingStructuredTextNodeId);
      return {
        selectedStructuredNodeIds: validIds,
        selectedStructuredBoxId: selectedBox?.id ?? null,
        selectedStructuredSplitHandle: null,
        structuredGridFocus: validIds.length > 0 ? null : state.structuredGridFocus,
        editingStructuredTextNodeId: keepsEditing
          ? state.editingStructuredTextNodeId
          : null,
        structuredTextSelection: keepsEditing
          ? state.structuredTextSelection
          : null,
        textCursor: keepsEditing ? state.textCursor : null,
      };
    }),
  setSelectedStructuredBoxId: (id) =>
    set((state) => {
      if (!id) return { selectedStructuredNodeIds: [], selectedStructuredBoxId: null, selectedStructuredSplitHandle: null, structuredContextPoint: null, editingStructuredTextNodeId: null, structuredTextSelection: null };
      const selectedBox = state.structuredScene.find((node) => node.id === id && node.type === "box");
      if (!selectedBox) return { selectedStructuredNodeIds: [], selectedStructuredBoxId: null, selectedStructuredSplitHandle: null, structuredContextPoint: null, editingStructuredTextNodeId: null, structuredTextSelection: null };
      return { selectedStructuredNodeIds: [id], selectedStructuredBoxId: id, selectedStructuredSplitHandle: null, structuredContextPoint: null, structuredGridFocus: null, editingStructuredTextNodeId: null, structuredTextSelection: null };
    }),
  setSelectedStructuredSplitHandle: (handle) =>
    set((state) => {
      if (!handle) return { selectedStructuredSplitHandle: null };
      const node = state.structuredScene.find(
        (sceneNode) => sceneNode.id === handle.nodeId && sceneNode.type === "splitBox"
      );
      if (!node) return { selectedStructuredSplitHandle: null };
      return {
        selectedStructuredSplitHandle: handle,
        selectedStructuredNodeIds: [handle.nodeId],
        selectedStructuredBoxId: null,
        structuredGridFocus: null,
        editingStructuredTextNodeId: null,
        structuredTextSelection: null,
      };
    }),

  splitStructuredSplitBoxLeaf: (nodeId, point, axis) => {
    const state = get();
    if (state.canvasMode !== "structured") return false;
    const target = state.structuredScene.find(
      (node) => node.id === nodeId && node.type === "splitBox"
    );
    if (!target || target.type !== "splitBox") return false;
    const leaf = getStructuredSplitBoxLeafAtPoint(target, point);
    if (!leaf || !canSplitStructuredSplitBoxLeaf(leaf, axis)) return false;

    const nextScene = state.structuredScene.map((node) =>
      node.id === nodeId && node.type === "splitBox"
        ? addStructuredSplitBoxSplit(node, leaf.id, axis)
        : node
    );
    state.applyStructuredScene(nextScene, true);
    set({
      selectedStructuredNodeIds: [nodeId],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredGridFocus: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      textCursor: null,
    });
    return true;
  },

  updateStructuredNode: (id, updater, history = "save") => {
    const state = get();
    if (state.canvasMode !== "structured") return;
    let selectedBoxId: string | null = null;
    let didUpdate = false;
    const nextScene = state.structuredScene.map((node) => {
      if (node.id !== id) return node;
      const updatedNode = updater(node);
      didUpdate = true;
      selectedBoxId = updatedNode.type === "box" ? id : null;
      return updatedNode;
    });
    if (!didUpdate) return;
    state.applyStructuredScene(nextScene, history);
    set({
      selectedStructuredNodeIds: [id],
      selectedStructuredBoxId: selectedBoxId,
      selectedStructuredSplitHandle: null,
      structuredGridFocus: null,
    });
  },

  updateStructuredBox: (id, updater) => {
    get().updateStructuredNode(id, (node) => {
      if (node.type !== "box") return node;
      return updater(node as StructuredBoxNode);
    });
  },

  setStructuredTextAttributes: (attrs) => {
    const state = get();
    if (state.canvasMode !== "structured" || !state.structuredTextSelection) return;
    const range = getStructuredTextSelectionRange(state.structuredTextSelection);
    if (!range) return;
    const targetId = state.structuredTextSelection.nodeId;

    const nextScene = state.structuredScene.map((node) => {
      if (node.id !== targetId || node.type !== "text") return node;
      return {
        ...node,
        styleRanges: updateStructuredTextStyleRanges(
          node.styleRanges,
          range.start,
          range.end,
          (style) => {
            const nextAttrs = cloneTextAttributes(style.attrs) ?? {};
            Object.entries(attrs).forEach(([name, enabled]) => {
              const attrName = name as "bold" | "italic" | "underline" | "strike";
              if (enabled) {
                nextAttrs[attrName] = true;
              } else {
                delete nextAttrs[attrName];
              }
            });
            const normalizedAttrs = cloneTextAttributes(nextAttrs);
            return {
              ...style,
              ...(normalizedAttrs ? { attrs: normalizedAttrs } : { attrs: undefined }),
            };
          }
        ),
      };
    });

    state.applyStructuredScene(nextScene, true);
  },

  setStructuredTextColor: (color) => {
    const state = get();
    if (state.canvasMode !== "structured" || !state.structuredTextSelection) return;
    const range = getStructuredTextSelectionRange(state.structuredTextSelection);
    if (!range) return;
    const targetId = state.structuredTextSelection.nodeId;

    const nextScene = state.structuredScene.map((node) => {
      if (node.id !== targetId || node.type !== "text") return node;
      return {
        ...node,
        styleRanges: updateStructuredTextStyleRanges(
          node.styleRanges,
          range.start,
          range.end,
          (style) => ({
            ...style,
            color,
          })
        ),
      };
    });

    state.applyStructuredScene(nextScene, true);
  },

  setStructuredTextBackgroundColor: (bgColor) => {
    const state = get();
    if (state.canvasMode !== "structured" || !state.structuredTextSelection) return;
    const range = getStructuredTextSelectionRange(state.structuredTextSelection);
    if (!range) return;
    const targetId = state.structuredTextSelection.nodeId;

    const nextScene = state.structuredScene.map((node) => {
      if (node.id !== targetId || node.type !== "text") return node;
      return {
        ...node,
        styleRanges: updateStructuredTextStyleRanges(
          node.styleRanges,
          range.start,
          range.end,
          (style) => ({
            ...style,
            ...(bgColor ? { bgColor } : { bgColor: undefined }),
          })
        ),
      };
    });

    state.applyStructuredScene(nextScene, true);
  },

  setStructuredNodeCharColor: (color) => {
    const state = get();
    if (state.canvasMode !== "structured" || state.selectedStructuredNodeIds.length === 0) {
      return;
    }
    const selectedIds = new Set(state.selectedStructuredNodeIds);
    let didUpdate = false;
    const nextScene = state.structuredScene.map((node) => {
      if (!selectedIds.has(node.id)) return node;
      if (node.type !== "box" && node.type !== "splitBox" && node.type !== "line") {
        return node;
      }
      didUpdate = true;
      return {
        ...node,
        style: {
          ...node.style,
          color,
        },
      };
    });

    if (!didUpdate) return;
    state.applyStructuredScene(nextScene, true);
    state.setSelectedStructuredNodeIds(state.selectedStructuredNodeIds);
  },

  fillStructuredTextSelectionWithChar: (char) => {
    const state = get();
    if (state.canvasMode !== "structured" || !state.structuredTextSelection) return;
    const range = getStructuredTextSelectionRange(state.structuredTextSelection);
    if (!range) return;
    const fillChar = splitGraphemes(char)[0] ?? char[0] ?? "";
    if (!fillChar) return;
    const targetId = state.structuredTextSelection.nodeId;

    const nextScene = state.structuredScene.map((node) => {
      if (node.id !== targetId || node.type !== "text") return node;
      const chars = splitGraphemes(node.text);
      const fillLength = range.end - range.start;
      chars.splice(range.start, fillLength, ...Array(fillLength).fill(fillChar));
      return {
        ...node,
        text: chars.join(""),
      };
    });

    state.applyStructuredScene(nextScene, true);
  },

  reorderStructuredSelection: (direction) => {
    const state = get();
    if (state.canvasMode !== "structured") return;
    if (state.selectedStructuredNodeIds.length === 0) return;
    const nextScene = reorderStructuredNodes(
      state.structuredScene,
      state.selectedStructuredNodeIds,
      direction
    );
    state.applyStructuredScene(nextScene, true);
    state.setSelectedStructuredNodeIds(state.selectedStructuredNodeIds);
  },

  duplicateStructuredSelection: () => {
    const state = get();
    if (state.canvasMode !== "structured") return [];
    if (state.selectedStructuredNodeIds.length === 0) return [];
    const { scene, duplicatedIds } = duplicateStructuredNodes(
      state.structuredScene,
      state.selectedStructuredNodeIds
    );
    if (duplicatedIds.length === 0) return [];
    state.applyStructuredScene(scene, true);
    state.setSelectedStructuredNodeIds(duplicatedIds);
    return duplicatedIds;
  },
});

