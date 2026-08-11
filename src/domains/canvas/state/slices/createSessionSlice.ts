import type { StateCreator } from "zustand";
import type {
  EditorState,
} from "../interfaces";
import type {
  CanvasImportSnapshot,
  CanvasSession,
  SessionCommands,
} from "@/domains/sessions/public";
import {
  buildSessionSnapshot,
  resolveSessionRuntime,
  getSessionCanvasDocumentId,
  getSlideCanvasDocumentId,
} from "../helpers/storeUtils";
import {
  withActiveCanvasSnapshot,
  normalizeSessionMode,
  createSessionId,
  resolveNextSessionName,
} from "@/domains/sessions/public";
import { createMapFromEntries } from "../helpers/snapshotHelpers";
import { createSlideDeck } from "@/domains/slides/public";
import { parseCanvasSessionSource } from "../sessionImportPort";
import {
  activateCanvasDocument,
  destroyCanvasDocument,
  resetCanvasDocument,
} from "../yjs";

const getImportedSessionBaseName = (mode: CanvasImportSnapshot["mode"]) => {
  switch (mode) {
    case "structured":
      return "Imported Structured";
    case "freeform":
      return "Imported Canvas";
    case "slide":
      return "Imported Slides";
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
  snapshot: CanvasImportSnapshot
): CanvasSession => {
  if (snapshot.mode === "slide") {
    return {
      id: sessionId,
      name,
      mode: "slide",
      slideDeck: snapshot.slideDeck,
      scene: [],
      components: [],
      grid: [],
    };
  }

  const baseSession = {
    id: sessionId,
    name,
    mode: snapshot.mode,
    scene: snapshot.scene,
    components: snapshot.components,
    grid: snapshot.grid,
  } satisfies CanvasSession;

  return baseSession;
};

const destroySessionDocuments = (session: CanvasSession) => {
  if (session.mode === "slide") {
    session.slideDeck.slides.forEach((slide) =>
      destroyCanvasDocument(getSlideCanvasDocumentId(session.id, slide.id))
    );
    return;
  }
  destroyCanvasDocument(session.id);
};

export const createSessionSlice: StateCreator<
  EditorState,
  [],
  [],
  SessionCommands
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
    const sessionId = createSessionId(sessionsWithSnapshot);
    const newSession: CanvasSession =
      normalizedMode === "slide"
        ? {
            id: sessionId,
            name: resolveNextSessionName(sessionsWithSnapshot, normalizedMode),
            mode: "slide",
            slideDeck: createSlideDeck({
              initialSlideId: `${sessionId}-slide-1`,
              size: options?.slideSize,
            }),
            scene: [],
            components: [],
            grid: [],
          }
        : {
            id: sessionId,
            name: resolveNextSessionName(sessionsWithSnapshot, normalizedMode),
            mode: normalizedMode,
            scene: [],
            components: [],
            grid: [],
          };

    const runtime = resolveSessionRuntime(newSession, state.tool);

    activateCanvasDocument(getSessionCanvasDocumentId(newSession, runtime.nextSlideDeck), {
      grid: runtime.nextGridEntries,
      scene: runtime.nextMode === "structured" ? runtime.nextScene : [],
      components: runtime.nextComponents,
    });

    set({
      canvasSessions: [...sessionsWithSnapshot, newSession],
      activeCanvasId: newSession.id,
      canvasMode: runtime.nextMode,
      slideDeck: runtime.nextSlideDeck,
      structuredScene: runtime.nextScene,
      structuredComponents: runtime.nextComponents,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
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

  },
  importCanvasSession: (raw, options) => {
    const state = get();
    const snapshot = buildSessionSnapshot(state);
    const sessionsWithSnapshot = withActiveCanvasSnapshot(
      state.canvasSessions,
      state.activeCanvasId,
      snapshot
    );
    const importedSnapshot = parseCanvasSessionSource(raw);
    const sessionId = createSessionId(sessionsWithSnapshot);
    const sessionName = resolveImportedSessionName(
      sessionsWithSnapshot,
      options?.name?.trim() ||
        importedSnapshot.name?.trim() ||
        getImportedSessionBaseName(importedSnapshot.mode)
    );
    const newSession = createImportedSession(
      sessionId,
      sessionName,
      importedSnapshot
    );
    const runtime = resolveSessionRuntime(newSession, state.tool);

    activateCanvasDocument(getSessionCanvasDocumentId(newSession, runtime.nextSlideDeck), {
      grid: runtime.nextGridEntries,
      scene: runtime.nextMode === "structured" ? runtime.nextScene : [],
      components: runtime.nextComponents,
    });

    set({
      canvasSessions: [...sessionsWithSnapshot, newSession],
      activeCanvasId: newSession.id,
      canvasMode: runtime.nextMode,
      slideDeck: runtime.nextSlideDeck,
      structuredScene: runtime.nextScene,
      structuredComponents: runtime.nextComponents,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
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

    activateCanvasDocument(getSessionCanvasDocumentId(target, runtime.nextSlideDeck), {
      grid: runtime.nextGridEntries,
      scene: runtime.nextMode === "structured" ? runtime.nextScene : [],
      components: runtime.nextComponents,
    });

    set({
      canvasSessions: sessionsWithSnapshot,
      activeCanvasId: canvasId,
      canvasMode: runtime.nextMode,
      slideDeck: runtime.nextSlideDeck,
      structuredScene: runtime.nextScene,
      structuredComponents: runtime.nextComponents,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
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
      const removedSession = sessionsWithSnapshot[removedIndex];
      destroySessionDocuments(removedSession);
      return;
    }

    const nextIndex = Math.min(removedIndex, remaining.length - 1);
    const nextSession = remaining[nextIndex];
    const runtime = resolveSessionRuntime(nextSession, state.tool);

    activateCanvasDocument(getSessionCanvasDocumentId(nextSession, runtime.nextSlideDeck), {
      grid: runtime.nextGridEntries,
      scene: runtime.nextMode === "structured" ? runtime.nextScene : [],
      components: runtime.nextComponents,
    });

    set({
      canvasSessions: remaining,
      activeCanvasId: nextSession.id,
      canvasMode: runtime.nextMode,
      slideDeck: runtime.nextSlideDeck,
      structuredScene: runtime.nextScene,
      structuredComponents: runtime.nextComponents,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      grid: createMapFromEntries(runtime.nextGridEntries),
      tool: runtime.nextTool,
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

    destroySessionDocuments(sessionsWithSnapshot[removedIndex]);
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
  setCanvasSessionCollaboration: (canvasId, collaboration, options) => {
    const state = get();
    const session = state.canvasSessions.find((item) => item.id === canvasId);
    if (!session || session.mode === "slide") return;

    const reset = !!collaboration && !!options?.resetDocument;
    if (reset) resetCanvasDocument(canvasId, { grid: [], scene: [] });

    set({
      canvasSessions: state.canvasSessions.map((item) =>
        item.mode !== "slide" && item.id === canvasId
          ? {
              ...item,
              collaboration: collaboration ?? undefined,
              ...(reset ? { grid: [], scene: [], components: [] } : {}),
            }
          : item
      ),
      ...(reset && canvasId === state.activeCanvasId
        ? {
            grid: new Map(),
            structuredScene: [],
            structuredComponents: [],
            selectedStructuredNodeIds: [],
            selections: [],
          }
        : {}),
    });
  },
});
