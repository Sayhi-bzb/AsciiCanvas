import type { StoreApi } from "zustand";
import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import {
  normalizeStructuredComponents,
} from "@/domains/structured-content/public";
import type { GridMap } from "@/shared/types";
import { decodeCollaborativeStructuredComponent } from "./collaborationSchema";
import {
  rebuildGridFromContent,
  rebuildSceneFromYMapChanges,
  updateStructuredGridProjection,
} from "./helpers/gridHelpers";
import type { EditorState } from "./interfaces";
import type { CanvasDocumentRegistry } from "./CanvasDocumentRegistry";
import { reconcileStructuredInteraction } from "./transitions/editorTransitions";

const projectObservedGrid = (grid: GridMap) => {
  return {
    grid,
  };
};

/** Projects active Yjs document changes into the editor's derived Zustand state. */
export const subscribeCanvasDocumentProjection = (
  documents: CanvasDocumentRegistry,
  reportIntegrityIssues: (issues: CollaborationIntegrityIssue[]) => void,
  setState: StoreApi<EditorState>["setState"],
  getState: StoreApi<EditorState>["getState"]
) => {
  const reportCurrentIntegrityIssues = () =>
    reportIntegrityIssues(documents.getIntegrityIssues());

  const unsubscribe = documents.observeActiveTransactions((transaction) => {
    const state = getState();
    if (state.canvasMode !== "structured") {
      if (!transaction.contentChanged) return;
      setState(projectObservedGrid(rebuildGridFromContent(documents)));
      reportCurrentIntegrityIssues();
      return;
    }
    if (!transaction.sceneChanged && !transaction.componentsChanged) return;
    setState((current) => {
      const structuredScene = transaction.sceneChanged
        ? rebuildSceneFromYMapChanges(
            documents,
            current.structuredScene,
            transaction.sceneChangedIds
          )
        : current.structuredScene;
      const componentSource = transaction.componentsChanged
        ? Array.from(documents.yStructuredComponents.entries()).flatMap(
            ([key, value]) => {
              const decoded = decodeCollaborativeStructuredComponent(key, value);
              documents.setIntegrityIssue(
                "structured-components",
                key,
                decoded.ok ? null : decoded.issue
              );
              return decoded.ok ? [decoded.value] : [];
            }
          )
        : current.structuredComponents;
      const structuredComponents = normalizeStructuredComponents(
        componentSource,
        structuredScene
      );
      return {
        structuredScene,
        structuredComponents,
        grid: transaction.sceneChanged
          ? updateStructuredGridProjection(
              current.grid,
              structuredScene,
              transaction.sceneChangedIds
            )
          : current.grid,
        ...reconcileStructuredInteraction(current, structuredScene),
      };
    });
    reportCurrentIntegrityIssues();
  });

  return unsubscribe;
};
