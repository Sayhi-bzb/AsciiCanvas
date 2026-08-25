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
import { SLIDE_SIZE_PRESETS } from "@/domains/slides/public";
import type { GridCell } from "@/shared/types";
import {
  CellPlaneIndex,
  gridEntriesToCellPlaneOperation,
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
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  createCanvasYPage,
  getCanvasDocumentRoot,
  getDefaultCanvasPageId,
  readCanvasPageDescriptor,
  readCanvasPageOrder,
  readCanvasYPage,
  writeCanvasDocumentMetadata,
  type CanvasPageDraft,
} from "./canvasDocumentModel";

const LOCAL_DOCUMENT_PREFIX = "chardesk-local-document-v1:";
const HISTORICAL_EDITOR_PERSISTENCE_KEYS = [
  "ascii-canvas-persistence-v4-backup",
  "ascii-canvas-persistence-v3-backup",
] as const;
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

const PAGE_CHANNEL_PATTERN =
  /^canvas-page:([^:]+):(cell-plane-operations|structured-scene|structured-components)$/;

const readPageChannelIds = (doc: Y.Doc) => {
  const ids = new Set<string>();
  for (const name of doc.share.keys()) {
    const match = PAGE_CHANNEL_PATTERN.exec(name);
    if (!match) continue;
    try {
      const id = decodeURIComponent(match[1]!);
      if (id.length > 0) ids.add(id);
    } catch {
      // A malformed channel name is retained but cannot address a Canvas page.
    }
  }
  return ids;
};

const hasLegacyContent = (doc: Y.Doc) => {
  return doc.getMap("main-grid").size > 0 ||
    doc.getArray("cell-plane-operations").length > 0 ||
    doc.getMap("structured-scene").size > 0 ||
    doc.getMap("structured-components").size > 0;
};

const clearLegacyContent = (doc: Y.Doc) => {
  const grid = doc.getMap("main-grid");
  const operations = doc.getArray("cell-plane-operations");
  const scene = doc.getMap("structured-scene");
  const components = doc.getMap("structured-components");
  doc.transact(() => {
    grid.clear();
    operations.delete(0, operations.length);
    scene.clear();
    components.clear();
  }, "local-persistence-migration-cleanup");
};

const hasValidPages = (doc: Y.Doc) => {
  const root = getCanvasDocumentRoot(doc);
  return readCanvasPageOrder(root).some((id) => !!readCanvasYPage(root, id));
};

const isDocumentEmpty = (doc: Y.Doc) => {
  return !hasValidPages(doc) &&
    readPageChannelIds(doc).size === 0 &&
    !hasLegacyContent(doc);
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

const readNestedType = (
  value: unknown,
  keys: string[]
) => {
  if (!(value instanceof Y.Map)) return null;
  for (const key of keys) {
    const candidate = value.get(key);
    if (candidate instanceof Y.AbstractType) return candidate;
  }
  return null;
};

const replacePageOrder = (
  order: Y.Array<string>,
  pageIds: string[]
) => {
  const current = order.toArray();
  if (
    current.length === pageIds.length &&
    current.every((id, index) => id === pageIds[index])
  ) return;
  order.delete(0, order.length);
  if (pageIds.length > 0) order.push(pageIds);
};

const migrateLegacyDocument = (
  doc: Y.Doc,
  id: string,
  seed: CanvasDocumentSeed
) => {
  const root = getCanvasDocumentRoot(doc);
  const seedPages = resolveSeedPages(id, seed);
  const seedById = new Map(seedPages.map((page) => [page.id, page]));
  const storedPageIds = readCanvasPageOrder(root)
    .filter((pageId) => pageId.length > 0);
  const pageIds = Array.from(new Set([
    ...storedPageIds,
    ...readPageChannelIds(doc),
  ]));
  const legacyGrid = doc.getMap<GridCell>("main-grid");
  const operations = doc.getArray<CellPlaneOperation>("cell-plane-operations");
  const legacyScene = doc.getMap<CanvasDocumentSeed["scene"][number]>(
    "structured-scene"
  );
  const legacyComponents = doc.getMap<NonNullable<CanvasDocumentSeed["components"]>[number]>(
    "structured-components"
  );
  const legacyContent = hasLegacyContent(doc);
  if (pageIds.length === 0 && legacyContent) {
    pageIds.push(seed.activePageId ?? getDefaultCanvasPageId(id));
  }
  if (pageIds.length === 0) return false;

  const validCurrentDocument =
    root.meta.get("schemaVersion") === CANVAS_DOCUMENT_SCHEMA_VERSION &&
    !legacyContent &&
    pageIds.every((pageId) => {
      const value = root.pages.get(pageId);
      return !(value instanceof Y.Map) &&
        !!readCanvasPageDescriptor(pageId, value);
    }) &&
    root.pageOrder.toArray().length === pageIds.length &&
    root.pageOrder.toArray().every((pageId, index) => pageId === pageIds[index]);
  if (validCurrentDocument) return false;

  doc.transact(() => {
    pageIds.forEach((pageId, index) => {
      const rawDescriptor = root.pages.get(pageId);
      const currentDescriptor = readCanvasPageDescriptor(pageId, rawDescriptor);
      const seedPage = seedById.get(pageId);
      const prefix = `canvas-page:${encodeURIComponent(pageId)}:`;
      const pageOperations = doc.getArray<CellPlaneOperation>(
        prefix + "cell-plane-operations"
      );
      const pageScene = doc.getMap<CanvasDocumentSeed["scene"][number]>(
        prefix + "structured-scene"
      );
      const pageComponents = doc.getMap<NonNullable<CanvasDocumentSeed["components"]>[number]>(
        prefix + "structured-components"
      );
      const nestedOperations = readNestedType(
        rawDescriptor,
        ["operations", "cell-plane-operations"]
      );
      const nestedScene = readNestedType(
        rawDescriptor,
        ["scene", "structured-scene"]
      );
      const nestedComponents = readNestedType(
        rawDescriptor,
        ["components", "structured-components"]
      );
      if (pageOperations.length === 0 && nestedOperations instanceof Y.Array) {
        const valid = nestedOperations.toArray().filter(isCellPlaneOperation);
        if (valid.length > 0) pageOperations.push(valid);
      }
      if (pageScene.size === 0 && nestedScene instanceof Y.Map) {
        nestedScene.forEach((value, key) => pageScene.set(key, value));
      }
      if (pageComponents.size === 0 && nestedComponents instanceof Y.Map) {
        nestedComponents.forEach((value, key) => pageComponents.set(key, value));
      }

      const rootMode = root.meta.get("mode");
      const kind = seedPage?.kind ?? currentDescriptor?.kind ??
        (seed.mode === "structured" || rootMode === "structured" ||
            pageScene.size > 0 || pageComponents.size > 0
          ? "structured"
          : "cell-plane");
      if (index === 0 && kind === "cell-plane" && pageOperations.length === 0) {
        const legacyOperation = legacyGrid.size > 0
          ? gridEntriesToCellPlaneOperation(
              `legacy-bootstrap:${id}:${pageId}`,
              Array.from(legacyGrid.entries()) as [string, GridCell][]
            )
          : null;
        if (legacyOperation) pageOperations.push([legacyOperation]);
        else {
          const valid = operations.toArray().filter(isCellPlaneOperation);
          if (valid.length > 0) pageOperations.push(valid);
        }
      }
      if (index === 0 && kind === "structured") {
        if (pageScene.size === 0) {
          legacyScene.forEach((value, key) => pageScene.set(key, value));
        }
        if (pageComponents.size === 0) {
          legacyComponents.forEach((value, key) => pageComponents.set(key, value));
        }
      }
      root.pages.set(pageId, {
        id: pageId,
        kind,
        ...(seedPage?.name ?? currentDescriptor?.name
          ? { name: seedPage?.name ?? currentDescriptor?.name }
          : {}),
        ...(seedPage?.size ?? currentDescriptor?.size
          ? { size: seedPage?.size ?? currentDescriptor?.size }
          : {}),
      });
    });
    Array.from(root.pages.keys()).forEach((pageId) => {
      if (!pageIds.includes(pageId)) root.pages.delete(pageId);
    });
    replacePageOrder(root.pageOrder, pageIds);
    const storedActivePageId = root.meta.get("activePageId");
    const activePageId =
      seed.activePageId && pageIds.includes(seed.activePageId)
        ? seed.activePageId
        : typeof storedActivePageId === "string" && pageIds.includes(storedActivePageId)
          ? storedActivePageId
          : pageIds[0]!;
    const activeDescriptor = readCanvasPageDescriptor(
      activePageId,
      root.pages.get(activePageId)
    );
    writeCanvasDocumentMetadata(
      root,
      id,
      seed.mode ??
        (activeDescriptor?.kind === "structured" ? "structured" : "freeform"),
      activePageId
    );
  }, "local-persistence-migration");
  if (!hasValidPages(doc)) {
    throw new Error(`Canvas document migration produced no valid pages: ${id}`);
  }
  return true;
};

type LegacySessionSnapshot = {
  key: string;
  state: ReturnType<typeof decodePersistedEditorState>;
};

const readLegacySessionSnapshots = (
  storage: Storage,
  key: string
): LegacySessionSnapshot[] => {
  const snapshots: LegacySessionSnapshot[] = [];
  for (const candidate of [
    key,
    LEGACY_EDITOR_PERSISTENCE_KEY,
    ...HISTORICAL_EDITOR_PERSISTENCE_KEYS,
  ]) {
    const raw = storage.getItem(candidate);
    if (!raw) continue;
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!envelope || typeof envelope !== "object" || !("state" in envelope)) {
        continue;
      }
      snapshots.push({
        key: candidate,
        state: decodePersistedEditorState(
          (envelope as { state: unknown }).state
        ),
      });
    } catch {
      continue;
    }
  }
  return snapshots;
};

const listPersistedDocumentIds = async () => {
  if (typeof indexedDB === "undefined" || !indexedDB.databases) return [];
  try {
    const databases = await indexedDB.databases();
    return databases.flatMap(({ name }) => {
      if (!name?.startsWith(LOCAL_DOCUMENT_PREFIX)) return [];
      const id = name.slice(LOCAL_DOCUMENT_PREFIX.length);
      return id && !id.includes(":slide:") ? [id] : [];
    });
  } catch {
    return [];
  }
};

const readPersistedDocumentShell = async (
  id: string,
  recoveredIndex: number
): Promise<CanvasSession | null> => {
  const doc = new Y.Doc({ guid: id });
  const provider = new IndexeddbPersistence(getDocumentDatabaseName(id), doc);
  try {
    await provider.whenSynced;
    const root = getCanvasDocumentRoot(doc);
    const pageIds = readCanvasPageOrder(root);
    if (
      pageIds.length === 0 &&
      readPageChannelIds(doc).size === 0 &&
      !hasLegacyContent(doc)
    ) return null;
    const mode = root.meta.get("mode");
    const name = `Recovered Canvas ${recoveredIndex + 1}`;
    if (mode === "slide") {
      const slides = pageIds.flatMap((pageId, index) => {
        const descriptor = readCanvasPageDescriptor(pageId, root.pages.get(pageId));
        if (!descriptor) return [];
        return [{
          id: pageId,
          name: descriptor.name?.trim() || `Slide ${index + 1}`,
          size: descriptor.size ?? { ...SLIDE_SIZE_PRESETS.widescreen },
          grid: [],
        }];
      });
      if (slides.length === 0) return null;
      const activePageId = root.meta.get("activePageId");
      return {
        id,
        name,
        mode: "slide",
        slideDeck: {
          slides,
          activeSlideId:
            typeof activePageId === "string" &&
            slides.some((slide) => slide.id === activePageId)
              ? activePageId
              : slides[0]!.id,
        },
        scene: [],
        components: [],
        grid: [],
      };
    }
    const structured = mode === "structured" ||
      doc.getMap("structured-scene").size > 0 ||
      pageIds.some((pageId) =>
        readCanvasPageDescriptor(pageId, root.pages.get(pageId))?.kind ===
          "structured"
      );
    return {
      id,
      name,
      mode: structured ? "structured" : "freeform",
      scene: [],
      components: [],
      grid: [],
    };
  } finally {
    await provider.destroy();
    doc.destroy();
  }
};

const isBootstrapCatalogSession = (
  session: Pick<CanvasSession, "name" | "mode">,
  initial: CanvasSession | undefined
) => !!initial && session.name === initial.name && session.mode === initial.mode;

const mergeRecoverableSessions = (
  catalogSessions: CanvasSession[],
  snapshots: LegacySessionSnapshot[],
  persistedDocumentIds: readonly string[],
  initialSessions: readonly CanvasSession[]
) => {
  if (persistedDocumentIds.length === 0) return catalogSessions;
  const persisted = new Set(persistedDocumentIds);
  const catalog = new Map(catalogSessions.map((session) => [session.id, session]));
  const initial = new Map(initialSessions.map((session) => [session.id, session]));
  const recovered: CanvasSession[] = [];
  const seen = new Set<string>();

  for (const snapshot of snapshots) {
    for (const historical of snapshot.state.sessions.items) {
      if (seen.has(historical.id) || !persisted.has(historical.id)) continue;
      const current = catalog.get(historical.id);
      recovered.push(
        current && !isBootstrapCatalogSession(current, initial.get(current.id))
          ? current
          : historical
      );
      seen.add(historical.id);
    }
  }
  for (const session of catalogSessions) {
    if (seen.has(session.id)) continue;
    recovered.push(session);
    seen.add(session.id);
  }
  return recovered;
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
      const legacySnapshots = readLegacySessionSnapshots(
        this.#legacyStorage,
        this.#legacyKey
      );
      const legacy = storedCatalog
        ? null
        : legacySnapshots.find(({ key }) =>
            key === this.#legacyKey || key === LEGACY_EDITOR_PERSISTENCE_KEY
          ) ?? null;
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
      const initialSessions = store.getState().canvasSessions;
      const catalogSessions = storedCatalog
        ? sessionsFromCatalog(storedCatalog)
        : legacySessions ?? initialSessions;
      const persistedDocumentIds = await listPersistedDocumentIds();
      const recoveredCatalogSessions = mergeRecoverableSessions(
        catalogSessions,
        legacySnapshots,
        persistedDocumentIds,
        initialSessions
      );
      const knownSessionIds = new Set(
        recoveredCatalogSessions.map(({ id }) => id)
      );
      const recoveredDocumentShells = (await Promise.all(
        persistedDocumentIds
          .filter((id) => !knownSessionIds.has(id))
          .map((id, index) => readPersistedDocumentShell(id, index))
      )).filter((session): session is CanvasSession => session !== null);
      const sourceSessions = [
        ...recoveredCatalogSessions,
        ...recoveredDocumentShells,
      ];
      const catalogIsBootstrap = !!storedCatalog && storedCatalog.sessions.every(
        (session) => isBootstrapCatalogSession(
          session,
          initialSessions.find(({ id }) => id === session.id)
        )
      );
      const recoveredActiveId = legacySnapshots.find(({ state }) =>
        sourceSessions.some(({ id }) => id === state.sessions.activeId)
      )?.state.sessions.activeId;
      const activeSessionId = catalogIsBootstrap
        ? recoveredActiveId ?? storedCatalog?.activeSessionId ??
          store.getState().activeCanvasId
        : storedCatalog?.activeSessionId ??
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
          }
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
        existingSeed ?? seedFromSession(session)
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
      migrateLegacyDocument(doc, id, {
        mode: "freeform",
        grid: [],
        scene: [],
        components: [],
      });
      return readCellPlaneGrid(doc);
    } finally {
      await provider.destroy();
      doc.destroy();
    }
  }

  async #openDocument(
    id: string,
    seed: CanvasDocumentSeed
  ) {
    const name = getDocumentDatabaseName(id);
    const doc = new Y.Doc({ guid: id });
    const provider = new IndexeddbPersistence(name, doc);
    await provider.whenSynced;
    const migrated = migrateLegacyDocument(doc, id, seed);
    this.#registerDocument(id, doc, provider);
    if (isDocumentEmpty(doc)) applySeed(doc, id, seed);
    await storeState(provider, true);
    if (migrated && hasLegacyContent(doc)) {
      clearLegacyContent(doc);
      await storeState(provider, true);
    }
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
