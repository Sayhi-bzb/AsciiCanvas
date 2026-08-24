import * as Y from "yjs";
import {
  IndexeddbPersistence,
  clearDocument,
  storeState,
} from "y-indexeddb";
import {
  EDITOR_PERSISTENCE_KEY,
  LEGACY_EDITOR_PERSISTENCE_KEY,
  CANVAS_CATALOG_MARKER_KEY,
  createIndexedDbCanvasCatalog,
  decodePersistedEditorState,
  type CanvasCatalog,
  type CanvasCatalogSnapshot,
  type CanvasSession,
} from "@/domains/sessions/public";
import type { SlideDeck } from "@/domains/slides/public";
import type { GridCell } from "@/shared/types";
import { gridEntriesToCellPlaneOperation } from "../cell-plane/model";
import type { CanvasStore } from "./editorStore";
import {
  CanvasDocumentRegistry,
  type CanvasDocumentSeed,
} from "./CanvasDocumentRegistry";
import { recoverPersistedEditorState } from "./editorPersistence";
import { getSessionCanvasDocumentId } from "./helpers/storeUtils";

const LOCAL_DOCUMENT_PREFIX = "chardesk-local-document-v1:";
const SAVE_DELAY = 500;
const WRITER_LOCK_NAME = "chardesk-canvas-workspace-writer-v1";
const WRITER_LEASE_KEY = "chardesk-canvas-writer-lease-v1";
const WRITER_LEASE_DURATION = 8_000;

export type CanvasPersistenceStatus = {
  phase: "restoring" | "ready" | "degraded";
  save: "saved" | "saving" | "error";
  ownership: "writer" | "reader";
  error: string | null;
};

type Listener = () => void;

type BrowserCanvasPersistenceOptions = {
  legacyStorage: Storage;
  legacyKey?: string;
};

type PersistedDocument = {
  doc: Y.Doc;
  provider: IndexeddbPersistence;
  updateListener: () => void;
};

type WriterLease = {
  writer: boolean;
  release: () => void;
};

const acquireStorageLease = (storage: Storage): WriterLease => {
  const token = crypto.randomUUID();
  const read = () => {
    try {
      return JSON.parse(storage.getItem(WRITER_LEASE_KEY) ?? "null") as {
        token?: string;
        expires?: number;
      } | null;
    } catch {
      return null;
    }
  };
  const current = read();
  if (current?.token && (current.expires ?? 0) > Date.now()) {
    return { writer: false, release: () => undefined };
  }
  const renew = () => storage.setItem(
    WRITER_LEASE_KEY,
    JSON.stringify({ token, expires: Date.now() + WRITER_LEASE_DURATION })
  );
  renew();
  if (read()?.token !== token) {
    return { writer: false, release: () => undefined };
  }
  const timer = setInterval(renew, WRITER_LEASE_DURATION / 2);
  return {
    writer: true,
    release: () => {
      clearInterval(timer);
      if (read()?.token === token) storage.removeItem(WRITER_LEASE_KEY);
    },
  };
};

const acquireWriterLease = async (storage: Storage): Promise<WriterLease> => {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return acquireStorageLease(storage);
  }
  let releaseLock!: () => void;
  const released = new Promise<void>((resolve) => { releaseLock = resolve; });
  let resolveAcquired!: (writer: boolean) => void;
  const acquired = new Promise<boolean>((resolve) => { resolveAcquired = resolve; });
  void navigator.locks.request(
    WRITER_LOCK_NAME,
    { ifAvailable: true },
    async (lock) => {
      resolveAcquired(!!lock);
      if (lock) await released;
    }
  );
  const writer = await acquired;
  return {
    writer,
    release: writer ? releaseLock : () => undefined,
  };
};

const waitForCatalog = async (catalog: CanvasCatalog) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const snapshot = await catalog.load();
    if (snapshot) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
};

const getDocumentDatabaseName = (id: string) => `${LOCAL_DOCUMENT_PREFIX}${id}`;

const emptySeed = (): CanvasDocumentSeed => ({
  grid: [],
  scene: [],
  components: [],
});

const isDocumentEmpty = (doc: Y.Doc) =>
  doc.getMap("main-grid").size === 0 &&
  doc.getArray("cell-plane-operations").length === 0 &&
  doc.getMap("structured-scene").size === 0 &&
  doc.getMap("structured-components").size === 0;

const applySeed = (doc: Y.Doc, id: string, seed: CanvasDocumentSeed) => {
  doc.transact(() => {
    const grid = doc.getMap<GridCell>("main-grid");
    seed.grid.forEach(([key, cell]) => grid.set(key, cell));
    const operation = gridEntriesToCellPlaneOperation(
      `bootstrap:${id}`,
      seed.grid
    );
    if (operation) {
      doc.getArray("cell-plane-operations").push([operation]);
    }
    const scene = doc.getMap<(typeof seed.scene)[number]>("structured-scene");
    seed.scene.forEach((node) => scene.set(node.id, node));
    const components = doc.getMap<NonNullable<typeof seed.components>[number]>(
      "structured-components"
    );
    seed.components?.forEach((component) =>
      components.set(component.id, component)
    );
    const meta = doc.getMap<unknown>("document-meta");
    meta.set("schemaVersion", 1);
    meta.set("documentId", id);
  }, "local-persistence-bootstrap");
};

const seedFromSession = (session: CanvasSession): CanvasDocumentSeed =>
  session.mode === "structured"
    ? {
        grid: [],
        scene: session.scene,
        components: session.components ?? [],
      }
    : session.mode === "freeform"
      ? { grid: session.grid, scene: [], components: [] }
      : emptySeed();

const readDocumentSeed = (
  doc: Y.Doc,
  mode: "freeform" | "structured"
): CanvasDocumentSeed => ({
  grid:
    mode === "freeform"
      ? Array.from(doc.getMap<GridCell>("main-grid").entries())
      : [],
  scene:
    mode === "structured"
      ? Array.from(
          doc
            .getMap<CanvasDocumentSeed["scene"][number]>("structured-scene")
            .values()
        )
      : [],
  components:
    mode === "structured"
      ? Array.from(
          doc
            .getMap<NonNullable<CanvasDocumentSeed["components"]>[number]>(
              "structured-components"
            )
            .values()
        )
      : [],
});

const readLegacySessions = (storage: Storage, key: string) => {
  for (const candidate of [key, LEGACY_EDITOR_PERSISTENCE_KEY]) {
    const raw = storage.getItem(candidate);
    if (!raw) continue;
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!envelope || typeof envelope !== "object" || !("state" in envelope)) {
        continue;
      }
      return {
        key: candidate,
        state: decodePersistedEditorState(
          (envelope as { state: unknown }).state
        ),
      };
    } catch {
      continue;
    }
  }
  return null;
};

const sessionsFromCatalog = (catalog: CanvasCatalogSnapshot): CanvasSession[] =>
  catalog.sessions.map((session): CanvasSession => {
    const base = {
      id: session.id,
      name: session.name,
      viewport: session.viewport,
    };
    if (session.mode === "slide") {
      const slides = catalog.slides
        .filter((slide) => slide.sessionId === session.id)
        .sort((left, right) => left.order - right.order)
        .map((slide) => ({
          id: slide.id,
          name: slide.name,
          size: slide.size,
          grid: [],
        }));
      return {
        ...base,
        mode: "slide",
        slideDeck: {
          slides,
          activeSlideId: session.activeSlideId ?? slides[0]?.id ?? "slide-1",
        },
        scene: [],
        components: [],
        grid: [],
      };
    }
    return {
      ...base,
      mode: session.mode,
      collaboration: session.collaboration,
      scene: [],
      components: [],
      grid: [],
    };
  });

const createCatalogSnapshot = (
  state: ReturnType<CanvasStore["getState"]>
): CanvasCatalogSnapshot => ({
  activeSessionId: state.activeCanvasId,
  sessions: state.canvasSessions.map((session) => ({
    id: session.id,
    name: session.name,
    mode: session.mode,
    viewport:
      session.id === state.activeCanvasId
        ? { offset: { ...state.offset }, zoom: state.zoom }
        : session.viewport,
    ...(session.mode !== "slide" && session.collaboration
      ? { collaboration: session.collaboration }
      : {}),
    ...(session.mode === "slide"
      ? { activeSlideId: session.slideDeck.activeSlideId }
      : {}),
  })),
  slides: state.canvasSessions.flatMap((session) =>
    session.mode === "slide"
      ? session.slideDeck.slides.map((slide, order) => ({
          id: slide.id,
          sessionId: session.id,
          name: slide.name,
          size: slide.size,
          order,
        }))
      : []
  ),
  preferences: {
    brushChar: state.brushChar,
    brushColor: state.brushColor,
    brushBackgroundColor: state.brushBackgroundColor,
    showGrid: state.showGrid,
    exportShowGrid: state.exportShowGrid,
  },
});

export class BrowserCanvasPersistence {
  readonly #legacyStorage: Storage;
  readonly #legacyKey: string;
  readonly #listeners = new Set<Listener>();
  readonly #documents = new Map<string, PersistedDocument>();
  #catalog: CanvasCatalog | null = null;
  #store: CanvasStore | null = null;
  #unsubscribeStore: (() => void) | null = null;
  #metadataTimer: ReturnType<typeof setTimeout> | null = null;
  #documentTimer: ReturnType<typeof setTimeout> | null = null;
  #lastCatalogJson = "";
  #writerLease: WriterLease | null = null;
  #status: CanvasPersistenceStatus = {
    phase: "restoring",
    save: "saved",
    ownership: "writer",
    error: null,
  };

  constructor(options: BrowserCanvasPersistenceOptions) {
    this.#legacyStorage = options.legacyStorage;
    this.#legacyKey = options.legacyKey ?? EDITOR_PERSISTENCE_KEY;
  }

  getSnapshot = () => this.#status;

  subscribe = (listener: Listener) => {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  };

  initialize = async (documents: CanvasDocumentRegistry, store: CanvasStore) => {
    this.#store = store;
    try {
      this.#writerLease = await acquireWriterLease(this.#legacyStorage);
      this.#publish({
        ownership: this.#writerLease.writer ? "writer" : "reader",
      });
      this.#catalog = await createIndexedDbCanvasCatalog();
      const storedCatalog = this.#writerLease.writer
        ? await this.#catalog.load()
        : await waitForCatalog(this.#catalog);
      const legacy = storedCatalog
        ? null
        : readLegacySessions(this.#legacyStorage, this.#legacyKey);
      const legacySessions = legacy?.state.sessions.items.map((session) =>
        session.id === legacy.state.sessions.activeId
          ? {
              ...session,
              viewport: {
                offset: legacy.state.workspace.offset,
                zoom: legacy.state.workspace.zoom,
              },
            }
          : session
      );
      const sourceSessions = storedCatalog
        ? sessionsFromCatalog(storedCatalog)
        : legacySessions ?? store.getState().canvasSessions;
      const activeSessionId = storedCatalog?.activeSessionId ??
        legacy?.state.sessions.activeId ??
        store.getState().activeCanvasId;
      const restoredSessions = await this.#restoreSessions(
        documents,
        sourceSessions,
        !storedCatalog && this.#writerLease.writer
      );
      const activeSession =
        restoredSessions.find((session) => session.id === activeSessionId) ??
        restoredSessions[0];
      if (!activeSession) throw new Error("Canvas persistence restored no sessions");

      const current = store.getState();
      const preferences = storedCatalog?.preferences ?? legacy?.state.preferences;
      const hydrated = recoverPersistedEditorState({
        ...current,
        canvasSessions: restoredSessions,
        activeCanvasId: activeSession.id,
        ...(preferences ?? {}),
      });
      documents.activateDocument(
        getSessionCanvasDocumentId(activeSession, hydrated.slideDeck),
        emptySeed()
      );
      store.setState(hydrated, true);
      if (this.#writerLease.writer) {
        documents.configureDocumentLifecycle({
          onCreate: (id, doc) => this.#attachDocument(id, doc),
          onDelete: (id) => { void this.#deleteDocument(id); },
        });
        await this.#saveCatalog();
        const verified = await this.#catalog.load();
        if (!verified || verified.sessions.length !== restoredSessions.length) {
          throw new Error("Canvas catalog verification failed");
        }
        if (legacy) {
          this.#legacyStorage.removeItem(legacy.key);
          this.#legacyStorage.removeItem(LEGACY_EDITOR_PERSISTENCE_KEY);
        }
        this.#legacyStorage.setItem(CANVAS_CATALOG_MARKER_KEY, "1");
        this.#subscribeToStore();
      }
      this.#publish({ phase: "ready", save: "saved", error: null });
    } catch (error) {
      documents.configureDocumentLifecycle(null);
      this.#publish({
        phase: "degraded",
        save: "error",
        error: error instanceof Error ? error.message : "Canvas persistence failed",
      });
    }
  };

  retry = async () => {
    if (!this.#catalog || !this.#store || !this.#writerLease?.writer) return;
    try {
      this.#publish({ save: "saving", error: null });
      await Promise.all(
        Array.from(this.#documents.values(), ({ provider }) =>
          storeState(provider, true)
        )
      );
      await this.#saveCatalog();
      this.#publish({ phase: "ready", save: "saved", error: null });
    } catch (error) {
      this.#publish({
        phase: "degraded",
        save: "error",
        error: error instanceof Error ? error.message : "Canvas persistence failed",
      });
    }
  };

  dispose = () => {
    this.#unsubscribeStore?.();
    this.#unsubscribeStore = null;
    if (this.#metadataTimer) clearTimeout(this.#metadataTimer);
    if (this.#documentTimer) clearTimeout(this.#documentTimer);
    this.#documents.forEach(({ doc, provider, updateListener }) => {
      doc.off("update", updateListener);
      void provider.destroy();
    });
    this.#documents.clear();
    this.#catalog?.close();
    this.#catalog = null;
    this.#writerLease?.release();
    this.#writerLease = null;
  };

  async #restoreSessions(
    documents: CanvasDocumentRegistry,
    sessions: CanvasSession[],
    resetDocuments: boolean
  ) {
    const restored: CanvasSession[] = [];
    for (const session of sessions) {
      if (session.mode === "slide") {
        const slides = [] as SlideDeck["slides"];
        for (const slide of session.slideDeck.slides) {
          const id = `${session.id}:slide:${slide.id}`;
          const doc = await this.#openDocument(
            id,
            { grid: slide.grid, scene: [], components: [] },
            resetDocuments
          );
          documents.adoptDocument(id, doc);
          slides.push({
            ...slide,
            grid: readDocumentSeed(doc, "freeform").grid,
          });
        }
        restored.push({
          ...session,
          slideDeck: { ...session.slideDeck, slides },
        });
        continue;
      }
      if (session.collaboration) {
        const doc = new Y.Doc({ guid: session.id });
        documents.adoptDocument(session.id, doc);
        restored.push({ ...session, grid: [], scene: [], components: [] });
        continue;
      }
      const doc = await this.#openDocument(
        session.id,
        seedFromSession(session),
        resetDocuments
      );
      documents.adoptDocument(session.id, doc);
      const seed = readDocumentSeed(doc, session.mode);
      restored.push({
        ...session,
        grid: seed.grid,
        scene: seed.scene,
        components: seed.components,
      });
    }
    return restored;
  }

  async #openDocument(
    id: string,
    seed: CanvasDocumentSeed,
    reset: boolean
  ) {
    const name = getDocumentDatabaseName(id);
    if (reset) await clearDocument(name);
    const doc = new Y.Doc({ guid: id });
    const provider = new IndexeddbPersistence(name, doc);
    await provider.whenSynced;
    this.#registerDocument(id, doc, provider);
    if (isDocumentEmpty(doc)) applySeed(doc, id, seed);
    await storeState(provider, true);
    return doc;
  }

  #attachDocument(id: string, doc: Y.Doc) {
    if (this.#documents.has(id)) return;
    const provider = new IndexeddbPersistence(getDocumentDatabaseName(id), doc);
    this.#registerDocument(id, doc, provider);
    void provider.whenSynced.catch((error) => this.#handleError(error));
  }

  #registerDocument(
    id: string,
    doc: Y.Doc,
    provider: IndexeddbPersistence
  ) {
    const updateListener = () => this.#scheduleDocumentFlush();
    doc.on("update", updateListener);
    this.#documents.set(id, { doc, provider, updateListener });
  }

  async #deleteDocument(id: string) {
    const current = this.#documents.get(id);
    if (current) {
      current.doc.off("update", current.updateListener);
      this.#documents.delete(id);
      await current.provider.clearData();
      return;
    }
    await clearDocument(getDocumentDatabaseName(id));
  }

  #subscribeToStore() {
    if (!this.#store) return;
    this.#lastCatalogJson = JSON.stringify(createCatalogSnapshot(this.#store.getState()));
    this.#unsubscribeStore = this.#store.subscribe((state) => {
      const nextJson = JSON.stringify(createCatalogSnapshot(state));
      if (nextJson === this.#lastCatalogJson) return;
      this.#lastCatalogJson = nextJson;
      if (this.#metadataTimer) clearTimeout(this.#metadataTimer);
      this.#publish({ save: "saving" });
      this.#metadataTimer = setTimeout(() => {
        this.#metadataTimer = null;
        void this.#saveCatalog()
          .then(() => this.#publish({ save: "saved", error: null }))
          .catch((error) => this.#handleError(error));
      }, SAVE_DELAY);
    });
  }

  #scheduleDocumentFlush() {
    if (this.#documentTimer) clearTimeout(this.#documentTimer);
    this.#publish({ save: "saving" });
    this.#documentTimer = setTimeout(() => {
      this.#documentTimer = null;
      void Promise.all(
        Array.from(this.#documents.values(), ({ provider }) =>
          storeState(provider, true)
        )
      )
        .then(() => this.#publish({ save: "saved", error: null }))
        .catch((error) => this.#handleError(error));
    }, SAVE_DELAY);
  }

  #saveCatalog() {
    if (!this.#catalog || !this.#store) {
      return Promise.reject(new Error("Canvas catalog is unavailable"));
    }
    return this.#catalog.save(createCatalogSnapshot(this.#store.getState()));
  }

  #handleError(error: unknown) {
    this.#publish({
      phase: "degraded",
      save: "error",
      error: error instanceof Error ? error.message : "Canvas persistence failed",
    });
  }

  #publish(patch: Partial<CanvasPersistenceStatus>) {
    this.#status = { ...this.#status, ...patch };
    this.#listeners.forEach((listener) => listener());
  }
}

export const createBrowserCanvasPersistence = (
  options: BrowserCanvasPersistenceOptions
) => new BrowserCanvasPersistence(options);
