import type { CanvasSession, CanvasState } from "../interfaces";
import type {
  AnsiAnimationDocument,
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
export const DEFAULT_ANSI_ANIMATION_SIZE: AnimationCanvasSize = {
  width: 80,
  height: 25,
};
export const DEFAULT_ANSI_ANIMATION_DOCUMENT: AnsiAnimationDocument = {
  script: "",
  width: DEFAULT_ANSI_ANIMATION_SIZE.width,
  height: DEFAULT_ANSI_ANIMATION_SIZE.height,
  fps: 12,
  background: "#0f0f0f",
};

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

  if (state.canvasMode === "ansi-animation") {
    const ansiAnimation = state.ansiAnimation ?? DEFAULT_ANSI_ANIMATION_DOCUMENT;
    return {
      mode: "ansi-animation" as const,
      scene: [] as StructuredNode[],
      grid: [],
      ansiAnimation,
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
      nextAnsiAnimation: null as AnsiAnimationDocument | null,
    };
  }

  if (nextMode === "ansi-animation") {
    const ansiAnimation = session.ansiAnimation ?? DEFAULT_ANSI_ANIMATION_DOCUMENT;
    return {
      nextMode,
      nextScene: [] as StructuredNode[],
      nextGridEntries: [],
      nextTool: isToolAllowedForMode(currentTool, nextMode)
        ? currentTool
        : getFallbackToolForMode(nextMode),
      nextBounds: {
        width: Math.max(1, Math.floor(ansiAnimation.width || DEFAULT_ANSI_ANIMATION_SIZE.width)),
        height: Math.max(1, Math.floor(ansiAnimation.height || DEFAULT_ANSI_ANIMATION_SIZE.height)),
      },
      nextTimeline: null as AnimationTimeline | null,
      nextAnsiAnimation: {
        script: typeof ansiAnimation.script === "string" ? ansiAnimation.script : "",
        width: Math.max(1, Math.floor(ansiAnimation.width || DEFAULT_ANSI_ANIMATION_SIZE.width)),
        height: Math.max(1, Math.floor(ansiAnimation.height || DEFAULT_ANSI_ANIMATION_SIZE.height)),
        fps: Math.max(1, Math.floor(ansiAnimation.fps || DEFAULT_ANSI_ANIMATION_DOCUMENT.fps)),
        background:
          typeof ansiAnimation.background === "string" && ansiAnimation.background.trim()
            ? ansiAnimation.background
            : DEFAULT_ANSI_ANIMATION_DOCUMENT.background,
      },
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
    nextAnsiAnimation: null as AnsiAnimationDocument | null,
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

export const createAnsiAnimationSession = (
  sessions: CanvasSession[],
  size?: AnimationCanvasSize
): CanvasSession => {
  const normalizedSize = {
    width: Math.max(1, Math.floor(size?.width ?? DEFAULT_ANSI_ANIMATION_SIZE.width)),
    height: Math.max(1, Math.floor(size?.height ?? DEFAULT_ANSI_ANIMATION_SIZE.height)),
  };

  return {
    id: createSessionId(sessions),
    name: resolveNextSessionName(sessions),
    mode: "ansi-animation",
    scene: [],
    grid: [],
    ansiAnimation: {
      ...DEFAULT_ANSI_ANIMATION_DOCUMENT,
      width: normalizedSize.width,
      height: normalizedSize.height,
    },
    size: normalizedSize,
  };
};
