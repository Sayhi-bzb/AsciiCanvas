import type { StoreApi } from "zustand";
import { collaborationRuntime } from "@/domains/collaboration/public";
import type { CanvasSession } from "@/domains/sessions/public";
import {
  getStructuredTextCaretPoint,
  getStructuredTextOffsetAtPoint,
  normalizeStructuredComponents,
  normalizeStructuredTextSelection,
  sceneToGridEntries,
  type StructuredNode,
} from "@/domains/structured-content/public";
import { updateSlideGrid } from "@/domains/slides/public";
import { splitGraphemes } from "@/shared/metrics";
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
  observeActiveComponents,
  observeActiveGrid,
  observeActiveScene,
  setActiveCanvasIntegrityIssue,
  yMainGrid,
  yStructuredComponents,
  yStructuredScene,
} from "./canvasDocument";

const reconcileStructuredInteraction = (
  state: EditorState,
  structuredScene: StructuredNode[]
) => {
  const byId = new Map(structuredScene.map((node) => [node.id, node]));
  const selectedStructuredNodeIds = state.selectedStructuredNodeIds.filter((id) => byId.has(id));
  const selectedBox = state.selectedStructuredBoxId
    ? byId.get(state.selectedStructuredBoxId)
    : null;
  const selectedSplit = state.selectedStructuredSplitHandle
    ? byId.get(state.selectedStructuredSplitHandle.nodeId)
    : null;
  const editingNode = state.editingStructuredTextNodeId
    ? byId.get(state.editingStructuredTextNodeId)
    : null;

  const structuredTextSelection =
    state.structuredTextSelection && byId.get(state.structuredTextSelection.nodeId)?.type === "text"
      ? normalizeStructuredTextSelection(
          state.structuredTextSelection,
          splitGraphemes(
            (
              byId.get(state.structuredTextSelection.nodeId) as Extract<
                StructuredNode,
                { type: "text" }
              >
            ).text
          ).length
        )
      : null;

  let textCursor = state.textCursor;
  if (state.editingStructuredTextNodeId && editingNode?.type !== "text") {
    textCursor = null;
  } else if (
    editingNode?.type === "text" &&
    state.textCursor &&
    state.editingStructuredTextNodeId
  ) {
    const previousNode = state.structuredScene.find(
      (node) => node.id === state.editingStructuredTextNodeId && node.type === "text"
    );
    if (previousNode?.type === "text") {
      const offset = Math.min(
        getStructuredTextOffsetAtPoint(previousNode, state.textCursor),
        splitGraphemes(editingNode.text).length
      );
      textCursor = getStructuredTextCaretPoint(editingNode, offset);
    }
  }

  return {
    selectedStructuredNodeIds,
    selectedStructuredBoxId: selectedBox?.type === "box" ? selectedBox.id : null,
    selectedStructuredSplitHandle:
      selectedSplit?.type === "splitBox" ? state.selectedStructuredSplitHandle : null,
    structuredContextPoint:
      selectedStructuredNodeIds.length === 1 ? state.structuredContextPoint : null,
    editingStructuredTextNodeId: editingNode?.type === "text" ? editingNode.id : null,
    structuredTextSelection,
    textCursor,
  };
};

const projectObservedGrid = (state: EditorState, grid: GridMap) => {
  if (state.canvasMode === "slide" && state.slideDeck) {
    const slideDeck = updateSlideGrid(
      state.slideDeck,
      state.slideDeck.activeSlideId,
      Array.from(grid.entries())
    );
    const activeSlide = slideDeck.slides.find((slide) => slide.id === slideDeck.activeSlideId);
    return {
      grid: createMapFromEntries(activeSlide?.grid ?? []),
      slideDeck,
      canvasSessions: state.canvasSessions.map((session): CanvasSession =>
        session.id === state.activeCanvasId && session.mode === "slide"
          ? { ...session, slideDeck }
          : session
      ),
    };
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
export const subscribeRemoteCanvasDocumentProjection = (
  setState: StoreApi<EditorState>["setState"],
  getState: StoreApi<EditorState>["getState"]
) => {
  const reportIntegrityIssues = () =>
    collaborationRuntime.reportIntegrityIssues(getActiveCanvasIntegrityIssues());

  const unsubscribeGrid = observeActiveGrid((event) => {
    if (getState().canvasMode === "structured") return;
    const currentGrid = getState().grid;
    const patchedGrid = patchGridByChangedKeys(currentGrid, event.keysChanged);
    if (patchedGrid) {
      setState((state) => projectObservedGrid(state, patchedGrid));
      reportIntegrityIssues();
      return;
    }
    if (event.keysChanged.size === 0 && yMainGrid.size !== currentGrid.size) {
      setState((state) => projectObservedGrid(state, rebuildGridFromYMap()));
    }
    reportIntegrityIssues();
  });

  const unsubscribeScene = observeActiveScene((event) => {
    event.keysChanged.forEach((key) => {
      if (!yStructuredScene.has(key)) {
        setActiveCanvasIntegrityIssue("structured-scene", key, null);
      }
    });
    setState((state) => {
      if (state.canvasMode !== "structured") return state;
      const structuredScene = rebuildSceneFromYMap();
      const gridEntries = sceneToGridEntries(structuredScene);
      return {
        structuredScene,
        grid: createMapFromEntries(gridEntries),
        ...reconcileStructuredInteraction(state, structuredScene),
        structuredComponents: normalizeStructuredComponents(
          state.structuredComponents,
          structuredScene
        ),
        canvasSessions: state.canvasSessions.map((session) =>
          session.id === state.activeCanvasId && session.mode !== "slide"
            ? { ...session, scene: structuredScene, grid: gridEntries }
            : session
        ),
      };
    });
    reportIntegrityIssues();
  });

  const unsubscribeComponents = observeActiveComponents((event) => {
    event.keysChanged.forEach((key) => {
      if (!yStructuredComponents.has(key)) {
        setActiveCanvasIntegrityIssue("structured-components", key, null);
      }
    });
    setState((state) => {
      if (state.canvasMode !== "structured") return state;
      const structuredComponents = Array.from(yStructuredComponents.entries()).flatMap(
        ([key, value]) => {
          const decoded = decodeCollaborativeStructuredComponent(key, value);
          setActiveCanvasIntegrityIssue(
            "structured-components",
            key,
            decoded.ok ? null : decoded.issue
          );
          return decoded.ok ? [decoded.value] : [];
        }
      );
      return {
        structuredComponents,
        canvasSessions: state.canvasSessions.map((session) =>
          session.id === state.activeCanvasId && session.mode !== "slide"
            ? { ...session, components: structuredComponents }
            : session
        ),
      };
    });
    reportIntegrityIssues();
  });

  return () => {
    unsubscribeGrid();
    unsubscribeScene();
    unsubscribeComponents();
  };
};
