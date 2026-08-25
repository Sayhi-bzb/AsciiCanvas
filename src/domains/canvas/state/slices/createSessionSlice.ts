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
  resolveSessionRuntime,
  getSessionCanvasDocumentId,
  stripSessionContent,
  stripSlideDeckContent,
} from "../helpers/storeUtils";
import { activateSlidePage } from "../slideDocumentPages";
import {
  normalizeSessionMode,
  createSessionId,
  resolveNextSessionName,
} from "@/domains/sessions/public";
import { createSlideDeck } from "@/domains/slides/public";
import type { CanvasSessionSourceParser } from "../sessionImportPort";
import type { CanvasDocumentRegistry } from "../CanvasDocumentRegistry";
import { sameCollaborationRoom } from "@/domains/collaboration/public";
import { createSessionActivationPatch } from "../transitions/editorTransitions";
import { rebuildGridFromContent } from "../helpers/gridHelpers";

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

const destroySessionDocuments = (
  documents: CanvasDocumentRegistry,
  session: CanvasSession
) => {
  documents.destroyDocument(session.id);
};

const checkpointActiveSessionViewport = (
  state: Pick<EditorState, "canvasSessions" | "activeCanvasId" | "offset" | "zoom">
): CanvasSession[] =>
  state.canvasSessions.map((session): CanvasSession => {
    if (session.id !== state.activeCanvasId) return session;
    const viewport = {
      offset: { ...state.offset },
      zoom: state.zoom,
    };
    switch (session.mode) {
      case "slide":
        return { ...session, viewport };
      case "structured":
        return { ...session, viewport };
      case "freeform":
        return { ...session, viewport };
    }
  });

const activateSessionRuntime = (
  documents: CanvasDocumentRegistry,
  session: CanvasSession,
  currentTool: EditorState["tool"]
) => {
  const initialRuntime = resolveSessionRuntime(session, currentTool);
  if (session.mode === "slide" && initialRuntime.nextSlideDeck) {
    const activeSlide = initialRuntime.nextSlideDeck.slides.find(
      (slide) => slide.id === initialRuntime.nextSlideDeck?.activeSlideId
    );
    documents.activateDocument(session.id, {
      mode: "slide",
      activePageId: initialRuntime.nextSlideDeck.activeSlideId,
      pages: initialRuntime.nextSlideDeck.slides.map((slide) => ({
        id: slide.id,
        name: slide.name,
        size: slide.size,
        kind: "cell-plane",
        grid: slide.grid,
      })),
      grid: [],
      scene: [],
      components: [],
    });
    if (activeSlide) documents.activatePage(session.id, activeSlide.id);
    return {
      ...initialRuntime,
      nextSlideDeck: stripSlideDeckContent(initialRuntime.nextSlideDeck),
      nextGridEntries: activeSlide
        ? Array.from(documents.getContentReader().materialize())
        : [],
    };
  }
  if (session.mode === "slide") return initialRuntime;
  documents.activateDocument(
    getSessionCanvasDocumentId(session),
    {
      grid:
        initialRuntime.nextMode === "structured"
          ? []
          : initialRuntime.nextGridEntries,
      scene:
        initialRuntime.nextMode === "structured"
          ? initialRuntime.nextScene
          : [],
      components: initialRuntime.nextComponents,
      mode: initialRuntime.nextMode,
    }
  );

  const documentSeed = documents.getDocumentSeed(session.id, session.mode);
  return resolveSessionRuntime(
    documentSeed
      ? {
          ...session,
          grid: documentSeed.grid,
          scene: documentSeed.scene,
          components: documentSeed.components,
        }
      : session,
    currentTool
  );
};

export const createSessionSlice = (
  documents: CanvasDocumentRegistry,
  parseSessionSource: CanvasSessionSourceParser
): StateCreator<
  EditorState,
  [],
  [],
  SessionCommands
> => (set, get) => ({
  createCanvasSession: (mode = "freeform", options) => {
    const state = get();
    const sessionsWithSnapshot = checkpointActiveSessionViewport(state);

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

    const runtime = activateSessionRuntime(documents, newSession, state.tool);
    const nextSessions = [
      ...sessionsWithSnapshot,
      stripSessionContent(newSession),
    ];
    set(
      createSessionActivationPatch(
        nextSessions,
        newSession.id,
        runtime,
        runtime.nextMode === "structured"
          ? undefined
          : rebuildGridFromContent(documents)
      )
    );

  },
  importCanvasSession: (raw, options) => {
    const state = get();
    const sessionsWithSnapshot = checkpointActiveSessionViewport(state);
    const importedSnapshot = parseSessionSource(raw);
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
    const runtime = activateSessionRuntime(documents, newSession, state.tool);
    const storedSession = stripSessionContent(newSession);
    const nextSessions = [...sessionsWithSnapshot, storedSession];
    set(
      createSessionActivationPatch(
        nextSessions,
        newSession.id,
        runtime,
        runtime.nextMode === "structured"
          ? undefined
          : rebuildGridFromContent(documents)
      )
    );

    return storedSession;
  },
  replaceCanvasSessionSnapshot: (sessionId, snapshot, options) => {
    const state = get();
    const target = state.canvasSessions.find((session) => session.id === sessionId);
    if (!target) throw new Error(`Canvas session not found: ${sessionId}`);
    if (target.mode !== snapshot.mode) {
      throw new Error(
        `Canvas snapshot mode ${snapshot.mode} does not match session mode ${target.mode}`
      );
    }

    const preservedViewport = options.preserveViewport
      ? sessionId === state.activeCanvasId
        ? { offset: { ...state.offset }, zoom: state.zoom }
        : target.viewport
      : undefined;
    const imported = createImportedSession(target.id, target.name, snapshot);
    const replacement: CanvasSession = imported.mode === "slide"
      ? {
          ...imported,
          ...(preservedViewport ? { viewport: preservedViewport } : {}),
        }
      : {
          ...imported,
          ...(target.collaboration ? { collaboration: target.collaboration } : {}),
          ...(preservedViewport ? { viewport: preservedViewport } : {}),
        };
    const storedReplacement = stripSessionContent(replacement);
    const nextSessions = state.canvasSessions.map((session) =>
      session.id === sessionId ? storedReplacement : session
    );
    const runtime = resolveSessionRuntime(replacement, state.tool);

    if (replacement.mode === "slide" && runtime.nextSlideDeck) {
      documents.activateDocument(replacement.id, {
        mode: "slide",
        activePageId: runtime.nextSlideDeck.activeSlideId,
        pages: runtime.nextSlideDeck.slides.map((slide) => ({
          id: slide.id,
          name: slide.name,
          size: slide.size,
          kind: "cell-plane",
          grid: slide.grid,
        })),
        grid: [],
        scene: [],
        components: [],
      }, { replace: true });
      if (sessionId !== state.activeCanvasId) {
        set({ canvasSessions: nextSessions });
        return;
      }
      const active = runtime.nextSlideDeck.slides.find(
        (slide) => slide.id === runtime.nextSlideDeck?.activeSlideId
      );
      if (!active) return;
      const activeGrid = activateSlidePage(
        documents,
        replacement.id,
        active.id,
        active.grid
      );
      if (options.resetHistory) documents.clearHistory();
      set(createSessionActivationPatch(
        nextSessions,
        sessionId,
        { ...runtime, nextSlideDeck: stripSlideDeckContent(runtime.nextSlideDeck) },
        activeGrid
      ));
      return;
    }

    if (sessionId !== state.activeCanvasId) {
      documents.resetDocument(replacement.id, {
        mode: runtime.nextMode,
        grid: runtime.nextMode === "structured" ? [] : runtime.nextGridEntries,
        scene: runtime.nextMode === "structured" ? runtime.nextScene : [],
        components: runtime.nextComponents,
      });
      set({ canvasSessions: nextSessions });
      return;
    }

    documents.activateDocument(
      getSessionCanvasDocumentId(replacement),
      {
        mode: runtime.nextMode,
        grid: runtime.nextMode === "structured" ? [] : runtime.nextGridEntries,
        scene: runtime.nextMode === "structured" ? runtime.nextScene : [],
        components: runtime.nextComponents,
      },
      { replace: true }
    );
    if (options.resetHistory) documents.clearHistory();
    set(createSessionActivationPatch(
      nextSessions,
      sessionId,
      runtime,
      runtime.nextMode === "structured"
        ? undefined
        : rebuildGridFromContent(documents)
    ));
  },
  switchCanvasSession: (canvasId) => {
    const state = get();
    if (canvasId === state.activeCanvasId) return;

    const sessionsWithSnapshot = checkpointActiveSessionViewport(state);
    const target = sessionsWithSnapshot.find(
      (session) => session.id === canvasId
    );
    if (!target) return;

    const runtime = activateSessionRuntime(documents, target, state.tool);
    set(
      createSessionActivationPatch(
        sessionsWithSnapshot,
        canvasId,
        runtime,
        runtime.nextMode === "structured"
          ? undefined
          : rebuildGridFromContent(documents)
      )
    );

  },
  removeCanvasSession: (canvasId) => {
    const state = get();
    if (state.canvasSessions.length <= 1) return;

    const sessionsWithSnapshot = checkpointActiveSessionViewport(state);
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
      destroySessionDocuments(documents, removedSession);
      return;
    }

    const nextIndex = Math.min(removedIndex, remaining.length - 1);
    const nextSession = remaining[nextIndex];
    const runtime = activateSessionRuntime(documents, nextSession, state.tool);
    set(
      createSessionActivationPatch(
        remaining,
        nextSession.id,
        runtime,
        runtime.nextMode === "structured"
          ? undefined
          : rebuildGridFromContent(documents)
      )
    );

    destroySessionDocuments(documents, sessionsWithSnapshot[removedIndex]);
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
      documents.prepareDocumentForCollaboration(canvasId, session.mode);
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
