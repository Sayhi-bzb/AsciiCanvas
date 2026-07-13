import type { CanvasSession, CanvasState } from "../interfaces";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  CanvasMode,
  StructuredComponentInstance,
  StructuredNode,
  ToolType,
} from "@/shared/types";
import { sceneToGridEntries } from "@/shared/utils/structured";
import { MIN_ZOOM, MAX_ZOOM } from "@/shared/lib/constants";
import { serializeGrid } from "./snapshotHelpers";
import { normalizeStructuredComponents } from "@/domains/structured-content/public";
import { normalizeAndCloneScene } from "./snapshotHelpers";

import {
  createEmptyAnimationFrame,
  createNextAnimationFrameName,
  DEFAULT_ANIMATION_SIZE,
  getAnimationFrameEntries,
  normalizeAnimationCanvasSize,
  normalizeAnimationTimeline,
  updateAnimationFrameEntries,
} from "@/domains/animation/public";
import {
  resolveNextSessionName,
  createSessionId,
  normalizeSessionMode,
} from "./sessionHelpers";

export const DEFAULT_SESSION_ID = "canvas-1";
export const DEFAULT_SESSION_NAME = "Canvas 1";
export const DEFAULT_STRUCTURED_SESSION_ID = "canvas-2";
export const DEFAULT_STRUCTURED_SESSION_NAME = "Canvas 2";
export const DEFAULT_MODE: CanvasMode = "freeform";
export const STRUCTURED_ALLOWED_TOOLS: ToolType[] = ["select", "text", "box", "splitBox", "line", "bg"];

const DEFAULT_VIEWPORT = { offset: { x: 0, y: 0 }, zoom: 1 };

export const normalizeSessionViewport = (viewport: CanvasSession["viewport"] | undefined) => {
  if (!viewport) return null;
  const x = Number.isFinite(viewport.offset?.x) ? viewport.offset.x : DEFAULT_VIEWPORT.offset.x;
  const y = Number.isFinite(viewport.offset?.y) ? viewport.offset.y : DEFAULT_VIEWPORT.offset.y;
  const rawZoom = Number.isFinite(viewport.zoom) ? viewport.zoom : DEFAULT_VIEWPORT.zoom;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom));
  return { offset: { x, y }, zoom };
};

export const isToolAllowedForMode = (tool: ToolType, mode: CanvasMode) => {
  if (mode === "structured") return STRUCTURED_ALLOWED_TOOLS.includes(tool);
  if (mode === "animation") return tool !== "text" && tool !== "bg";
  return tool !== "text";
};

export const getFallbackToolForMode = (mode: CanvasMode): ToolType => {
  return mode === "structured" ? "select" : "brush";
};

export const createDefaultAnimationTimeline = (): AnimationTimeline => {
  const initialFrame = createEmptyAnimationFrame(
    undefined,
    createNextAnimationFrameName([])
  );
  return normalizeAnimationTimeline({
    frames: [initialFrame],
    currentFrameId: initialFrame.id,
  });
};

export const buildSessionSnapshot = (state: CanvasState) => {
  if (state.canvasMode === "animation") {
    const size = state.canvasBounds ?? DEFAULT_ANIMATION_SIZE;
    const activeGridEntries = serializeGrid(state.grid);
    const timeline = state.animationTimeline
      ? updateAnimationFrameEntries(
          state.animationTimeline,
          state.animationTimeline.currentFrameId,
          activeGridEntries
        )
      : normalizeAnimationTimeline(undefined, activeGridEntries);
    return {
      mode: "animation" as const,
      scene: [] as StructuredNode[],
      components: [] as StructuredComponentInstance[],
      grid: getAnimationFrameEntries(timeline, timeline.currentFrameId),
      size,
      timeline,
      viewport: { offset: { ...state.offset }, zoom: state.zoom },
    };
  }

  if (state.canvasMode === "structured") {
    return {
      mode: "structured" as const,
      scene: state.structuredScene,
      components: state.structuredComponents,
      grid: sceneToGridEntries(state.structuredScene),
      viewport: { offset: { ...state.offset }, zoom: state.zoom },
    };
  }

  return {
    mode: "freeform" as const,
    scene: [] as StructuredNode[],
    components: [] as StructuredComponentInstance[],
    grid: serializeGrid(state.grid),
    viewport: { offset: { ...state.offset }, zoom: state.zoom },
  };
};

export const resolveSessionRuntime = (session: CanvasSession, currentTool: ToolType) => {
  const nextMode = normalizeSessionMode(session.mode);
  const viewport = normalizeSessionViewport(session.viewport);
  const nextOffset = viewport?.offset ?? DEFAULT_VIEWPORT.offset;
  const nextZoom = viewport?.zoom ?? DEFAULT_VIEWPORT.zoom;

  if (nextMode === "animation") {
    const nextBounds = normalizeAnimationCanvasSize(session.size);
    const nextTimeline = normalizeAnimationTimeline(session.timeline, session.grid);
    const nextGridEntries = getAnimationFrameEntries(
      nextTimeline,
      nextTimeline.currentFrameId
    );
    return {
      nextMode,
      nextScene: [] as StructuredNode[],
      nextComponents: [] as StructuredComponentInstance[],
      nextGridEntries,
      nextTool: isToolAllowedForMode(currentTool, nextMode)
        ? currentTool
        : getFallbackToolForMode(nextMode),
      nextBounds,
      nextTimeline,
      nextOffset,
      nextZoom,
      hasSavedViewport: !!viewport,
    };
  }

  const nextScene =
    nextMode === "structured" ? normalizeAndCloneScene(session.scene) : [];
  const nextComponents =
    nextMode === "structured"
      ? normalizeStructuredComponents(session.components, nextScene)
      : [];
  const nextGridEntries =
    nextMode === "structured" ? sceneToGridEntries(nextScene) : session.grid;

  return {
    nextMode,
    nextScene,
    nextComponents,
    nextGridEntries,
    nextTool: isToolAllowedForMode(currentTool, nextMode)
      ? currentTool
      : getFallbackToolForMode(nextMode),
    nextBounds: null as AnimationCanvasSize | null,
    nextTimeline: null as AnimationTimeline | null,
    nextOffset,
    nextZoom,
    hasSavedViewport: !!viewport,
  };
};

export const createAnimationSession = (
  sessions: CanvasSession[],
  size?: AnimationCanvasSize
): CanvasSession => {
  const timeline = createDefaultAnimationTimeline();
  const normalizedSize = normalizeAnimationCanvasSize(size);
  return {
    id: createSessionId(sessions),
    name: resolveNextSessionName(sessions),
    mode: "animation",
    scene: [],
    grid: getAnimationFrameEntries(timeline, timeline.currentFrameId),
    size: normalizedSize,
    timeline,
  };
};
