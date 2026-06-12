import {
  undoManager,
  yMainGrid,
  yStructuredScene,
  transactWithHistory,
} from "@/shared/lib/yjs-setup";
import type { GridCell, StructuredNode } from "@/shared/types";
import { normalizeScene, sceneToGridEntries } from "@/shared/utils/structured";
import {
  cloneStructuredNode,
  normalizeAndCloneScene,
  isSameCell,
} from "./snapshotHelpers";

export const rebuildGridFromYMap = () => {
  const nextGrid = new Map<string, GridCell>();
  yMainGrid.forEach((value, key) => {
    nextGrid.set(key, value as GridCell);
  });
  return nextGrid;
};

export const rebuildSceneFromYMap = () => {
  const nextScene: StructuredNode[] = [];
  yStructuredScene.forEach((value) => {
    nextScene.push(cloneStructuredNode(value as StructuredNode));
  });
  return normalizeScene(nextScene);
};

export const patchGridByChangedKeys = (
  currentGrid: Map<string, GridCell>,
  keysChanged: Set<string>
) => {
  let nextGrid: Map<string, GridCell> | null = null;

  keysChanged.forEach((key) => {
    const nextCell = yMainGrid.get(key) as GridCell | undefined;
    const prevCell = currentGrid.get(key);

    if (!nextCell) {
      if (!prevCell) return;
      if (!nextGrid) nextGrid = new Map(currentGrid);
      nextGrid.delete(key);
      return;
    }

    if (isSameCell(prevCell, nextCell)) return;
    if (!nextGrid) nextGrid = new Map(currentGrid);
    nextGrid.set(key, nextCell);
  });

  return nextGrid;
};

export const applyFreeformSnapshotToYMaps = (
  entries: [string, GridCell][]
) => {
  transactWithHistory(() => {
    yStructuredScene.clear();
    yMainGrid.clear();
    entries.forEach(([key, val]) => yMainGrid.set(key, val));
  }, false);
  undoManager.clear();
};

export const applyStructuredSnapshotToYMaps = (scene: StructuredNode[]) => {
  const normalizedScene = normalizeAndCloneScene(scene);
  const gridEntries = sceneToGridEntries(normalizedScene);
  transactWithHistory(() => {
    yStructuredScene.clear();
    normalizedScene.forEach((node) => {
      yStructuredScene.set(node.id, node);
    });
    yMainGrid.clear();
    gridEntries.forEach(([key, val]) => yMainGrid.set(key, val));
  }, false);
  undoManager.clear();
};
