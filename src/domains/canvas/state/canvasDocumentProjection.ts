import type { StoreApi } from "zustand";
import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import {
  normalizeStructuredComponents,
  sceneToGridEntries,
} from "@/domains/structured-content/public";
import type { GridMap } from "@/shared/types";
import { decodeCollaborativeStructuredComponent } from "./collaborationSchema";
import {
  rebuildGridFromContent,
  rebuildSceneFromYMap,
} from "./helpers/gridHelpers";
import { createMapFromEntries } from "./helpers/snapshotHelpers";
import type { EditorState } from "./interfaces";
import type { CanvasDocumentRegistry } from "./CanvasDocumentRegistry";
import { projectSlideEditingBuffer } from "./slideEditingBuffer";
import { reconcileStructuredInteraction } from "./transitions/editorTransitions";

const projectObservedGrid = (state: EditorState, grid: GridMap) => {
  if (state.canvasMode === "slide" && state.slideDeck) {
    return projectSlideEditingBuffer(state, grid) ?? { grid };
  }
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
      setState((current) =>
        projectObservedGrid(current, rebuildGridFromContent(documents))
      );
      reportCurrentIntegrityIssues();
      return;
    }
    if (!transaction.sceneChanged && !transaction.componentsChanged) return;
    setState((current) => {
      const structuredScene = rebuildSceneFromYMap(documents);
      const structuredComponents = normalizeStructuredComponents(
        Array.from(documents.yStructuredComponents.entries()).flatMap(
          ([key, value]) => {
            const decoded = decodeCollaborativeStructuredComponent(key, value);
            documents.setIntegrityIssue(
              "structured-components",
              key,
              decoded.ok ? null : decoded.issue
            );
            return decoded.ok ? [decoded.value] : [];
          }
        ),
        structuredScene
      );
      const gridEntries = sceneToGridEntries(structuredScene);
      return {
        structuredScene,
        structuredComponents,
        grid: createMapFromEntries(gridEntries),
        ...reconcileStructuredInteraction(current, structuredScene),
      };
    });
    reportCurrentIntegrityIssues();
  });

  return unsubscribe;
};
