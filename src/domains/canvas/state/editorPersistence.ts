import { isCollaborationDescriptor } from "@/domains/collaboration/public";
import {
  EDITOR_PERSISTENCE_VERSION,
  normalizeSessionMode,
  withActiveCanvasSnapshot,
  type CanvasSession,
} from "@/domains/sessions/public";
import { normalizeSlideDeck } from "@/domains/slides/public";
import {
  buildStructuredTemplate,
  normalizeStructuredComponents,
  sceneToGridEntries,
  type StructuredNode,
} from "@/domains/structured-content/public";
import { COLOR_PRIMARY_TEXT, DEFAULT_BRUSH_CHAR } from "@/shared/lib/constants";
import type { Point } from "@/shared/types";
import { normalizeBrushChar } from "@/shared/utils/characters";
import { DEFAULT_DEMO_GRID } from "./helpers/defaultDemo";
import {
  cloneScene,
  createMapFromEntries,
  normalizeAndCloneScene,
  normalizeGridEntries,
  toStructuredNode,
} from "./helpers/snapshotHelpers";
import {
  buildSessionSnapshot,
  DEFAULT_MODE,
  DEFAULT_SESSION_ID,
  DEFAULT_SESSION_NAME,
  DEFAULT_STRUCTURED_SESSION_ID,
  DEFAULT_STRUCTURED_SESSION_NAME,
  getSessionCanvasDocumentId,
  normalizeSessionViewport,
  resolveSessionRuntime,
} from "./helpers/storeUtils";
import type { EditorState } from "./interfaces";
import {
  activateCanvasDocument,
  initializeCollaborativeCanvasDocument,
} from "./canvasDocument";

const DEFAULT_STRUCTURED_SAFARI_TEMPLATE = buildStructuredTemplate(
  "safari",
  { x: 4, y: 2 },
  { brushColor: COLOR_PRIMARY_TEXT, startOrder: 1 }
);
const DEFAULT_STRUCTURED_SAFARI_GRID = sceneToGridEntries(
  DEFAULT_STRUCTURED_SAFARI_TEMPLATE.nodes
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
    grid: DEFAULT_STRUCTURED_SAFARI_GRID,
  },
];

type RecoverableEditorState = EditorState & {
  canvasSessions?: unknown;
  activeCanvasId?: unknown;
  canvasMode?: unknown;
  structuredScene?: unknown;
  structuredComponents?: unknown;
  slideDeck?: unknown;
};

export const recoverPersistedEditorState = (
  hydratedState: EditorState,
  hasPersistedState: boolean
): EditorState => {
  const state = { ...hydratedState } as RecoverableEditorState;
  state.brushChar = normalizeBrushChar(state.brushChar, DEFAULT_BRUSH_CHAR);
  state.brushColor =
    typeof state.brushColor === "string" ? state.brushColor : COLOR_PRIMARY_TEXT;
  state.showGrid = typeof state.showGrid === "boolean" ? state.showGrid : true;
  state.exportShowGrid =
    typeof state.exportShowGrid === "boolean" ? state.exportShowGrid : false;

  const legacyGridEntries = normalizeGridEntries(state.grid);
  const legacyViewport = normalizeSessionViewport({
    offset: state.offset as Point,
    zoom: state.zoom,
  });
  const legacyMode = normalizeSessionMode(state.canvasMode);
  const legacyScene = Array.isArray(state.structuredScene)
    ? (state.structuredScene
        .map((item) => toStructuredNode(item))
        .filter((item): item is StructuredNode => !!item) as StructuredNode[])
    : [];
  const legacyComponents = Array.isArray(state.structuredComponents)
    ? normalizeStructuredComponents(state.structuredComponents as never, legacyScene)
    : normalizeStructuredComponents(undefined, legacyScene);

  const recoveredSessions: CanvasSession[] = Array.isArray(state.canvasSessions)
    ? state.canvasSessions
        .map((raw): CanvasSession | null => {
          if (!raw || typeof raw !== "object") return null;
          const candidate = raw as Partial<CanvasSession> & {
            mode?: unknown;
            scene?: unknown;
            components?: unknown;
          };
          if (typeof candidate.id !== "string") return null;
          if ((raw as { mode?: unknown }).mode === "animation") return null;
          const mode = normalizeSessionMode(candidate.mode);
          const viewport = normalizeSessionViewport(candidate.viewport);
          if (mode === "slide") {
            return {
              id: candidate.id,
              name:
                typeof candidate.name === "string" && candidate.name.trim()
                  ? candidate.name
                  : "Slides",
              mode: "slide",
              slideDeck: normalizeSlideDeck(
                (raw as { slideDeck?: unknown }).slideDeck,
                `${candidate.id}-slide-1`
              ),
              scene: [],
              components: [],
              grid: [],
              ...(viewport ? { viewport } : {}),
            };
          }
          const scene = Array.isArray(candidate.scene)
            ? candidate.scene
                .map((item) => toStructuredNode(item))
                .filter((item): item is StructuredNode => !!item)
            : [];
          const components = Array.isArray(candidate.components)
            ? normalizeStructuredComponents(candidate.components as never, scene)
            : normalizeStructuredComponents(undefined, scene);
          const collaboration = isCollaborationDescriptor(candidate.collaboration)
            ? candidate.collaboration
            : undefined;

          return {
            id: candidate.id,
            name:
              typeof candidate.name === "string" && candidate.name.trim()
                ? candidate.name
                : "Canvas",
            mode,
            scene: normalizeAndCloneScene(scene),
            components,
            grid: normalizeGridEntries(candidate.grid),
            ...(viewport ? { viewport } : {}),
            ...(collaboration ? { collaboration } : {}),
          } satisfies CanvasSession;
        })
        .filter((session): session is CanvasSession => session !== null)
    : [];

  const sessions =
    recoveredSessions.length > 0
      ? recoveredSessions
      : !hasPersistedState
        ? createDefaultCanvasSessions()
        : [
            {
              id: DEFAULT_SESSION_ID,
              name: DEFAULT_SESSION_NAME,
              mode: legacyMode === "slide" ? "freeform" : legacyMode,
              scene: normalizeAndCloneScene(legacyScene),
              components: legacyComponents,
              grid:
                !hasPersistedState && legacyGridEntries.length === 0
                  ? DEFAULT_DEMO_GRID
                  : legacyGridEntries,
              ...(legacyViewport ? { viewport: legacyViewport } : {}),
            },
          ];

  const activeCanvasId =
    typeof state.activeCanvasId === "string" &&
    sessions.some((session) => session.id === state.activeCanvasId)
      ? state.activeCanvasId
      : sessions[0].id;
  const sessionsWithActiveViewport = sessions.map((session) =>
    session.id === activeCanvasId && !session.viewport && legacyViewport
      ? { ...session, viewport: legacyViewport }
      : session
  );
  const activeSession =
    sessionsWithActiveViewport.find((session) => session.id === activeCanvasId) ??
    sessionsWithActiveViewport[0];
  const runtime = resolveSessionRuntime(activeSession, state.tool || "select");

  state.canvasSessions = sessionsWithActiveViewport;
  state.activeCanvasId = activeCanvasId;
  state.canvasMode = runtime.nextMode;
  state.slideDeck = runtime.nextSlideDeck;
  state.structuredScene = runtime.nextScene;
  state.structuredComponents = runtime.nextComponents;
  state.selectedStructuredNodeIds = [];
  state.selectedStructuredBoxId = null;
  state.selectedStructuredSplitHandle = null;
  state.structuredContextPoint = null;
  state.grid = createMapFromEntries(runtime.nextGridEntries);
  state.tool = runtime.nextTool;
  state.offset = runtime.nextOffset;
  state.zoom = runtime.nextZoom;
  state.activeCanvasHasSavedViewport = runtime.hasSavedViewport;
  return state as EditorState;
};

export const syncHydratedStateToCanvasDocument = (hydratedState: EditorState) => {
  const activeSession = hydratedState.canvasSessions.find(
    (session) => session.id === hydratedState.activeCanvasId
  );
  if (!activeSession) return;
  if (activeSession.mode !== "slide" && activeSession.collaboration) {
    initializeCollaborativeCanvasDocument(activeSession.id);
    return;
  }
  activateCanvasDocument(
    getSessionCanvasDocumentId(activeSession, hydratedState.slideDeck),
    {
      grid: Array.from(hydratedState.grid.entries()),
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
          ? sceneToGridEntries(state.structuredScene)
          : Array.from(state.grid.entries()),
    },
    sessions: { items: persistedSessions, activeId: state.activeCanvasId },
    preferences: {
      brushChar: state.brushChar,
      brushColor: state.brushColor,
      showGrid: state.showGrid,
      exportShowGrid: state.exportShowGrid,
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
  previous.showGrid !== next.showGrid ||
  previous.exportShowGrid !== next.exportShowGrid;
