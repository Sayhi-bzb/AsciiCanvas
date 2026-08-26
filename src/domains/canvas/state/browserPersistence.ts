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
  isEncodedCellPlaneOperation,
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
  getCanvasDocumentRoot,
  getDefaultCanvasPageId,
  readCanvasPageDescriptor,
  readCanvasPageOrder,
  readCanvasYPage,
  writeCanvasDocumentMetadata,
} from "./canvasDocumentModel";
import type { CanvasDocumentResidency } from "./documentResidencyPort";
import {
  applyCanvasDocumentSeed,
  createCompactedDocument,
  readDocumentSeed,
  resolveSeedPages,
} from "./canvasCheckpointDocument";
import {
  CanvasCheckpointWorkerClient,
} from "./canvasCheckpointWorkerClient";
import { encodeCanvasCheckpointSnapshot } from "./canvasCheckpointSnapshot";
import type { CanvasCheckpointTailEntry } from "./canvasCheckpointProtocol";
import {
  CanvasCheckpointService,
  type CanvasCheckpointCandidate,
  type CanvasCheckpointDiagnostics,
} from "./CanvasCheckpointService";

const LOCAL_DOCUMENT_PREFIX = "chardesk-local-document-v1:";
const HISTORICAL_EDITOR_PERSISTENCE_KEYS = [
  "ascii-canvas-persistence-v4-backup",
  "ascii-canvas-persistence-v3-backup",
] as const;
const SAVE_DELAY = 500;
const DOCUMENT_GENERATION_SUFFIX = ":generation:";
const DOCUMENT_STRUCT_ROTATION_THRESHOLD = 10_000;
const CHECKPOINT_IDLE_DELAY = 5_000;
const WRITER_LOCK_NAME = "chardesk-canvas-workspace-writer-v1";
const WRITER_LEASE_KEY = "chardesk-canvas-writer-lease-v1";
const WRITER_LEASE_DURATION = 8_000;
const MAX_RESIDENT_CANVASES = 4;

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

type BrowserCheckpointCandidate = CanvasCheckpointCandidate & {
  id: string;
  databaseName: string;
  taskId: number;
  doc: Y.Doc | null;
  provider: IndexeddbPersistence | null;
  digest: string | null;
  snapshotBytes: number;
  reclaimedBytes: number;
  committed: boolean;
};

type PersistedDocumentLocation = {
  id: string;
  generation: number;
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

const getDocumentDatabaseName = (id: string, generation = 0) =>
  `${LOCAL_DOCUMENT_PREFIX}${id}${generation > 0
    ? `${DOCUMENT_GENERATION_SUFFIX}${generation}`
    : ""}`;

const parseDocumentDatabaseName = (
  name: string
): PersistedDocumentLocation | null => {
  if (!name.startsWith(LOCAL_DOCUMENT_PREFIX)) return null;
  const rawId = name.slice(LOCAL_DOCUMENT_PREFIX.length);
  const generationMatch = /:generation:(\d+)$/.exec(rawId);
  const id = generationMatch
    ? rawId.slice(0, generationMatch.index)
    : rawId;
  if (!id || id.includes(":slide:")) return null;
  return {
    id,
    generation: generationMatch ? Number(generationMatch[1]) : 0,
  };
};

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

const hasValidPages = (doc: Y.Doc) => {
  const root = getCanvasDocumentRoot(doc);
  return readCanvasPageOrder(root).some((id) => !!readCanvasYPage(root, id));
};

const isDocumentEmpty = (doc: Y.Doc) => {
  return !hasValidPages(doc) &&
    readPageChannelIds(doc).size === 0 &&
    !hasLegacyContent(doc);
};

const countDocumentStructs = (doc: Y.Doc) => {
  let count = 0;
  doc.store.clients.forEach((structs) => { count += structs.length; });
  return count;
};

const getDocumentAuthorityMetrics = (doc: Y.Doc) => {
  const root = getCanvasDocumentRoot(doc);
  let operations = 0;
  let authorityPayloadBytes = 0;
  readCanvasPageOrder(root).forEach((pageId) => {
    const page = readCanvasYPage(root, pageId);
    if (page?.descriptor.kind === "structured") {
      page.scene.forEach((value) => {
        authorityPayloadBytes += JSON.stringify(value).length * 2;
      });
      page.components.forEach((value) => {
        authorityPayloadBytes += JSON.stringify(value).length * 2;
      });
    }
    page?.operations.forEach((operation) => {
      if (!isCellPlaneOperation(operation)) return;
      operations += 1;
      authorityPayloadBytes += "payload" in operation
        ? operation.payload.byteLength
        : JSON.stringify(operation.rows).length * 2;
    });
  });
  return {
    yjsStructs: countDocumentStructs(doc),
    operations,
    authorityPayloadBytes,
  };
};

const hasLegacyCellPlaneOperations = (doc: Y.Doc) => {
  const root = getCanvasDocumentRoot(doc);
  return readCanvasPageOrder(root).some((pageId) => {
    const page = readCanvasYPage(root, pageId);
    return page?.operations.toArray().some(
      (operation) =>
        isCellPlaneOperation(operation) && !isEncodedCellPlaneOperation(operation)
    ) ?? false;
  });
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

const listPersistedDocuments = async (): Promise<PersistedDocumentLocation[]> => {
  if (typeof indexedDB === "undefined" || !indexedDB.databases) return [];
  try {
    const databases = await indexedDB.databases();
    return databases.flatMap(({ name }) =>
      name ? [parseDocumentDatabaseName(name)].filter(
        (location): location is PersistedDocumentLocation => location !== null
      ) : []
    );
  } catch {
    return [];
  }
};

const readPersistedDocumentShell = async (
  id: string,
  recoveredIndex: number,
  generation = 0
): Promise<CanvasSession | null> => {
  const doc = new Y.Doc({ guid: id });
  const provider = new IndexeddbPersistence(
    getDocumentDatabaseName(id, generation),
    doc
  );
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
  state: ReturnType<CanvasStore["getState"]>,
  documentGenerations: ReadonlyMap<string, number> = new Map()
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
    ...(documentGenerations.get(session.id)
      ? { documentGeneration: documentGenerations.get(session.id) }
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

export class BrowserCanvasPersistence implements CanvasDocumentResidency {
  readonly #legacyStorage: Storage;
  readonly #legacyKey: string;
  readonly #listeners = new Set<Listener>();
  readonly #documents = new Map<string, PersistedDocument>();
  readonly #dirtyDocuments = new Map<string, number>();
  readonly #documentGenerations = new Map<string, number>();
  readonly #documentRevisions = new Map<string, number>();
  readonly #checkpointServices = new Map<
    string,
    CanvasCheckpointService<BrowserCheckpointCandidate>
  >();
  readonly #checkpointTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #checkpointTails = new Map<string, CanvasCheckpointTailEntry[]>();
  readonly #checkpointWorker = new CanvasCheckpointWorkerClient();
  readonly #obsoleteDocumentDatabases = new Set<string>();
  readonly #pinnedCanvasIds = new Set<string>();
  readonly #recentCanvasIds: string[] = [];
  #registry: CanvasDocumentRegistry | null = null;
  #catalog: CanvasCatalog | null = null;
  #store: CanvasStore | null = null;
  #unsubscribeStore: (() => void) | null = null;
  #unsubscribeMutations: (() => void) | null = null;
  #metadataTimer: ReturnType<typeof setTimeout> | null = null;
  #documentTimer: ReturnType<typeof setTimeout> | null = null;
  #evictionTask: Promise<void> = Promise.resolve();
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

  initialize = async (
    documents: CanvasDocumentRegistry,
    store: CanvasStore,
    bootstrapSessions?: readonly CanvasSession[]
  ) => {
    this.#registry = documents;
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
      const initialSessions = bootstrapSessions?.map((session) =>
        structuredClone(session)
      ) ?? store.getState().canvasSessions;
      const catalogSessions = storedCatalog
        ? sessionsFromCatalog(storedCatalog)
        : legacySessions ?? initialSessions;
      const persistedDocuments = await listPersistedDocuments();
      const latestPersistedGeneration = new Map<string, number>();
      persistedDocuments.forEach(({ id, generation }) => {
        latestPersistedGeneration.set(
          id,
          Math.max(latestPersistedGeneration.get(id) ?? 0, generation)
        );
      });
      storedCatalog?.sessions.forEach((session) => {
        this.#documentGenerations.set(
          session.id,
          session.documentGeneration ?? 0
        );
      });
      latestPersistedGeneration.forEach((generation, id) => {
        if (!this.#documentGenerations.has(id)) {
          this.#documentGenerations.set(id, generation);
        }
      });
      persistedDocuments.forEach(({ id, generation }) => {
        const activeGeneration = this.#documentGenerations.get(id) ?? 0;
        if (
          generation !== activeGeneration &&
          generation !== activeGeneration - 1
        ) {
          this.#obsoleteDocumentDatabases.add(
            getDocumentDatabaseName(id, generation)
          );
        }
      });
      const persistedDocumentIds = Array.from(latestPersistedGeneration.keys());
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
          .map((id, index) => readPersistedDocumentShell(
            id,
            index,
            this.#documentGenerations.get(id) ?? 0
          ))
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
        !storedCatalog && this.#writerLease.writer,
        activeSessionId
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
      for (const id of documents.getDocumentIds()) {
        if (id !== activeSession.id) await this.#releaseDocument(id);
      }
      this.touch(activeSession.id);
      if (hydrated.canvasMode !== "structured") {
        hydrated.grid = rebuildGridFromContent(documents);
      }
      store.setState(hydrated, true);
      if (this.#writerLease.writer) {
        this.#unsubscribeMutations = documents.subscribeMutations((envelope) => {
          const revision = this.#documentRevisions.get(envelope.documentId) ?? 0;
          if (revision <= 0 || !this.#documents.has(envelope.documentId)) return;
          const entries = this.#checkpointTails.get(envelope.documentId) ?? [];
          const last = entries.at(-1);
          if (last?.revision === revision) {
            entries[entries.length - 1] = {
              revision,
              envelopes: [...last.envelopes, envelope],
            };
          } else {
            entries.push({ revision, envelopes: [envelope] });
          }
          if (entries.length > 4_096) entries.splice(0, entries.length - 4_096);
          this.#checkpointTails.set(envelope.documentId, entries);
        });
        documents.configureDocumentLifecycle({
          onCreate: (id, doc) => this.#attachDocument(id, doc),
          onDelete: (id) => { void this.#deleteDocument(id); },
        });
        await this.#saveCatalog();
        const verified = await this.#catalog.load();
        if (!verified || verified.sessions.length !== restoredSessions.length) {
          throw new Error("Canvas catalog verification failed");
        }
        await Promise.all(Array.from(this.#obsoleteDocumentDatabases, clearDocument));
        this.#obsoleteDocumentDatabases.clear();
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
      const dirty = Array.from(this.#dirtyDocuments);
      await Promise.all(dirty.flatMap(([id]) => {
        const provider = this.#documents.get(id)?.provider;
        return provider ? [storeState(provider, false)] : [];
      }));
      dirty.forEach(([id, revision]) => {
        if (this.#dirtyDocuments.get(id) === revision) {
          this.#dirtyDocuments.delete(id);
        }
      });
      await this.#saveCatalog();
      this.#publish({
        phase: "ready",
        save: this.#dirtyDocuments.size === 0 ? "saved" : "saving",
        error: null,
      });
    } catch (error) {
      this.#publish({
        phase: "degraded",
        save: "error",
        error: error instanceof Error ? error.message : "Canvas persistence failed",
      });
    }
  };

  getCheckpointDiagnostics = (
    id = this.#registry?.getActiveDocumentId()
  ): CanvasCheckpointDiagnostics | null =>
    id ? this.#checkpointServices.get(id)?.getDiagnostics() ?? null : null;

  runCheckpointNow = (
    id = this.#registry?.getActiveDocumentId()
  ) => id
    ? this.#checkpointServices.get(id)?.run() ?? Promise.resolve(false)
    : Promise.resolve(false);

  ensureLoaded = async (session: CanvasSession): Promise<boolean> => {
    const documents = this.#registry;
    if (!documents) return false;
    if (documents.getDocument(session.id)) {
      this.touch(session.id);
      return true;
    }
    try {
      const doc = session.collaboration
        ? new Y.Doc({ guid: session.id })
        : await this.#loadSessionDocument(session, false);
      documents.adoptDocument(session.id, doc);
      if (session.mode !== "slide" && session.collaboration) {
        documents.prepareDocumentForCollaboration(
          session.id,
          session.mode,
          session.collaboration.documentVersion
        );
      }
      this.touch(session.id);
      await this.#evictionTask;
      return true;
    } catch (error) {
      this.#handleError(error);
      return false;
    }
  };

  setPinnedCanvasIds = (ids: readonly string[]) => {
    this.#pinnedCanvasIds.clear();
    ids.forEach((id) => this.#pinnedCanvasIds.add(id));
    void this.#queueEviction().catch((error) => this.#handleError(error));
  };

  touch = (id: string) => {
    const index = this.#recentCanvasIds.indexOf(id);
    if (index >= 0) this.#recentCanvasIds.splice(index, 1);
    this.#recentCanvasIds.push(id);
    void this.#queueEviction().catch((error) => this.#handleError(error));
  };

  delete = async (id: string) => {
    await this.#releaseDocument(id);
    await this.#deleteDocument(id);
  };

  dispose = () => {
    this.#unsubscribeStore?.();
    this.#unsubscribeStore = null;
    this.#unsubscribeMutations?.();
    this.#unsubscribeMutations = null;
    if (this.#metadataTimer) clearTimeout(this.#metadataTimer);
    if (this.#documentTimer) clearTimeout(this.#documentTimer);
    this.#checkpointTimers.forEach((timer) => clearTimeout(timer));
    this.#checkpointTimers.clear();
    this.#checkpointServices.forEach((service) => service.cancel());
    this.#checkpointServices.clear();
    this.#checkpointTails.clear();
    void this.#checkpointWorker.dispose();
    this.#documents.forEach(({ doc, provider, updateListener }) => {
      doc.off("update", updateListener);
      void provider.destroy();
    });
    this.#documents.clear();
    this.#registry = null;
    this.#catalog?.close();
    this.#catalog = null;
    this.#writerLease?.release();
    this.#writerLease = null;
  };

  async #restoreSessions(
    documents: CanvasDocumentRegistry,
    sessions: CanvasSession[],
    resetDocuments: boolean,
    activeSessionId: string
  ) {
    const restored: CanvasSession[] = [];
    for (const session of sessions) {
      const isActive = session.id === activeSessionId;
      if (!isActive && !resetDocuments) {
        restored.push(session);
        continue;
      }
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
        const doc = await this.#openDocument(session.id, {
          mode: "slide",
          activePageId: session.slideDeck.activeSlideId,
          pages,
          grid: [],
          scene: [],
          components: [],
        });
        if (isActive) documents.adoptDocument(session.id, doc);
        else await this.#closePersistedDocument(session.id, doc);
        restored.push(session);
        continue;
      }
      if (session.collaboration) {
        if (isActive) {
          documents.adoptDocument(session.id, new Y.Doc({ guid: session.id }));
          documents.prepareDocumentForCollaboration(
            session.id,
            session.mode,
            session.collaboration.documentVersion
          );
        }
        restored.push({ ...session, grid: [], scene: [], components: [] });
        continue;
      }
      const existingSeed = documents.getDocumentSeed(session.id, session.mode);
      const doc = await this.#openDocument(
        session.id,
        existingSeed ?? seedFromSession(session)
      );
      if (isActive) documents.adoptDocument(session.id, doc);
      const seed = isActive
        ? documents.getDocumentSeed(session.id, session.mode)
        : readDocumentSeed(doc, session.id);
      if (!isActive) await this.#closePersistedDocument(session.id, doc);
      restored.push({
        ...session,
        grid: seed?.grid ?? [],
        scene: seed?.scene ?? [],
        components: seed?.components ?? [],
      });
    }
    return restored;
  }

  async #loadSessionDocument(session: CanvasSession, resetDocument: boolean) {
    if (session.mode === "slide") {
      return this.#openDocument(session.id, {
        mode: "slide",
        activePageId: session.slideDeck.activeSlideId,
        pages: session.slideDeck.slides.map((slide) => ({
          id: slide.id,
          name: slide.name,
          size: slide.size,
          kind: "cell-plane" as const,
          grid: slide.grid,
        })),
        grid: [],
        scene: [],
        components: [],
      });
    }
    const seed = resetDocument
      ? seedFromSession(session)
      : this.#registry?.getDocumentSeed(session.id, session.mode) ??
        seedFromSession(session);
    return this.#openDocument(session.id, seed);
  }

  async #readLegacySlideGrid(sessionId: string, slideId: string) {
    const id = `${sessionId}:slide:${slideId}`;
    const doc = new Y.Doc({ guid: id });
    const provider = new IndexeddbPersistence(getDocumentDatabaseName(id), doc);
    try {
      await provider.whenSynced;
      await provider.destroy();
      migrateLegacyDocument(doc, id, {
        mode: "freeform",
        grid: [],
        scene: [],
        components: [],
      });
      return readCellPlaneGrid(doc);
    } finally {
      doc.destroy();
    }
  }

  async #openDocument(
    id: string,
    seed: CanvasDocumentSeed
  ) {
    const generation = this.#documentGenerations.get(id) ?? 0;
    const name = getDocumentDatabaseName(id, generation);
    const doc = new Y.Doc({ guid: id });
    const provider = new IndexeddbPersistence(name, doc);
    await provider.whenSynced;
    if (!this.#writerLease?.writer) {
      await provider.destroy();
      const migrated = migrateLegacyDocument(doc, id, seed);
      if (isDocumentEmpty(doc)) applyCanvasDocumentSeed(doc, id, seed);
      if (
        migrated ||
        hasLegacyCellPlaneOperations(doc) ||
        countDocumentStructs(doc) >= DOCUMENT_STRUCT_ROTATION_THRESHOLD
      ) {
        const compacted = createCompactedDocument(doc, id);
        doc.destroy();
        return compacted;
      }
      return doc;
    }
    const migrated = migrateLegacyDocument(doc, id, seed);
    const seeded = isDocumentEmpty(doc);
    if (seeded) applyCanvasDocumentSeed(doc, id, seed);
    if (
      migrated ||
      hasLegacyCellPlaneOperations(doc) ||
      countDocumentStructs(doc) >= DOCUMENT_STRUCT_ROTATION_THRESHOLD
    ) {
      const compacted = createCompactedDocument(doc, id);
      const nextGeneration = generation + 1;
      const nextDatabaseName = getDocumentDatabaseName(id, nextGeneration);
      await clearDocument(nextDatabaseName);
      const nextProvider = new IndexeddbPersistence(
        nextDatabaseName,
        compacted
      );
      await nextProvider.whenSynced;
      await storeState(nextProvider, true);
      if (!hasValidPages(compacted)) {
        await nextProvider.destroy();
        compacted.destroy();
        throw new Error(`Canvas document compaction verification failed: ${id}`);
      }
      await provider.destroy();
      doc.destroy();
      this.#documentGenerations.set(id, nextGeneration);
      this.#registerDocument(id, compacted, nextProvider);
      return compacted;
    }
    this.#registerDocument(id, doc, provider);
    if (seeded) await storeState(provider, true);
    return doc;
  }

  #attachDocument(id: string, doc: Y.Doc) {
    if (this.#documents.has(id)) return;
    const session = this.#store?.getState().canvasSessions.find(
      (candidate) => candidate.id === id
    );
    if (session?.mode !== "slide" && session?.collaboration) return;
    const generation = this.#documentGenerations.get(id) ?? 0;
    const provider = new IndexeddbPersistence(
      getDocumentDatabaseName(id, generation),
      doc
    );
    this.#registerDocument(id, doc, provider);
    void provider.whenSynced.catch((error) => this.#handleError(error));
  }

  #registerDocument(
    id: string,
    doc: Y.Doc,
    provider: IndexeddbPersistence
  ) {
    this.#documentRevisions.set(id, this.#documentRevisions.get(id) ?? 0);
    const updateListener = () => {
      this.#documentRevisions.set(id, (this.#documentRevisions.get(id) ?? 0) + 1);
      this.#scheduleDocumentFlush(id);
      this.#scheduleCheckpoint(id);
    };
    doc.on("update", updateListener);
    this.#documents.set(id, { doc, provider, updateListener });
    this.#ensureCheckpointService(id);
    this.#scheduleCheckpoint(id);
  }

  async #closePersistedDocument(id: string, doc: Y.Doc) {
    const persisted = this.#documents.get(id);
    if (persisted) {
      persisted.doc.off("update", persisted.updateListener);
      if (this.#dirtyDocuments.has(id)) await storeState(persisted.provider, false);
      await persisted.provider.destroy();
      this.#documents.delete(id);
      this.#dirtyDocuments.delete(id);
      this.#clearCheckpoint(id);
    }
    doc.destroy();
  }

  async #detachLocalPersistence(id: string) {
    const persisted = this.#documents.get(id);
    if (!persisted) return;
    this.#documents.delete(id);
    persisted.doc.off("update", persisted.updateListener);
    if (this.#dirtyDocuments.has(id)) await storeState(persisted.provider, false);
    await persisted.provider.destroy();
    this.#dirtyDocuments.delete(id);
    this.#clearCheckpoint(id);
  }

  async #releaseDocument(id: string) {
    const documents = this.#registry;
    if (!documents || id === documents.getActiveDocumentId()) return false;
    const persisted = this.#documents.get(id);
    if (persisted) {
      persisted.doc.off("update", persisted.updateListener);
      if (this.#dirtyDocuments.has(id)) await storeState(persisted.provider, false);
      await persisted.provider.destroy();
      this.#documents.delete(id);
      this.#dirtyDocuments.delete(id);
      this.#clearCheckpoint(id);
    }
    const released = documents.releaseDocument(id);
    if (released) {
      const index = this.#recentCanvasIds.indexOf(id);
      if (index >= 0) this.#recentCanvasIds.splice(index, 1);
    }
    return released;
  }

  async #evictDocuments() {
    const documents = this.#registry;
    if (!documents) return;
    while (documents.getDocumentIds().length > MAX_RESIDENT_CANVASES) {
      const activeId = documents.getActiveDocumentId();
      const candidate = this.#recentCanvasIds.find((id) =>
        id !== activeId &&
        !this.#pinnedCanvasIds.has(id) &&
        documents.getDocument(id)
      ) ?? documents.getDocumentIds().find((id) =>
        id !== activeId && !this.#pinnedCanvasIds.has(id)
      );
      if (!candidate || !await this.#releaseDocument(candidate)) return;
    }
  }

  #queueEviction() {
    const task = this.#evictionTask.then(() => this.#evictDocuments());
    this.#evictionTask = task.catch(() => undefined);
    return task;
  }

  async #deleteDocument(id: string) {
    const current = this.#documents.get(id);
    if (current) {
      current.doc.off("update", current.updateListener);
      this.#documents.delete(id);
      this.#dirtyDocuments.delete(id);
      await current.provider.clearData();
    }
    this.#documentGenerations.delete(id);
    this.#documentRevisions.delete(id);
    this.#clearCheckpoint(id);
    const locations = await listPersistedDocuments();
    await Promise.all(locations
      .filter((location) => location.id === id)
      .map((location) => clearDocument(
        getDocumentDatabaseName(location.id, location.generation)
      )));
  }

  #subscribeToStore() {
    if (!this.#store) return;
    this.#lastCatalogJson = JSON.stringify(createCatalogSnapshot(
      this.#store.getState(),
      this.#documentGenerations
    ));
    this.#unsubscribeStore = this.#store.subscribe((state) => {
      state.canvasSessions.forEach((session) => {
        if (session.mode !== "slide" && session.collaboration) {
          void this.#detachLocalPersistence(session.id).catch(
            (error) => this.#handleError(error)
          );
        }
      });
      const nextJson = JSON.stringify(createCatalogSnapshot(
        state,
        this.#documentGenerations
      ));
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

  #scheduleDocumentFlush(id: string) {
    this.#dirtyDocuments.set(id, (this.#dirtyDocuments.get(id) ?? 0) + 1);
    if (this.#documentTimer) clearTimeout(this.#documentTimer);
    this.#publish({ save: "saving" });
    this.#documentTimer = setTimeout(() => {
      this.#documentTimer = null;
      const dirty = Array.from(this.#dirtyDocuments);
      void Promise.all(dirty.flatMap(([documentId]) => {
        const provider = this.#documents.get(documentId)?.provider;
        return provider ? [storeState(provider, false)] : [];
      }))
        .then(() => {
          dirty.forEach(([documentId, revision]) => {
            if (this.#dirtyDocuments.get(documentId) === revision) {
              this.#dirtyDocuments.delete(documentId);
            }
          });
          this.#publish({
            save: this.#dirtyDocuments.size === 0 ? "saved" : "saving",
            error: null,
          });
        })
        .catch((error) => this.#handleError(error));
    }, SAVE_DELAY);
  }

  #scheduleCheckpoint(id: string) {
    if (!this.#writerLease?.writer) return;
    const existing = this.#checkpointTimers.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.#checkpointTimers.delete(id);
      void this.#checkpointServices.get(id)?.run().then((committed) => {
        if (!committed && this.#checkpointServices.get(id)?.evaluate()) {
          this.#scheduleCheckpoint(id);
        }
      }).catch((error) => this.#handleError(error));
    }, CHECKPOINT_IDLE_DELAY);
    this.#checkpointTimers.set(id, timer);
  }

  #clearCheckpoint(id: string) {
    const timer = this.#checkpointTimers.get(id);
    if (timer) clearTimeout(timer);
    this.#checkpointTimers.delete(id);
    this.#checkpointServices.get(id)?.cancel();
    this.#checkpointServices.delete(id);
    this.#checkpointTails.delete(id);
  }

  #ensureCheckpointService(id: string) {
    if (this.#checkpointServices.has(id)) return;
    const service = new CanvasCheckpointService<BrowserCheckpointCandidate>({
      getGeneration: () => this.#documentGenerations.get(id) ?? 0,
      getRevision: () => this.#documentRevisions.get(id) ?? 0,
      getMetrics: () => {
        const document = this.#documents.get(id);
        return document
          ? getDocumentAuthorityMetrics(document.doc)
          : { yjsStructs: 0, operations: 0, authorityPayloadBytes: 0 };
      },
      build: async (generation, baseRevision, report) => {
        const source = this.#documents.get(id)?.doc;
        if (!source) throw new Error(`Canvas checkpoint source is unavailable: ${id}`);
        const databaseName = getDocumentDatabaseName(id, generation);
        report("encoding");
        const snapshot = await encodeCanvasCheckpointSnapshot(source, id);
        report("materializing", { snapshotBytes: snapshot.bytes });
        const taskId = await this.#checkpointWorker.build({
          documentId: id,
          databaseName,
          generation,
          baseRevision,
          snapshot: snapshot.buffer,
        });
        return {
          id,
          generation,
          baseRevision,
          databaseName,
          taskId,
          doc: null,
          provider: null,
          digest: null,
          snapshotBytes: snapshot.bytes,
          reclaimedBytes: 0,
          committed: false,
        };
      },
      catchUp: async (candidate, currentRevision, report) => {
        const entries = (this.#checkpointTails.get(id) ?? []).filter(
          ({ revision }) =>
            revision > candidate.baseRevision && revision <= currentRevision
        );
        let expected = candidate.baseRevision + 1;
        for (const entry of entries) {
          if (entry.revision !== expected) return null;
          expected += 1;
        }
        if (expected !== currentRevision + 1) return null;
        report("replaying", {
          tailActions: entries.reduce(
            (count, entry) => count + entry.envelopes.length,
            0
          ),
        });
        candidate.baseRevision = await this.#checkpointWorker.appendTail(
          candidate.taskId,
          entries
        );
        return candidate;
      },
      verify: async (candidate, report) => {
        report("persisting");
        const result = await this.#checkpointWorker.finalize(candidate.taskId);
        report("reopening", {
          workerDurationMs: result.workerDurationMs,
          snapshotBytes: result.snapshotBytes,
        });
        candidate.baseRevision = result.baseRevision;
        candidate.digest = result.digest;
        candidate.reclaimedBytes = Math.max(
          0,
          candidate.snapshotBytes - result.compactedBytes
        );
        const doc = new Y.Doc({ guid: id });
        Y.applyUpdate(doc, result.update, "canvas-checkpoint-worker");
        const provider = new IndexeddbPersistence(candidate.databaseName, doc);
        await provider.whenSynced;
        candidate.doc = doc;
        candidate.provider = provider;
        if (!hasValidPages(doc)) {
          throw new Error(`Canvas checkpoint has no valid pages: ${id}`);
        }
        report("verifying");
      },
      commit: async (candidate) => {
        const current = this.#documents.get(id);
        const registry = this.#registry;
        if (!current || !registry || !candidate.doc || !candidate.provider) {
          throw new Error(`Canvas checkpoint target is unavailable: ${id}`);
        }
        if ((this.#documentRevisions.get(id) ?? 0) !== candidate.baseRevision) {
          throw new Error(`Canvas checkpoint changed before commit: ${id}`);
        }
        const previousGeneration = this.#documentGenerations.get(id) ?? 0;
        this.#documentGenerations.set(id, candidate.generation);
        try {
          await this.#saveCatalog();
          if ((this.#documentRevisions.get(id) ?? 0) !== candidate.baseRevision) {
            this.#documentGenerations.set(id, previousGeneration);
            await this.#saveCatalog();
            throw new Error(`Canvas checkpoint changed during commit: ${id}`);
          }
        } catch (error) {
          this.#documentGenerations.set(id, previousGeneration);
          throw error;
        }
        current.doc.off("update", current.updateListener);
        this.#documents.delete(id);
        candidate.committed = true;
        this.#registerDocument(id, candidate.doc, candidate.provider);
        registry.adoptDocument(id, candidate.doc);
        await current.provider.destroy();
        this.#dirtyDocuments.delete(id);
        const tail = this.#checkpointTails.get(id) ?? [];
        this.#checkpointTails.set(
          id,
          tail.filter(({ revision }) => revision > candidate.baseRevision)
        );
        return { reclaimedBytes: candidate.reclaimedBytes };
      },
      abort: async (candidate) => {
        if (candidate.committed) return;
        await candidate.provider?.destroy();
        candidate.doc?.destroy();
        await this.#checkpointWorker.abort(
          candidate.taskId,
          candidate.databaseName
        );
      },
    });
    this.#checkpointServices.set(id, service);
  }

  #saveCatalog() {
    if (!this.#catalog || !this.#store) {
      return Promise.reject(new Error("Canvas catalog is unavailable"));
    }
    return this.#catalog.save(createCatalogSnapshot(
      this.#store.getState(),
      this.#documentGenerations
    ));
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
