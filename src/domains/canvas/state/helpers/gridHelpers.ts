import type { CanvasDocumentRegistry } from "../CanvasDocumentRegistry";
import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import {
  cloneStructuredNode,
  normalizeScene,
} from "@/domains/structured-content/public";
import {
  decodeCollaborativeStructuredNode,
} from "../collaborationSchema";

export const rebuildGridFromContent = (documents: CanvasDocumentRegistry) =>
  documents.getContentReader().materialize();

export const rebuildSceneFromYMap = (documents: CanvasDocumentRegistry) => {
  const nextScene: StructuredNode[] = [];
  documents.yStructuredScene.forEach((value, key) => {
    const decoded = decodeCollaborativeStructuredNode(key, value);
    documents.setIntegrityIssue("structured-scene", key, decoded.ok ? null : decoded.issue);
    if (decoded.ok) nextScene.push(cloneStructuredNode(decoded.value));
  });
  return normalizeScene(nextScene);
};

export const applyFreeformSnapshotToYMaps = (
  documents: CanvasDocumentRegistry,
  entries: [string, GridCell][]
) => documents.replaceFreeformGrid(entries);
