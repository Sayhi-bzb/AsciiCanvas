import type { GridCell, Point } from "@/shared/types";
import type { CanvasMode } from "./mode";
import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";
import type { CanvasSession } from "./model";

export const EDITOR_PERSISTENCE_VERSION = 3;
export const EDITOR_PERSISTENCE_KEY = "ascii-canvas-persistence";
export const EDITOR_PERSISTENCE_V2_BACKUP_KEY =
  "ascii-canvas-persistence-v2-backup";

interface PersistedEditorStateV3 {
  schemaVersion: 3;
  workspace: {
    offset: Point;
    zoom: number;
    canvasMode: CanvasMode;
    grid: [string, GridCell][];
    structuredScene: StructuredNode[];
    structuredComponents: StructuredComponentInstance[];
  };
  sessions: {
    items: CanvasSession[];
    activeId: string;
  };
  preferences: {
    brushChar: string;
    brushColor: string;
    showGrid: boolean;
    exportShowGrid: boolean;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isPoint = (value: unknown): value is Point =>
  isRecord(value) &&
  typeof value.x === "number" &&
  Number.isFinite(value.x) &&
  typeof value.y === "number" &&
  Number.isFinite(value.y);

const isCanvasMode = (value: unknown): value is CanvasMode =>
  value === "freeform" || value === "structured";

const createBlankSession = (): CanvasSession => ({
  id: "canvas-1",
  name: "Canvas 1",
  mode: "freeform",
  scene: [],
  components: [],
  grid: [],
});

export const isPersistedEditorStateV3 = (
  value: unknown
): value is PersistedEditorStateV3 =>
  isRecord(value) &&
  value.schemaVersion === EDITOR_PERSISTENCE_VERSION &&
  isRecord(value.workspace) &&
  isPoint(value.workspace.offset) &&
  typeof value.workspace.zoom === "number" &&
  Number.isFinite(value.workspace.zoom) &&
  isCanvasMode(value.workspace.canvasMode) &&
  Array.isArray(value.workspace.grid) &&
  Array.isArray(value.workspace.structuredScene) &&
  Array.isArray(value.workspace.structuredComponents) &&
  isRecord(value.sessions) &&
  Array.isArray(value.sessions.items) &&
  typeof value.sessions.activeId === "string" &&
  isRecord(value.preferences) &&
  typeof value.preferences.brushChar === "string" &&
  typeof value.preferences.brushColor === "string" &&
  typeof value.preferences.showGrid === "boolean" &&
  typeof value.preferences.exportShowGrid === "boolean";

export const migratePersistedStateToV3 = (
  value: unknown
): PersistedEditorStateV3 => {
  const state = isRecord(value) ? value : {};
  const oldWorkspace = isRecord(state.workspace) ? state.workspace : state;
  const oldSessions = isRecord(state.sessions) ? state.sessions : {};
  const preferences = isRecord(state.preferences) ? state.preferences : state;
  const rawItems = Array.isArray(oldSessions.items)
    ? oldSessions.items
    : Array.isArray(state.canvasSessions)
      ? state.canvasSessions
      : [];
  const items = rawItems.filter(
    (item): item is CanvasSession =>
      isRecord(item) &&
      typeof item.id === "string" &&
      isCanvasMode(item.mode)
  );
  if (items.length === 0) items.push(createBlankSession());

  const requestedActiveId =
    typeof oldSessions.activeId === "string"
      ? oldSessions.activeId
      : typeof state.activeCanvasId === "string"
        ? state.activeCanvasId
        : "";
  const activeId = items.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : items[0].id;
  const activeSession = items.find((item) => item.id === activeId) ?? items[0];
  const oldWorkspaceMode = isCanvasMode(oldWorkspace.canvasMode)
    ? oldWorkspace.canvasMode
    : null;
  const useWorkspace = oldWorkspaceMode === activeSession.mode;
  const viewport = activeSession.viewport;

  return {
    schemaVersion: EDITOR_PERSISTENCE_VERSION,
    workspace: {
      offset: useWorkspace && isPoint(oldWorkspace.offset)
        ? oldWorkspace.offset
        : viewport?.offset ?? { x: 0, y: 0 },
      zoom:
        useWorkspace &&
        typeof oldWorkspace.zoom === "number" &&
        Number.isFinite(oldWorkspace.zoom)
          ? oldWorkspace.zoom
          : viewport?.zoom ?? 1,
      canvasMode: activeSession.mode,
      grid: useWorkspace && Array.isArray(oldWorkspace.grid)
        ? (oldWorkspace.grid as [string, GridCell][])
        : activeSession.grid,
      structuredScene:
        useWorkspace && Array.isArray(oldWorkspace.structuredScene)
          ? (oldWorkspace.structuredScene as StructuredNode[])
          : activeSession.scene,
      structuredComponents:
        useWorkspace && Array.isArray(oldWorkspace.structuredComponents)
          ? (oldWorkspace.structuredComponents as StructuredComponentInstance[])
          : activeSession.components ?? [],
    },
    sessions: { items, activeId },
    preferences: {
      brushChar:
        typeof preferences.brushChar === "string" ? preferences.brushChar : "#",
      brushColor:
        typeof preferences.brushColor === "string"
          ? preferences.brushColor
          : "#000000",
      showGrid:
        typeof preferences.showGrid === "boolean" ? preferences.showGrid : true,
      exportShowGrid:
        typeof preferences.exportShowGrid === "boolean"
          ? preferences.exportShowGrid
          : false,
    },
  };
};

export const flattenPersistedEditorState = (
  value: PersistedEditorStateV3
) => ({
  ...value.workspace,
  canvasSessions: value.sessions.items,
  activeCanvasId: value.sessions.activeId,
  ...value.preferences,
});
