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
} from "../helpers/storeUtils";
import { getSlideEditingBufferId } from "../slideEditingBuffer";
import {
  withActiveCanvasSnapshot,
  normalizeSessionMode,
  createSessionId,
  resolveNextSessionName,
} from "@/domains/sessions/public";
import { createSlideDeck } from "@/domains/slides/public";
import { parseCanvasSessionSource } from "../sessionImportPort";
import {
  activateCanvasDocument,
  destroyCanvasDocument,
  getCanvasDocumentSeed,
  prepareCanvasDocumentForCollaboration,
} from "../canvasDocument";
import { sameCollaborationRoom } from "@/domains/collaboration/public";
import { createSessionActivationPatch } from "../transitions/editorTransitions";

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
      destroyCanvasDocument(getSlideEditingBufferId(session.id, slide.id))
    );
    return;
  }
  destroyCanvasDocument(session.id);
};

const activateSessionRuntime = (
  session: CanvasSession,
  currentTool: EditorState["tool"]
) => {
  const initialRuntime = resolveSessionRuntime(session, currentTool);
  activateCanvasDocument(
    getSessionCanvasDocumentId(session, initialRuntime.nextSlideDeck),
    {
      grid: initialRuntime.nextGridEntries,
      scene:
        initialRuntime.nextMode === "structured"
          ? initialRuntime.nextScene
          : [],
      components: initialRuntime.nextComponents,
    }
  );

  if (session.mode === "slide" || !session.collaboration) {
    return initialRuntime;
  }

  const collaborativeSeed = getCanvasDocumentSeed(session.id, session.mode);
  return resolveSessionRuntime(
    collaborativeSeed
      ? {
          ...session,
          grid: collaborativeSeed.grid,
          scene: collaborativeSeed.scene,
          components: collaborativeSeed.components,
        }
      : session,
    currentTool
  );
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

    const runtime = activateSessionRuntime(newSession, state.tool);
    set(
      createSessionActivationPatch(
        [...sessionsWithSnapshot, newSession],
        newSession.id,
        runtime
      )
    );

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
    const runtime = activateSessionRuntime(newSession, state.tool);
    set(
      createSessionActivationPatch(
        [...sessionsWithSnapshot, newSession],
        newSession.id,
        runtime
      )
    );

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

    const runtime = activateSessionRuntime(target, state.tool);
    set(createSessionActivationPatch(sessionsWithSnapshot, canvasId, runtime));

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
    const runtime = activateSessionRuntime(nextSession, state.tool);
    set(createSessionActivationPatch(remaining, nextSession.id, runtime));

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
  setCanvasSessionCollaboration: (canvasId, collaboration) => {
    const state = get();
    const session = state.canvasSessions.find((item) => item.id === canvasId);
    if (!session || session.mode === "slide") return;
    if (collaboration && collaboration.mode !== session.mode) return;
    if (collaboration) {
      prepareCanvasDocumentForCollaboration(canvasId, session.mode);
    }

    set({
      canvasSessions: state.canvasSessions.map((item) =>
        item.mode !== "slide" && item.id === canvasId
          ? {
              ...item,
              collaboration: collaboration ?? undefined,
            }
          : item
      ),
    });
  },
  joinCanvasSessionCollaboration: (collaboration) => {
    const existing = get().canvasSessions.find(
      (session) =>
        session.mode !== "slide" &&
        sameCollaborationRoom(session.collaboration, collaboration)
    );
    if (existing) {
      get().switchCanvasSession(existing.id);
      return;
    }

    get().createCanvasSession(collaboration.mode);
    const sessionId = get().activeCanvasId;
    get().setCanvasSessionCollaboration(sessionId, collaboration);
  },
});
