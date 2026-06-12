import type { CanvasSession, CanvasState } from "../interfaces";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  CanvasMode,
  StructuredNode,
  ToolType,
} from "@/shared/types";
import { sceneToGridEntries } from "@/shared/utils/structured";
import { serializeGrid } from "./snapshotHelpers";
import {
  normalizeAndCloneScene,
} from "./snapshotHelpers";
import {
  createEmptyAnimationFrame,
  createNextAnimationFrameName,
  DEFAULT_ANIMATION_SIZE,
  getAnimationFrameEntries,
  normalizeAnimationCanvasSize,
  normalizeAnimationTimeline,
  updateAnimationFrameEntries,
} from "./animationHelpers";
import {
  resolveNextSessionName,
  createSessionId,
  normalizeSessionMode,
} from "./sessionHelpers";

export const DEFAULT_SESSION_ID = "canvas-1";
export const DEFAULT_SESSION_NAME = "Canvas 1";
export const DEFAULT_MODE: CanvasMode = "freeform";
export const STRUCTURED_ALLOWED_TOOLS: ToolType[] = ["select", "box", "line"];

export const isToolAllowedForMode = (tool: ToolType, mode: CanvasMode) => {
  if (mode === "structured") return STRUCTURED_ALLOWED_TOOLS.includes(tool);
  return true;
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
      grid: getAnimationFrameEntries(timeline, timeline.currentFrameId),
      size,
      timeline,
    };
  }

  if (state.canvasMode === "structured") {
    return {
      mode: "structured" as const,
      scene: state.structuredScene,
      grid: sceneToGridEntries(state.structuredScene),
    };
  }

  return {
    mode: "freeform" as const,
    scene: [] as StructuredNode[],
    grid: serializeGrid(state.grid),
  };
};

export const resolveSessionRuntime = (session: CanvasSession, currentTool: ToolType) => {
  const nextMode = normalizeSessionMode(session.mode);

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
      nextGridEntries,
      nextTool: isToolAllowedForMode(currentTool, nextMode)
        ? currentTool
        : getFallbackToolForMode(nextMode),
      nextBounds,
      nextTimeline,
    };
  }

  const nextScene =
    nextMode === "structured" ? normalizeAndCloneScene(session.scene) : [];
  const nextGridEntries =
    nextMode === "structured" ? sceneToGridEntries(nextScene) : session.grid;

  return {
    nextMode,
    nextScene,
    nextGridEntries,
    nextTool: isToolAllowedForMode(currentTool, nextMode)
      ? currentTool
      : getFallbackToolForMode(nextMode),
    nextBounds: null as AnimationCanvasSize | null,
    nextTimeline: null as AnimationTimeline | null,
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
