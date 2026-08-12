import {
  runCanvasTransaction,
  setActiveCanvasIntegrityIssue,
  yMainGrid,
  yStructuredScene,
} from "../yjs";
import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import { normalizeScene } from "@/domains/structured-content/public";
import {
  cloneStructuredNode,
  isSameCell,
} from "./snapshotHelpers";
import {
  decodeCollaborativeGridCell,
  decodeCollaborativeStructuredNode,
} from "../collaborationSchema";

export const rebuildGridFromYMap = () => {
  const nextGrid = new Map<string, GridCell>();
  yMainGrid.forEach((value, key) => {
    const decoded = decodeCollaborativeGridCell(key, value);
    setActiveCanvasIntegrityIssue("main-grid", key, decoded.ok ? null : decoded.issue);
    if (decoded.ok) nextGrid.set(key, decoded.value);
  });
  return nextGrid;
};

export const rebuildSceneFromYMap = () => {
  const nextScene: StructuredNode[] = [];
  yStructuredScene.forEach((value, key) => {
    const decoded = decodeCollaborativeStructuredNode(key, value);
    setActiveCanvasIntegrityIssue("structured-scene", key, decoded.ok ? null : decoded.issue);
    if (decoded.ok) nextScene.push(cloneStructuredNode(decoded.value));
  });
  return normalizeScene(nextScene);
};

export const patchGridByChangedKeys = (
  currentGrid: Map<string, GridCell>,
  keysChanged: Set<string>
): Map<string, GridCell> | null => {
  let nextGrid: Map<string, GridCell> | null = null;

  keysChanged.forEach((key) => {
    const rawCell = yMainGrid.get(key);
    const prevCell = currentGrid.get(key);

    if (!rawCell) {
      setActiveCanvasIntegrityIssue("main-grid", key, null);
      if (!prevCell) return;
      if (!nextGrid) nextGrid = new Map(currentGrid);
      nextGrid.delete(key);
      return;
    }

    const decoded = decodeCollaborativeGridCell(key, rawCell);
    setActiveCanvasIntegrityIssue("main-grid", key, decoded.ok ? null : decoded.issue);
    if (!decoded.ok) {
      if (!prevCell) return;
      if (!nextGrid) nextGrid = new Map(currentGrid);
      nextGrid.delete(key);
      return;
    }
    const nextCell = decoded.value;

    if (isSameCell(prevCell, nextCell)) return;
    if (!nextGrid) nextGrid = new Map(currentGrid);
    nextGrid.set(key, nextCell);
  });

  return nextGrid;
};

export const applyFreeformSnapshotToYMaps = (
  entries: [string, GridCell][]
) => {
  runCanvasTransaction(() => {
    yStructuredScene.clear();
    yMainGrid.clear();
    entries.forEach(([key, val]) => yMainGrid.set(key, val));
  }, "reset");
};
