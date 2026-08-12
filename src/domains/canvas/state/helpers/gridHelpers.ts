import type { CanvasDocumentRegistry } from "../CanvasDocumentRegistry";
import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import {
  cloneStructuredNode,
  normalizeScene,
} from "@/domains/structured-content/public";
import { isSameCell } from "./snapshotHelpers";
import {
  decodeCollaborativeGridCell,
  decodeCollaborativeStructuredNode,
} from "../collaborationSchema";

export const rebuildGridFromYMap = (documents: CanvasDocumentRegistry) => {
  const nextGrid = new Map<string, GridCell>();
  documents.yMainGrid.forEach((value, key) => {
    const decoded = decodeCollaborativeGridCell(key, value);
    documents.setIntegrityIssue("main-grid", key, decoded.ok ? null : decoded.issue);
    if (decoded.ok) nextGrid.set(key, decoded.value);
  });
  return nextGrid;
};

export const rebuildSceneFromYMap = (documents: CanvasDocumentRegistry) => {
  const nextScene: StructuredNode[] = [];
  documents.yStructuredScene.forEach((value, key) => {
    const decoded = decodeCollaborativeStructuredNode(key, value);
    documents.setIntegrityIssue("structured-scene", key, decoded.ok ? null : decoded.issue);
    if (decoded.ok) nextScene.push(cloneStructuredNode(decoded.value));
  });
  return normalizeScene(nextScene);
};

export const patchGridByChangedKeys = (
  documents: CanvasDocumentRegistry,
  currentGrid: Map<string, GridCell>,
  keysChanged: Set<string>
): Map<string, GridCell> | null => {
  let nextGrid: Map<string, GridCell> | null = null;

  keysChanged.forEach((key) => {
    const rawCell = documents.yMainGrid.get(key);
    const prevCell = currentGrid.get(key);

    if (!rawCell) {
      documents.setIntegrityIssue("main-grid", key, null);
      if (!prevCell) return;
      if (!nextGrid) nextGrid = new Map(currentGrid);
      nextGrid.delete(key);
      return;
    }

    const decoded = decodeCollaborativeGridCell(key, rawCell);
    documents.setIntegrityIssue("main-grid", key, decoded.ok ? null : decoded.issue);
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
  documents: CanvasDocumentRegistry,
  entries: [string, GridCell][]
) => documents.replaceFreeformGrid(entries);
