import type { GridCell, Point } from "@/shared/types";
import type { CanvasMode } from "./mode";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { AnimationCanvasSize, AnimationTimeline } from "@/domains/animation/public";
import type { CanvasSession } from "./model";

export const EDITOR_PERSISTENCE_VERSION = 2;
export const EDITOR_PERSISTENCE_KEY = "ascii-canvas-persistence";
export const EDITOR_PERSISTENCE_V1_BACKUP_KEY =
  "ascii-canvas-persistence-v1-backup";

export interface PersistedEditorStateV2 {
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

export const isPersistedEditorStateV2 = (
  value: unknown
): value is PersistedEditorStateV2 =>
  isRecord(value) &&
  value.schemaVersion === EDITOR_PERSISTENCE_VERSION &&
  isRecord(value.workspace) &&
  isRecord(value.sessions) &&
  isRecord(value.preferences);

export const migratePersistedStateV1ToV2 = (
  value: unknown
): PersistedEditorStateV2 => {
  const state = isRecord(value) ? value : {};
  return {
    schemaVersion: EDITOR_PERSISTENCE_VERSION,
    workspace: {
      offset: state.offset as Point,
      zoom: state.zoom as number,
      canvasMode: state.canvasMode as CanvasMode,
      grid: state.grid as [string, GridCell][],
      structuredScene: state.structuredScene as StructuredNode[],
      structuredComponents:
        state.structuredComponents as StructuredComponentInstance[],
      canvasBounds: state.canvasBounds as AnimationCanvasSize | null,
      animationTimeline: state.animationTimeline as AnimationTimeline | null,
    },
    sessions: {
      items: state.canvasSessions as CanvasSession[],
      activeId: state.activeCanvasId as string,
    },
    preferences: {
      brushChar: state.brushChar as string,
      brushColor: state.brushColor as string,
      showGrid: state.showGrid as boolean,
      exportShowGrid: state.exportShowGrid as boolean,
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
