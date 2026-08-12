import type { StoreApi } from "zustand";
import { collaborationRuntime } from "@/domains/collaboration/public";
import type { CanvasSession } from "@/domains/sessions/public";
import {
  normalizeStructuredComponents,
  sceneToGridEntries,
} from "@/domains/structured-content/public";
import type { GridMap } from "@/shared/types";
import { decodeCollaborativeStructuredComponent } from "./collaborationSchema";
import {
  patchGridByChangedKeys,
  rebuildGridFromYMap,
  rebuildSceneFromYMap,
} from "./helpers/gridHelpers";
import { createMapFromEntries } from "./helpers/snapshotHelpers";
import type { EditorState } from "./interfaces";
import {
  getActiveCanvasIntegrityIssues,
  observeActiveCanvasTransactions,
  setActiveCanvasIntegrityIssue,
  yStructuredComponents,
} from "./canvasDocument";
import { projectSlideEditingBuffer } from "./slideEditingBuffer";
import { reconcileStructuredInteraction } from "./transitions/editorTransitions";

const projectObservedGrid = (state: EditorState, grid: GridMap) => {
  if (state.canvasMode === "slide" && state.slideDeck) {
    return projectSlideEditingBuffer(state, grid) ?? { grid };
  }
  return {
    grid,
    canvasSessions: state.canvasSessions.map((session): CanvasSession =>
      session.id === state.activeCanvasId && session.mode !== "slide"
        ? { ...session, grid: Array.from(grid.entries()) }
        : session
    ),
  };
};

/** Projects active Yjs document changes into the editor's derived Zustand state. */
export const subscribeCanvasDocumentProjection = (
  setState: StoreApi<EditorState>["setState"],
  getState: StoreApi<EditorState>["getState"]
) => {
  const reportIntegrityIssues = () =>
    collaborationRuntime.reportIntegrityIssues(getActiveCanvasIntegrityIssues());

  const unsubscribe = observeActiveCanvasTransactions((transaction) => {
    const state = getState();
    if (state.canvasMode !== "structured") {
      if (transaction.gridKeysChanged.size === 0) return;
      const patchedGrid = patchGridByChangedKeys(
        state.grid,
        transaction.gridKeysChanged
      );
      setState((current) =>
        projectObservedGrid(
          current,
          patchedGrid ?? rebuildGridFromYMap()
        )
      );
      reportIntegrityIssues();
      return;
    }
    if (!transaction.sceneChanged && !transaction.componentsChanged) return;
    setState((current) => {
      const structuredScene = rebuildSceneFromYMap();
      const structuredComponents = normalizeStructuredComponents(
        Array.from(yStructuredComponents.entries()).flatMap(
          ([key, value]) => {
            const decoded = decodeCollaborativeStructuredComponent(key, value);
            setActiveCanvasIntegrityIssue(
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
        canvasSessions: current.canvasSessions.map((session) =>
          session.id === current.activeCanvasId && session.mode !== "slide"
            ? {
                ...session,
                scene: structuredScene,
                components: structuredComponents,
                grid: gridEntries,
              }
            : session
        ),
      };
    });
    reportIntegrityIssues();
  });

  return unsubscribe;
};
