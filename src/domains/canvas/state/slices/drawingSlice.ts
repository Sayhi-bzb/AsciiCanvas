import type { StateCreator } from "zustand";
import type { CanvasState, DrawingSlice } from "../interfaces";
import { transactWithHistory, yMainGrid } from "@/shared/lib/yjs-setup";
import { GridManager } from "@/shared/utils/grid";
import type { GridPoint, StructuredBoxNode, StructuredNode } from "@/shared/types";
import { placeCharInMap, placeCharInYMap } from "../utils";
import { deleteCellAt } from "../gridOps";
import {
  getBoxPoints,
  getCirclePoints,
  getLShapeLinePoints,
  getStepLinePoints,
} from "@/shared/utils/shapes";
import { createStructuredNodeId } from "@/shared/utils/structured";
import {
  duplicateStructuredNodes,
  reorderStructuredNodes,
} from "../helpers/structuredNodeActions";
import { filterGridPointsToBounds, filterPointsToBounds } from "../helpers/animationHelpers";

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
      placeCharInMap(layer, p.x, p.y, p.char, p.color || brushColor);
    });
    set({ scratchLayer: layer });
  },

  addScratchPoints: (points) => {
    const { brushColor, canvasBounds } = get();
    set((state) => {
      const layer = new Map(state.scratchLayer || []);
      filterGridPointsToBounds(points, canvasBounds).forEach((p) => {
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
      points.map((p) => ({ ...p, color })),
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
    transactWithHistory(() => {
      GridManager.iterate(scratchLayer, (cell, x, y) => {
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
      set({ scratchLayer: null, selections: [], textCursor: null, selectedStructuredNodeIds: [], selectedStructuredBoxId: null });
      return;
    }
    transactWithHistory(() => yMainGrid.clear());
    set({ scratchLayer: null, selections: [], textCursor: null, selectedStructuredNodeIds: [], selectedStructuredBoxId: null });
  },

  erasePoints: (points, shouldSaveHistory = true) => {
    const { canvasMode, canvasBounds } = get();
    if (canvasMode === "structured") return;
    const boundedPoints = filterPointsToBounds(points, canvasBounds);
    if (boundedPoints.length === 0) return;
    transactWithHistory(() => {
      boundedPoints.forEach((p) => {
        deleteCellAt(yMainGrid, p.x, p.y);
      });
    }, shouldSaveHistory);
  },

  commitStructuredShape: (tool, start, end, options) => {
    const state = get();
    if (state.canvasMode !== "structured") return;
    if (tool !== "box" && tool !== "line") return;

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
      return {
        selectedStructuredNodeIds: validIds,
        selectedStructuredBoxId: selectedBox?.id ?? null,
      };
    }),
  setSelectedStructuredBoxId: (id) =>
    set((state) => {
      if (!id) return { selectedStructuredNodeIds: [], selectedStructuredBoxId: null };
      const selectedBox = state.structuredScene.find((node) => node.id === id && node.type === "box");
      if (!selectedBox) return { selectedStructuredNodeIds: [], selectedStructuredBoxId: null };
      return { selectedStructuredNodeIds: [id], selectedStructuredBoxId: id };
    }),

  updateStructuredNode: (id, updater) => {
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
    state.applyStructuredScene(nextScene, true);
    set({
      selectedStructuredNodeIds: [id],
      selectedStructuredBoxId: selectedBoxId,
    });
  },

  updateStructuredBox: (id, updater) => {
    get().updateStructuredNode(id, (node) => {
      if (node.type !== "box") return node;
      return updater(node as StructuredBoxNode);
    });
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

