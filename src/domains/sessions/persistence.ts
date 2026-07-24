import type { GridCell, Point } from "@/shared/types";
import type { CanvasMode } from "./mode";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { AnimationCanvasSize, AnimationTimeline } from "@/domains/animation/public";
import type { CanvasSession } from "./model";

export const EDITOR_PERSISTENCE_VERSION = 2;
export const EDITOR_PERSISTENCE_KEY = "ascii-canvas-persistence";
export const EDITOR_PERSISTENCE_V1_BACKUP_KEY =
  "ascii-canvas-persistence-v1-backup";

interface PersistedEditorStateV2 {
  schemaVersion: 2;
  workspace: {
    offset: Point;
    zoom: number;
    canvasMode: CanvasMode;
    grid: [string, GridCell][];
    structuredScene: StructuredNode[];
    structuredComponents: StructuredComponentInstance[];
    canvasBounds: AnimationCanvasSize | null;
    animationTimeline: AnimationTimeline | null;
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
  value === "freeform" || value === "structured" || value === "animation";

export const isPersistedEditorStateV2 = (
  value: unknown
): value is PersistedEditorStateV2 =>
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

export const migratePersistedStateV1ToV2 = (
  value: unknown
): PersistedEditorStateV2 => {
  const state = isRecord(value) ? value : {};
  const workspace = isRecord(state.workspace) ? state.workspace : state;
  const sessions = isRecord(state.sessions) ? state.sessions : {};
  const preferences = isRecord(state.preferences) ? state.preferences : state;
  const canvasMode = isCanvasMode(workspace.canvasMode)
    ? workspace.canvasMode
    : "freeform";

  return {
    schemaVersion: EDITOR_PERSISTENCE_VERSION,
    workspace: {
      offset: isPoint(workspace.offset) ? workspace.offset : { x: 0, y: 0 },
      zoom:
        typeof workspace.zoom === "number" && Number.isFinite(workspace.zoom)
          ? workspace.zoom
          : 1,
      canvasMode,
      grid: Array.isArray(workspace.grid)
        ? (workspace.grid as [string, GridCell][])
        : [],
      structuredScene: Array.isArray(workspace.structuredScene)
        ? (workspace.structuredScene as StructuredNode[])
        : [],
      structuredComponents:
        Array.isArray(workspace.structuredComponents)
          ? (workspace.structuredComponents as StructuredComponentInstance[])
          : [],
      canvasBounds: isRecord(workspace.canvasBounds)
        ? (workspace.canvasBounds as unknown as AnimationCanvasSize)
        : null,
      animationTimeline: isRecord(workspace.animationTimeline)
        ? (workspace.animationTimeline as unknown as AnimationTimeline)
        : null,
    },
    sessions: {
      items: Array.isArray(sessions.items)
        ? (sessions.items as CanvasSession[])
        : Array.isArray(state.canvasSessions)
          ? (state.canvasSessions as CanvasSession[])
          : [],
      activeId:
        typeof sessions.activeId === "string"
          ? sessions.activeId
          : typeof state.activeCanvasId === "string"
            ? state.activeCanvasId
            : "",
    },
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
  value: PersistedEditorStateV2
) => ({
  ...value.workspace,
  canvasSessions: value.sessions.items,
  activeCanvasId: value.sessions.activeId,
  ...value.preferences,
});
