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
import type { GridCell } from "@/shared/types";
import {
  CellPlaneIndex,
  isCellPlaneOperation,
  type CellPlaneOperation,
} from "../cell-plane/model";
import type { CanvasStore } from "./editorStore";
import {
  CanvasDocumentRegistry,
  type CanvasDocumentSeed,
} from "./CanvasDocumentRegistry";
import { recoverPersistedEditorState } from "./editorPersistence";
import { getSessionCanvasDocumentId } from "./helpers/storeUtils";
import { rebuildGridFromContent } from "./helpers/gridHelpers";
import {
  createCanvasYPage,
  getCanvasDocumentRoot,
  getDefaultCanvasPageId,
  readCanvasPageOrder,
  readCanvasYPage,
  writeCanvasDocumentMetadata,
  type CanvasPageDraft,
} from "./canvasDocumentModel";

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

const isDocumentEmpty = (doc: Y.Doc) => {
  const root = getCanvasDocumentRoot(doc);
  const operations = doc.share.get("cell-plane-operations");
  const scene = doc.share.get("structured-scene");
  const components = doc.share.get("structured-components");
  return root.pages.size === 0 &&
    (!(operations instanceof Y.Array) || operations.length === 0) &&
    (!(scene instanceof Y.Map) || scene.size === 0) &&
    (!(components instanceof Y.Map) || components.size === 0);
};

const resolveSeedPages = (
  id: string,
  seed: CanvasDocumentSeed
): CanvasPageDraft[] => {
  if (seed.pages?.length) return seed.pages;
  const kind = seed.mode === "structured" ? "structured" : "cell-plane";
  return [{
    id: seed.activePageId ?? getDefaultCanvasPageId(id),
    kind,
    ...(kind === "structured"
      ? { scene: seed.scene, components: seed.components ?? [] }
      : { grid: seed.grid }),
  }];
};

const applySeed = (doc: Y.Doc, id: string, seed: CanvasDocumentSeed) => {
  doc.transact(() => {
    const root = getCanvasDocumentRoot(doc);
    const pages = resolveSeedPages(id, seed);
    pages.forEach((page) =>
      createCanvasYPage(root, page, `bootstrap:${id}:${page.id}`)
    );
    const activePageId =
      seed.activePageId && pages.some((page) => page.id === seed.activePageId)
        ? seed.activePageId
        : pages[0]!.id;
    writeCanvasDocumentMetadata(
      root,
      id,
      seed.mode ?? (pages[0]!.kind === "structured" ? "structured" : "freeform"),
      activePageId
    );
  }, "local-persistence-bootstrap");
};

const seedFromSession = (session: CanvasSession): CanvasDocumentSeed =>
  session.mode === "structured"
      ? {
        mode: "structured",
        grid: [],
        scene: session.scene,
        components: session.components ?? [],
      }
    : session.mode === "freeform"
      ? { mode: "freeform", grid: session.grid, scene: [], components: [] }
      : emptySeed();

const readCellPlaneGrid = (doc: Y.Doc): [string, GridCell][] => {
  const root = getCanvasDocumentRoot(doc);
  const activePageId = root.meta.get("activePageId");
  const pageId =
    typeof activePageId === "string"
      ? activePageId
      : readCanvasPageOrder(root)[0];
  const page = pageId ? readCanvasYPage(root, pageId) : null;
  const operations = page?.operations ??
    doc.getArray<CellPlaneOperation>("cell-plane-operations");
  return Array.from(new CellPlaneIndex(operations.toArray()).materialize());
};

const migrateLegacyDocument = (doc: Y.Doc, id: string) => {
  const root = getCanvasDocumentRoot(doc);
  if (root.pages.size > 0) return;
  const legacyGrid = doc.share.get("main-grid");
  const operations = doc.share.get("cell-plane-operations");
  const legacyScene = doc.share.get("structured-scene");
  const legacyComponents = doc.share.get("structured-components");
  if (
    (!(legacyGrid instanceof Y.Map) || legacyGrid.size === 0) &&
    (!(operations instanceof Y.Array) || operations.length === 0) &&
    (!(legacyScene instanceof Y.Map) || legacyScene.size === 0) &&
    (!(legacyComponents instanceof Y.Map) || legacyComponents.size === 0)
  ) return;
  doc.transact(() => {
    const pageId = getDefaultCanvasPageId(id);
    const structured =
      (legacyScene instanceof Y.Map && legacyScene.size > 0) ||
      (legacyComponents instanceof Y.Map && legacyComponents.size > 0);
    const grid = legacyGrid instanceof Y.Map && legacyGrid.size > 0
      ? Array.from(legacyGrid.entries()) as [string, GridCell][]
      : Array.from(new CellPlaneIndex(
          operations instanceof Y.Array
            ? operations.toArray().filter(isCellPlaneOperation)
            : []
        ).materialize());
    createCanvasYPage(root, {
      id: pageId,
      kind: structured ? "structured" : "cell-plane",
      ...(structured
        ? {
            scene: legacyScene instanceof Y.Map
              ? Array.from(legacyScene.values()) as CanvasDocumentSeed["scene"]
              : [],
            components: legacyComponents instanceof Y.Map
              ? Array.from(legacyComponents.values()) as NonNullable<CanvasDocumentSeed["components"]>
              : [],
          }
        : { grid }),
    }, `legacy-bootstrap:${id}`);
    if (legacyGrid instanceof Y.Map) legacyGrid.clear();
    if (operations instanceof Y.Array) operations.delete(0, operations.length);
    if (legacyScene instanceof Y.Map) legacyScene.clear();
    if (legacyComponents instanceof Y.Map) legacyComponents.clear();
    writeCanvasDocumentMetadata(
      root,
      id,
      structured ? "structured" : "freeform",
      pageId
    );
  }, "local-persistence-migration");
};

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
        getSessionCanvasDocumentId(activeSession),
        emptySeed()
      );
      if (hydrated.canvasMode !== "structured") {
        hydrated.grid = rebuildGridFromContent(documents);
      }
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
        const initialDraft = resetDocuments
          ? documents.getDocumentDraft(session.id)
          : null;
        const pages = initialDraft?.mode === "slide"
          ? initialDraft.pages
          : await Promise.all(
              session.slideDeck.slides.map(async (slide) => ({
                id: slide.id,
                name: slide.name,
                size: slide.size,
                kind: "cell-plane" as const,
                grid: slide.grid.length > 0 || resetDocuments
                  ? slide.grid
                  : await this.#readLegacySlideGrid(session.id, slide.id),
              }))
            );
        const doc = await this.#openDocument(
          session.id,
          {
            mode: "slide",
            activePageId: session.slideDeck.activeSlideId,
            pages,
            grid: [],
            scene: [],
            components: [],
          },
          resetDocuments
        );
        documents.adoptDocument(session.id, doc);
        restored.push(session);
        continue;
      }
      if (session.collaboration) {
        const doc = new Y.Doc({ guid: session.id });
        documents.adoptDocument(session.id, doc);
        restored.push({ ...session, grid: [], scene: [], components: [] });
        continue;
      }
      const existingSeed = documents.getDocumentSeed(session.id, session.mode);
      const doc = await this.#openDocument(
        session.id,
        existingSeed ?? seedFromSession(session),
        resetDocuments
      );
      documents.adoptDocument(session.id, doc);
      const seed = documents.getDocumentSeed(session.id, session.mode);
      restored.push({
        ...session,
        grid: seed?.grid ?? [],
        scene: seed?.scene ?? [],
        components: seed?.components ?? [],
      });
    }
    return restored;
  }

  async #readLegacySlideGrid(sessionId: string, slideId: string) {
    const id = `${sessionId}:slide:${slideId}`;
    const doc = new Y.Doc({ guid: id });
    const provider = new IndexeddbPersistence(getDocumentDatabaseName(id), doc);
    try {
      await provider.whenSynced;
      migrateLegacyDocument(doc, id);
      return readCellPlaneGrid(doc);
    } finally {
      await provider.destroy();
      doc.destroy();
    }
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
    migrateLegacyDocument(doc, id);
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
