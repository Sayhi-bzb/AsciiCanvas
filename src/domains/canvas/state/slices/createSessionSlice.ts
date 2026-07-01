import type { StateCreator } from "zustand";
import type { CanvasSession, CanvasState, SessionSlice } from "../interfaces";
import {
  buildSessionSnapshot,
  createAnimationSession,
  resolveSessionRuntime,
} from "../helpers/storeUtils";
import {
  withActiveCanvasSnapshot,
  normalizeSessionMode,
  createSessionId,
  resolveNextSessionName,
} from "../helpers/sessionHelpers";
import { createMapFromEntries } from "../helpers/snapshotHelpers";
import {
  applyStructuredSnapshotToYMaps,
  applyFreeformSnapshotToYMaps,
} from "../helpers/gridHelpers";
import {
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "@/domains/protocol";
import type { ProtocolImportSnapshot } from "@/domains/protocol";
import { isLikelyAsciinemaCast, parseAsciinemaCast } from "@/domains/cast";

const getImportedSessionBaseName = (mode: CanvasSession["mode"]) => {
  switch (mode) {
    case "animation":
      return "Imported Animation";
    case "structured":
      return "Imported Structured";
    case "freeform":
      return "Imported Canvas";
  }
};

const resolveImportedSessionName = (
  sessions: CanvasSession[],
  preferredName: string
) => {
  const baseName = preferredName.trim() || "Imported Canvas";
  if (!sessions.some((session) => session.name === baseName)) {
    return baseName;
  }

  let index = 2;
  let candidate = `${baseName} ${index}`;
  while (sessions.some((session) => session.name === candidate)) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }
  return candidate;
};

const createImportedSession = (
  sessionId: string,
  name: string,
  snapshot: ProtocolImportSnapshot
): CanvasSession => {
  const baseSession = {
    id: sessionId,
    name,
    mode: snapshot.mode,
    scene: snapshot.scene,
    grid: snapshot.grid,
  } satisfies Omit<CanvasSession, "size" | "timeline">;

  if (snapshot.mode === "animation") {
    return {
      ...baseSession,
      size: snapshot.size,
      timeline: snapshot.timeline,
    };
  }

  return baseSession;
};

export const createSessionSlice: StateCreator<
  CanvasState,
  [],
  [],
  SessionSlice
> = (set, get) => ({
  createCanvasSession: (mode = "freeform", options) => {
    const state = get();
    const snapshot = buildSessionSnapshot(state);
    const sessionsWithSnapshot = withActiveCanvasSnapshot(
      state.canvasSessions,
      state.activeCanvasId,
      snapshot
    );

    const normalizedMode = normalizeSessionMode(mode);
    const newSession =
      normalizedMode === "animation"
        ? createAnimationSession(sessionsWithSnapshot, options?.size)
        : {
            id: createSessionId(sessionsWithSnapshot),
            name: resolveNextSessionName(sessionsWithSnapshot),
            mode: normalizedMode,
            scene: [],
            grid: [],
          };

    const runtime = resolveSessionRuntime(newSession, state.tool);

    set({
      canvasSessions: [...sessionsWithSnapshot, newSession],
      activeCanvasId: newSession.id,
      canvasMode: runtime.nextMode,
      structuredScene: runtime.nextScene,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
      canvasBounds: runtime.nextBounds,
      animationTimeline: runtime.nextTimeline,
      animationIsPlaying: false,
      offset: runtime.nextOffset,
      zoom: runtime.nextZoom,
      activeCanvasHasSavedViewport: runtime.hasSavedViewport,
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      hoveredGrid: null,
      scratchLayer: null,
    });

    if (runtime.nextMode === "structured") {
      applyStructuredSnapshotToYMaps(runtime.nextScene);
    } else {
      applyFreeformSnapshotToYMaps(runtime.nextGridEntries);
    }
  },
  importCanvasSession: (raw, options) => {
    const state = get();
    const snapshot = buildSessionSnapshot(state);
    const sessionsWithSnapshot = withActiveCanvasSnapshot(
      state.canvasSessions,
      state.activeCanvasId,
      snapshot
    );
    const importedSnapshot =
      typeof raw === "string" && isLikelyAsciinemaCast(raw)
        ? parseAsciinemaCast(raw)
        : protocolDocumentToSnapshot(parseProtocolDocument(raw));
    const sessionId = createSessionId(sessionsWithSnapshot);
    const sessionName = resolveImportedSessionName(
      sessionsWithSnapshot,
      options?.name?.trim() ||
        getImportedSessionBaseName(importedSnapshot.mode)
    );
    const newSession = createImportedSession(
      sessionId,
      sessionName,
      importedSnapshot
    );
    const runtime = resolveSessionRuntime(newSession, state.tool);

    set({
      canvasSessions: [...sessionsWithSnapshot, newSession],
      activeCanvasId: newSession.id,
      canvasMode: runtime.nextMode,
      structuredScene: runtime.nextScene,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
      canvasBounds: runtime.nextBounds,
      animationTimeline: runtime.nextTimeline,
      animationIsPlaying: false,
      offset: runtime.nextOffset,
      zoom: runtime.nextZoom,
      activeCanvasHasSavedViewport: runtime.hasSavedViewport,
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      hoveredGrid: null,
      scratchLayer: null,
    });

    if (runtime.nextMode === "structured") {
      applyStructuredSnapshotToYMaps(runtime.nextScene);
    } else {
      applyFreeformSnapshotToYMaps(runtime.nextGridEntries);
    }

    return newSession;
  },
  switchCanvasSession: (canvasId) => {
    const state = get();
    if (canvasId === state.activeCanvasId) return;

    const snapshot = buildSessionSnapshot(state);
    const sessionsWithSnapshot = withActiveCanvasSnapshot(
      state.canvasSessions,
      state.activeCanvasId,
      snapshot
    );
    const target = sessionsWithSnapshot.find(
      (session) => session.id === canvasId
    );
    if (!target) return;

    const runtime = resolveSessionRuntime(target, state.tool);

    set({
      canvasSessions: sessionsWithSnapshot,
      activeCanvasId: canvasId,
      canvasMode: runtime.nextMode,
      structuredScene: runtime.nextScene,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
      canvasBounds: runtime.nextBounds,
      animationTimeline: runtime.nextTimeline,
      animationIsPlaying: false,
      offset: runtime.nextOffset,
      zoom: runtime.nextZoom,
      activeCanvasHasSavedViewport: runtime.hasSavedViewport,
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      hoveredGrid: null,
      scratchLayer: null,
    });

    if (runtime.nextMode === "structured") {
      applyStructuredSnapshotToYMaps(runtime.nextScene);
    } else {
      applyFreeformSnapshotToYMaps(runtime.nextGridEntries);
    }
  },
  removeCanvasSession: (canvasId) => {
    const state = get();
    if (state.canvasSessions.length <= 1) return;

    const snapshot = buildSessionSnapshot(state);
    const sessionsWithSnapshot = withActiveCanvasSnapshot(
      state.canvasSessions,
      state.activeCanvasId,
      snapshot
    );
    const removedIndex = sessionsWithSnapshot.findIndex(
      (session) => session.id === canvasId
    );
    if (removedIndex === -1) return;

    const remaining = sessionsWithSnapshot.filter(
      (session) => session.id !== canvasId
    );
    if (remaining.length === 0) return;

    if (canvasId !== state.activeCanvasId) {
      set({ canvasSessions: remaining });
      return;
    }

    const nextIndex = Math.min(removedIndex, remaining.length - 1);
    const nextSession = remaining[nextIndex];
    const runtime = resolveSessionRuntime(nextSession, state.tool);

    set({
      canvasSessions: remaining,
      activeCanvasId: nextSession.id,
      canvasMode: runtime.nextMode,
      structuredScene: runtime.nextScene,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
      canvasBounds: runtime.nextBounds,
      animationTimeline: runtime.nextTimeline,
      animationIsPlaying: false,
      offset: runtime.nextOffset,
      zoom: runtime.nextZoom,
      activeCanvasHasSavedViewport: runtime.hasSavedViewport,
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      hoveredGrid: null,
      scratchLayer: null,
    });

    if (runtime.nextMode === "structured") {
      applyStructuredSnapshotToYMaps(runtime.nextScene);
    } else {
      applyFreeformSnapshotToYMaps(runtime.nextGridEntries);
    }
  },
  renameCanvasSession: (canvasId, nextName) => {
    const name = nextName.trim();
    if (!name) return;
    set((state) => ({
      canvasSessions: state.canvasSessions.map((session) =>
        session.id === canvasId ? { ...session, name } : session
      ),
    }));
  },
});
