import {
  EDITOR_PERSISTENCE_VERSION,
  withActiveCanvasSnapshot,
  type CanvasSession,
} from "@/domains/sessions/public";
import {
  buildStructuredTemplate,
  normalizeStructuredComponents,
} from "@/domains/structured-content/public";
import { COLOR_PRIMARY_TEXT, DEFAULT_BRUSH_CHAR } from "@/shared/lib/constants";
import { normalizeBrushChar } from "@/shared/utils/characters";
import { DEFAULT_DEMO_GRID } from "./helpers/defaultDemo";
import {
  cloneScene,
  createMapFromEntries,
} from "./helpers/snapshotHelpers";
import {
  buildSessionSnapshot,
  DEFAULT_MODE,
  DEFAULT_SESSION_ID,
  DEFAULT_SESSION_NAME,
  DEFAULT_STRUCTURED_SESSION_ID,
  DEFAULT_STRUCTURED_SESSION_NAME,
  getSessionCanvasDocumentId,
  resolveSessionRuntime,
  stripSessionContent,
  stripSlideDeckContent,
} from "./helpers/storeUtils";
import type { EditorState } from "./interfaces";
import type { CanvasDocumentRegistry } from "./CanvasDocumentRegistry";
import { createStructuredGridProjection } from "./helpers/gridHelpers";

const DEFAULT_STRUCTURED_SAFARI_TEMPLATE = buildStructuredTemplate(
  "safari",
  { x: 4, y: 2 },
  { brushColor: COLOR_PRIMARY_TEXT, startOrder: 1 }
);
export const createDefaultCanvasSessions = (): CanvasSession[] => [
  {
    id: DEFAULT_SESSION_ID,
    name: DEFAULT_SESSION_NAME,
    mode: DEFAULT_MODE,
    scene: [],
    grid: DEFAULT_DEMO_GRID,
  },
  {
    id: DEFAULT_STRUCTURED_SESSION_ID,
    name: DEFAULT_STRUCTURED_SESSION_NAME,
    mode: "structured",
    scene: DEFAULT_STRUCTURED_SAFARI_TEMPLATE.nodes,
    components: DEFAULT_STRUCTURED_SAFARI_TEMPLATE.components,
    grid: [],
  },
];

export const recoverPersistedEditorState = (
  hydratedState: EditorState
): EditorState => {
  const state = { ...hydratedState };
  state.brushChar = normalizeBrushChar(state.brushChar, DEFAULT_BRUSH_CHAR);
  state.brushColor =
    typeof state.brushColor === "string" ? state.brushColor : COLOR_PRIMARY_TEXT;
  state.brushBackgroundColor =
    typeof state.brushBackgroundColor === "string"
      ? state.brushBackgroundColor
      : state.brushColor;
  state.showGrid = typeof state.showGrid === "boolean" ? state.showGrid : false;
  state.exportShowGrid =
    typeof state.exportShowGrid === "boolean" ? state.exportShowGrid : false;
  state.collaborationEndpoint =
    typeof state.collaborationEndpoint === "string" ? state.collaborationEndpoint : "";

  const sessions =
    state.canvasSessions.length > 0
      ? state.canvasSessions
      : createDefaultCanvasSessions();

  const activeCanvasId =
    typeof state.activeCanvasId === "string" &&
    sessions.some((session) => session.id === state.activeCanvasId)
      ? state.activeCanvasId
      : sessions[0].id;
  const activeSession =
    sessions.find((session) => session.id === activeCanvasId) ?? sessions[0];
  const runtime = resolveSessionRuntime(activeSession, state.tool || "select");

  state.canvasSessions = sessions.map(stripSessionContent);
  state.activeCanvasId = activeCanvasId;
  state.canvasMode = runtime.nextMode;
  state.slideDeck = runtime.nextSlideDeck
    ? stripSlideDeckContent(runtime.nextSlideDeck)
    : null;
  state.structuredScene = runtime.nextScene;
  state.structuredComponents = runtime.nextComponents;
  state.selectedStructuredNodeIds = [];
  state.selectedStructuredBoxId = null;
  state.selectedStructuredSplitHandle = null;
  state.structuredContextPoint = null;
  state.grid = runtime.nextMode === "structured"
    ? createStructuredGridProjection(runtime.nextScene)
    : createMapFromEntries(runtime.nextGridEntries);
  state.tool = runtime.nextTool;
  state.offset = runtime.nextOffset;
  state.zoom = runtime.nextZoom;
  return state;
};

export const syncHydratedStateToCanvasDocument = (
  documents: CanvasDocumentRegistry,
  hydratedState: EditorState
) => {
  const activeSession = hydratedState.canvasSessions.find(
    (session) => session.id === hydratedState.activeCanvasId
  );
  if (!activeSession) return;
  if (activeSession.mode !== "slide" && activeSession.collaboration) {
    documents.initializeCollaborativeDocument(activeSession.id, {
      mode: activeSession.mode,
      grid: [],
      scene: [],
      components: [],
    });
    return;
  }
  documents.activateDocument(
    getSessionCanvasDocumentId(activeSession),
    {
      grid:
        hydratedState.canvasMode === "structured"
          ? []
          : Array.from(hydratedState.grid.entries()),
      scene:
        hydratedState.canvasMode === "structured" ? hydratedState.structuredScene : [],
      components: hydratedState.structuredComponents,
    },
    { replace: true }
  );
};

const stripCollaborativeSessionContent = (session: CanvasSession): CanvasSession =>
  session.mode !== "slide" && session.collaboration
    ? { ...session, grid: [], scene: [], components: [] }
    : session;

export const createPersistedEditorSnapshot = (state: EditorState) => {
  const activeSession = state.canvasSessions.find(
    (session) => session.id === state.activeCanvasId
  );
  const activeIsCollaborative =
    activeSession?.mode !== "slide" && !!activeSession?.collaboration;
  const persistedSessions = withActiveCanvasSnapshot(
    state.canvasSessions,
    state.activeCanvasId,
    buildSessionSnapshot(state)
  ).map(stripCollaborativeSessionContent);
  return {
    schemaVersion: EDITOR_PERSISTENCE_VERSION,
    workspace: {
      offset: state.offset,
      zoom: state.zoom,
      canvasMode: state.canvasMode,
      structuredScene: activeIsCollaborative ? [] : cloneScene(state.structuredScene),
      structuredComponents: activeIsCollaborative
        ? []
        : normalizeStructuredComponents(state.structuredComponents, state.structuredScene),
      grid: activeIsCollaborative
        ? []
        : state.canvasMode === "structured"
          ? []
          : Array.from(state.grid.entries()),
    },
    sessions: { items: persistedSessions, activeId: state.activeCanvasId },
    preferences: {
      brushChar: state.brushChar,
      brushColor: state.brushColor,
      brushBackgroundColor: state.brushBackgroundColor,
      showGrid: state.showGrid,
      exportShowGrid: state.exportShowGrid,
      collaborationEndpoint: state.collaborationEndpoint,
    },
  };
};

export const shouldScheduleEditorPersistence = (
  previous: EditorState | null,
  next: EditorState
): boolean =>
  !previous ||
  previous.offset !== next.offset ||
  previous.zoom !== next.zoom ||
  previous.grid !== next.grid ||
  previous.canvasMode !== next.canvasMode ||
  previous.slideDeck !== next.slideDeck ||
  previous.structuredScene !== next.structuredScene ||
  previous.structuredComponents !== next.structuredComponents ||
  previous.canvasSessions !== next.canvasSessions ||
  previous.activeCanvasId !== next.activeCanvasId ||
  previous.brushChar !== next.brushChar ||
  previous.brushColor !== next.brushColor ||
  previous.brushBackgroundColor !== next.brushBackgroundColor ||
  previous.showGrid !== next.showGrid ||
  previous.exportShowGrid !== next.exportShowGrid ||
  previous.collaborationEndpoint !== next.collaborationEndpoint;
