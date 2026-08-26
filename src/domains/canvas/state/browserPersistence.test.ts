import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import * as Y from "yjs";
import {
  IndexeddbPersistence,
  clearDocument,
  storeState,
} from "y-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSelectionCommandFactory } from "@/domains/actions/public";
import { parseDocumentSessionSource } from "@/domains/document/public";
import {
  CANVAS_CATALOG_DATABASE,
  CANVAS_CATALOG_MARKER_KEY,
  EDITOR_PERSISTENCE_KEY,
  EDITOR_PERSISTENCE_VERSION,
  createIndexedDbCanvasCatalog,
  type CanvasSession,
} from "@/domains/sessions/public";
import type { StructuredNode } from "@/domains/structured-content/public";
import { createCanvasRuntime, type CanvasRuntime } from "../runtime";
import { gridEntriesToCellPlaneOperation } from "../cell-plane/model";
import {
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  getCanvasDocumentRoot,
  getDefaultCanvasPageId,
  readCanvasPageOrder,
  readCanvasYPage,
} from "./canvasDocumentModel";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  get length() { return this.#values.size; }
  clear() { this.#values.clear(); }
  getItem(key: string) { return this.#values.get(key) ?? null; }
  key(index: number) { return Array.from(this.#values.keys())[index] ?? null; }
  removeItem(key: string) { this.#values.delete(key); }
  setItem(key: string, value: string) { this.#values.set(key, value); }
}

const SESSION_ID = "indexeddb-persistence-test";
const DOCUMENT_DATABASE = `chardesk-local-document-v1:${SESSION_ID}`;
const LEGACY_SESSION_ID = "legacy-indexeddb-test";
const SLIDE_SESSION_ID = "slide-indexeddb-test";
const SLIDE_DOCUMENT_DATABASE = `chardesk-local-document-v1:${SLIDE_SESSION_ID}`;
const LEGACY_SLIDE_DOCUMENT_DATABASE =
  `chardesk-local-document-v1:${SLIDE_SESSION_ID}:slide:slide-a`;
const EXTRA_DOCUMENT_DATABASES = [
  `chardesk-local-document-v1:${LEGACY_SESSION_ID}`,
  SLIDE_DOCUMENT_DATABASE,
  LEGACY_SLIDE_DOCUMENT_DATABASE,
  `${DOCUMENT_DATABASE}:generation:1`,
  `${DOCUMENT_DATABASE}:generation:2`,
  `chardesk-local-document-v1:${LEGACY_SESSION_ID}:generation:1`,
  `chardesk-local-document-v1:${LEGACY_SESSION_ID}:generation:2`,
  `${SLIDE_DOCUMENT_DATABASE}:generation:1`,
  `${SLIDE_DOCUMENT_DATABASE}:generation:2`,
];
const V4_BACKUP_KEY = "ascii-canvas-persistence-v4-backup";
const RESIDENCY_SESSION_IDS = Array.from(
  { length: 6 },
  (_, index) => `residency-canvas-${index}`
);

const createRuntime = (
  storage: Storage,
  initialSessions: readonly CanvasSession[] = [{
    id: SESSION_ID,
    name: "Persisted",
    mode: "freeform",
    scene: [],
    components: [],
    grid: [["0,0", { char: "A", color: "#111111" }]],
  }]
) => {
  const runtime: CanvasRuntime = createCanvasRuntime({
    persistence: { storage, key: EDITOR_PERSISTENCE_KEY },
    selectionCommands: createSelectionCommandFactory({
      getActiveDocumentId: () => runtime.documents.getActiveDocumentId(),
      renderClipboardText: async () => ({
        kind: "spans",
        renderer: "raw",
        pipeline: [],
        rows: [],
        width: 0,
        height: 0,
        diagnostics: [],
      }),
    }),
    parseSessionSource: parseDocumentSessionSource,
    initialSessions,
  });
  return runtime;
};

describe("browser canvas persistence", () => {
  let runtimes: CanvasRuntime[] = [];

  beforeEach(async () => {
    await deleteDB(CANVAS_CATALOG_DATABASE);
    await clearDocument(DOCUMENT_DATABASE);
    await Promise.all(EXTRA_DOCUMENT_DATABASES.map(clearDocument));
    await Promise.all(RESIDENCY_SESSION_IDS.map((id) =>
      clearDocument(`chardesk-local-document-v1:${id}`)
    ));
  });

  afterEach(async () => {
    runtimes.forEach((runtime) => runtime.dispose());
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));
    await deleteDB(CANVAS_CATALOG_DATABASE);
    await clearDocument(DOCUMENT_DATABASE);
    await Promise.all(EXTRA_DOCUMENT_DATABASES.map(clearDocument));
    await Promise.all(RESIDENCY_SESSION_IDS.map((id) =>
      clearDocument(`chardesk-local-document-v1:${id}`)
    ));
  });

  it("restores Yjs cells while the catalog contains metadata only", async () => {
    const storage = new MemoryStorage();
    const first = createRuntime(storage);
    runtimes.push(first);
    await first.ready;
    first.commands.interaction.setTextCursor({ x: 1, y: 0 });
    first.commands.text.write("B");
    await first.retryPersistence();
    first.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = createRuntime(storage);
    runtimes.push(second);
    await second.ready;

    expect(second.getState().grid.get("0,0")?.char).toBe("A");
    expect(second.getState().grid.get("1,0")?.char).toBe("B");
    expect(storage.getItem(CANVAS_CATALOG_MARKER_KEY)).toBe("1");
    expect(storage.getItem(EDITOR_PERSISTENCE_KEY)).toBeNull();
  });

  it("loads Canvas documents on demand and keeps only pinned plus recent documents", async () => {
    const storage = new MemoryStorage();
    const sessions: CanvasSession[] = RESIDENCY_SESSION_IDS.map((id, index) => ({
      id,
      name: `Canvas ${index}`,
      mode: "freeform",
      scene: [],
      components: [],
      grid: [["0,0", { char: String(index), color: "#111111" }]],
    }));
    const runtime = createRuntime(storage, sessions);
    runtimes.push(runtime);
    await runtime.ready;

    expect(runtime.documents.getDocumentIds()).toEqual([RESIDENCY_SESSION_IDS[0]]);
    runtime.setRetainedCanvasIds(RESIDENCY_SESSION_IDS.slice(0, 2));

    for (const [index, id] of RESIDENCY_SESSION_IDS.entries()) {
      expect(await runtime.commands.sessions.switch(id)).toBe(true);
      expect(runtime.getState().grid.get("0,0")?.char).toBe(String(index));
      expect(runtime.documents.getDocumentIds().length).toBeLessThanOrEqual(4);
    }

    expect(runtime.documents.getDocumentIds()).toEqual(expect.arrayContaining(
      RESIDENCY_SESSION_IDS.slice(0, 2)
    ));

    const stale = runtime.commands.sessions.switch(RESIDENCY_SESSION_IDS[2]!);
    const latest = runtime.commands.sessions.switch(RESIDENCY_SESSION_IDS[3]!);
    expect(await stale).toBe(false);
    expect(await latest).toBe(true);
    expect(runtime.getState().activeCanvasId).toBe(RESIDENCY_SESSION_IDS[3]);

    const releasedId = RESIDENCY_SESSION_IDS.find(
      (id) => !runtime.documents.getDocument(id)
    )!;
    expect(await runtime.commands.sessions.remove(releasedId)).toBe(true);
    await runtime.retryPersistence();
    runtime.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));

    const restored = createRuntime(storage, sessions);
    runtimes.push(restored);
    await restored.ready;
    expect(restored.getState().canvasSessions.some(({ id }) => id === releasedId))
      .toBe(false);
  });

  it("repairs intermediate Y.Map page descriptors without losing content", async () => {
    const storage = new MemoryStorage();
    const first = createRuntime(storage);
    runtimes.push(first);
    await first.ready;
    await first.retryPersistence();
    first.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));
    await clearDocument(DOCUMENT_DATABASE);

    const pageId = getDefaultCanvasPageId(SESSION_ID);
    const legacy = new Y.Doc({ guid: SESSION_ID });
    const provider = new IndexeddbPersistence(DOCUMENT_DATABASE, legacy);
    await provider.whenSynced;
    const descriptor = new Y.Map<unknown>();
    descriptor.set("id", pageId);
    descriptor.set("kind", "cell-plane");
    const nestedOperations = new Y.Array();
    nestedOperations.push([
      gridEntriesToCellPlaneOperation("intermediate-page", [[
        "7,4",
        { char: "旧", color: "#223344" },
      ]])!,
    ]);
    descriptor.set("operations", nestedOperations);
    legacy.getMap("document-pages").set(pageId, descriptor);
    legacy.getArray("document-page-order").push([pageId]);
    const meta = legacy.getMap("document-meta");
    meta.set("schemaVersion", CANVAS_DOCUMENT_SCHEMA_VERSION);
    meta.set("documentId", SESSION_ID);
    meta.set("mode", "freeform");
    meta.set("activePageId", pageId);
    await storeState(provider, true);
    await provider.destroy();
    legacy.destroy();

    const second = createRuntime(storage);
    runtimes.push(second);
    await second.ready;

    expect(second.getPersistenceSnapshot()).toMatchObject({
      phase: "ready",
      save: "saved",
      error: null,
    });
    expect(second.getState().canvasSessions.map(({ name }) => name))
      .toEqual(["Persisted"]);
    expect(second.getState().grid.get("7,4"))
      .toMatchObject({ char: "旧", color: "#223344" });
    const restored = second.documents.getCollaborationDocument(SESSION_ID);
    expect(restored?.getMap("document-pages").get(pageId))
      .not.toBeInstanceOf(Y.Map);
  });

  it("opens legacy IndexedDB content before seeding a missing catalog", async () => {
    const storage = new MemoryStorage();
    const legacy = new Y.Doc({ guid: SESSION_ID });
    const provider = new IndexeddbPersistence(DOCUMENT_DATABASE, legacy);
    await provider.whenSynced;
    legacy.getMap("main-grid").set(
      "8,6",
      { char: "存", color: "#334455" }
    );
    await storeState(provider, true);
    await provider.destroy();
    legacy.destroy();

    const runtime = createRuntime(storage);
    runtimes.push(runtime);
    await runtime.ready;

    expect(runtime.getPersistenceSnapshot()).toMatchObject({
      phase: "ready",
      save: "saved",
      error: null,
    });
    expect(runtime.getState().grid.get("8,6"))
      .toMatchObject({ char: "存", color: "#334455" });
    expect(runtime.getState().grid.get("0,0")).toBeUndefined();
    expect(storage.getItem(CANVAS_CATALOG_MARKER_KEY)).toBe("1");
  });

  it("reattaches persisted sessions and names after a bootstrap catalog overwrite", async () => {
    const storage = new MemoryStorage();
    const bootstrapSessions: CanvasSession[] = [{
      id: SESSION_ID,
      name: "Welcome",
      mode: "freeform",
      scene: [],
      components: [],
      grid: [["0,0", { char: "A", color: "#111111" }]],
    }];
    const first = createRuntime(storage, bootstrapSessions);
    runtimes.push(first);
    await first.ready;
    await first.retryPersistence();
    first.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));

    const orphan = new Y.Doc({ guid: LEGACY_SESSION_ID });
    const provider = new IndexeddbPersistence(
      `chardesk-local-document-v1:${LEGACY_SESSION_ID}`,
      orphan
    );
    await provider.whenSynced;
    orphan.getMap("main-grid").set(
      "3,2",
      { char: "B", color: "#222222" }
    );
    await storeState(provider, true);
    await provider.destroy();
    orphan.destroy();
    storage.setItem(V4_BACKUP_KEY, JSON.stringify({
      version: 4,
      state: {
        canvasSessions: [
          { ...bootstrapSessions[0], name: "Original canvas" },
          {
            id: LEGACY_SESSION_ID,
            name: "Second canvas",
            mode: "freeform",
            scene: [],
            components: [],
            grid: [],
          },
        ],
        activeCanvasId: LEGACY_SESSION_ID,
        canvasMode: "freeform",
        offset: { x: 0, y: 0 },
        zoom: 1,
      },
    }));

    const second = createRuntime(storage, bootstrapSessions);
    runtimes.push(second);
    await second.ready;

    expect(second.getState().canvasSessions.map(({ id, name }) => ({ id, name })))
      .toEqual([
        { id: SESSION_ID, name: "Original canvas" },
        { id: LEGACY_SESSION_ID, name: "Second canvas" },
      ]);
    expect(second.getState().activeCanvasId).toBe(LEGACY_SESSION_ID);
    expect(second.getState().grid.get("3,2")?.char).toBe("B");
  });

  it("reattaches an orphan document even when historical names are unavailable", async () => {
    const storage = new MemoryStorage();
    const first = createRuntime(storage);
    runtimes.push(first);
    await first.ready;
    await first.retryPersistence();
    first.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));

    const orphan = new Y.Doc({ guid: LEGACY_SESSION_ID });
    const provider = new IndexeddbPersistence(
      `chardesk-local-document-v1:${LEGACY_SESSION_ID}`,
      orphan
    );
    await provider.whenSynced;
    orphan.getMap("main-grid").set(
      "5,1",
      { char: "R", color: "#333333" }
    );
    await storeState(provider, true);
    await provider.destroy();
    orphan.destroy();

    const second = createRuntime(storage);
    runtimes.push(second);
    await second.ready;

    expect(second.getState().canvasSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: LEGACY_SESSION_ID,
        name: "Recovered Canvas 1",
        mode: "freeform",
      }),
    ]));
  });

  it("migrates a legacy structured document without flattening its scene", async () => {
    const storage = new MemoryStorage();
    const database = `chardesk-local-document-v1:${LEGACY_SESSION_ID}`;
    const textNode: StructuredNode = {
      id: "legacy-text",
      type: "text",
      order: 1,
      position: { x: 3, y: 2 },
      text: "Preserved",
      style: { color: "#445566" },
    };
    const legacy = new Y.Doc({ guid: LEGACY_SESSION_ID });
    const provider = new IndexeddbPersistence(database, legacy);
    await provider.whenSynced;
    legacy.getMap("structured-scene").set(textNode.id, textNode);
    await storeState(provider, true);
    await provider.destroy();
    legacy.destroy();

    const runtime = createRuntime(storage, [{
      id: LEGACY_SESSION_ID,
      name: "Structured legacy",
      mode: "structured",
      scene: [],
      components: [],
      grid: [],
    }]);
    runtimes.push(runtime);
    await runtime.ready;

    expect(runtime.getPersistenceSnapshot().phase).toBe("ready");
    expect(runtime.getState().canvasMode).toBe("structured");
    expect(runtime.getState().structuredScene).toEqual([textNode]);
  });

  it("migrates a V5 localStorage snapshot only after IndexedDB verification", async () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITOR_PERSISTENCE_KEY, JSON.stringify({
      version: EDITOR_PERSISTENCE_VERSION,
      state: {
        schemaVersion: EDITOR_PERSISTENCE_VERSION,
        workspace: {
          offset: { x: 20, y: 30 },
          zoom: 1.25,
          canvasMode: "freeform",
          grid: [["4,5", { char: "迁", color: "#222222" }]],
          structuredScene: [],
          structuredComponents: [],
        },
        sessions: {
          activeId: LEGACY_SESSION_ID,
          items: [{
            id: LEGACY_SESSION_ID,
            name: "Legacy",
            mode: "freeform",
            scene: [],
            components: [],
            grid: [["4,5", { char: "迁", color: "#222222" }]],
          }],
        },
        preferences: {
          brushChar: "@",
          brushColor: "#123456",
          brushBackgroundColor: "#654321",
          showGrid: true,
          exportShowGrid: false,
        },
      },
    }));

    const runtime = createRuntime(storage);
    runtimes.push(runtime);
    await runtime.ready;

    expect(runtime.getState()).toMatchObject({
      activeCanvasId: LEGACY_SESSION_ID,
      offset: { x: 20, y: 30 },
      zoom: 1.25,
      brushChar: "@",
    });
    expect(runtime.getState().grid.get("4,5")?.char).toBe("迁");
    expect(storage.getItem(EDITOR_PERSISTENCE_KEY)).toBeNull();
    expect(storage.getItem(CANVAS_CATALOG_MARKER_KEY)).toBe("1");
  });

  it("persists slide pages in one session Yjs document", async () => {
    const storage = new MemoryStorage();
    const slides: CanvasSession[] = [{
      id: SLIDE_SESSION_ID,
      name: "Slides",
      mode: "slide",
      slideDeck: {
        activeSlideId: "slide-a",
        slides: [{
          id: "slide-a",
          name: "Slide A",
          size: { columns: 80, rows: 24 },
          grid: [["0,0", { char: "X", color: "#111111" }]],
        }],
      },
      scene: [],
      components: [],
      grid: [],
    }];
    const first = createRuntime(storage, slides);
    runtimes.push(first);
    await first.ready;
    expect(first.getState().grid.get("0,0")?.char).toBe("X");
    first.commands.interaction.setTextCursor({ x: 1, y: 0 });
    first.commands.text.write("Y");
    expect(first.getState().grid.get("0,0")?.char).toBe("X");
    await first.retryPersistence();
    first.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = createRuntime(storage, slides);
    runtimes.push(second);
    await second.ready;
    expect(second.getState().grid.get("0,0")?.char).toBe("X");
    expect(second.getState().grid.get("1,0")?.char).toBe("Y");
  });

  it("migrates legacy per-slide IndexedDB content into the session document", async () => {
    const storage = new MemoryStorage();
    const slides: CanvasSession[] = [{
      id: SLIDE_SESSION_ID,
      name: "Slides",
      mode: "slide",
      slideDeck: {
        activeSlideId: "slide-a",
        slides: [{
          id: "slide-a",
          name: "Slide A",
          size: { columns: 80, rows: 24 },
          grid: [],
        }],
      },
      scene: [],
      components: [],
      grid: [],
    }];
    const first = createRuntime(storage, slides);
    runtimes.push(first);
    await first.ready;
    await first.retryPersistence();
    first.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));
    await clearDocument(SLIDE_DOCUMENT_DATABASE);

    const legacy = new Y.Doc({ guid: `${SLIDE_SESSION_ID}:slide:slide-a` });
    const provider = new IndexeddbPersistence(LEGACY_SLIDE_DOCUMENT_DATABASE, legacy);
    await provider.whenSynced;
    legacy.getArray("cell-plane-operations").push([
      gridEntriesToCellPlaneOperation("legacy-slide", [[
        "2,3",
        { char: "旧", color: "#111111" },
      ]])!,
    ]);
    await storeState(provider, true);
    await provider.destroy();
    legacy.destroy();

    const second = createRuntime(storage, slides);
    runtimes.push(second);
    await second.ready;
    expect(second.getState().grid.get("2,3")?.char).toBe("旧");
  });

  it("allows only one local writer across tabs sharing the workspace", async () => {
    const storage = new MemoryStorage();
    const writer = createRuntime(storage);
    runtimes.push(writer);
    await writer.ready;

    const reader = createRuntime(storage);
    runtimes.push(reader);
    await reader.ready;

    expect(writer.getPersistenceSnapshot().ownership).toBe("writer");
    expect(reader.getPersistenceSnapshot().ownership).toBe("reader");
    expect(reader.getState().grid.get("0,0")?.char).toBe("A");
  });

  it("rotates a tombstone-heavy document into a clean generation", async () => {
    const storage = new MemoryStorage();
    const first = createRuntime(storage);
    runtimes.push(first);
    await first.ready;
    await first.retryPersistence();
    first.dispose();
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));

    const noisy = new Y.Doc({ guid: SESSION_ID });
    const provider = new IndexeddbPersistence(DOCUMENT_DATABASE, noisy);
    await provider.whenSynced;
    const tombstones = noisy.getMap("compaction-test-tombstones");
    noisy.transact(() => {
      for (let index = 0; index < 10_100; index += 1) {
        tombstones.set(String(index), index);
      }
      tombstones.clear();
    });
    await storeState(provider, true);
    await provider.destroy();
    noisy.destroy();

    const second = createRuntime(storage);
    runtimes.push(second);
    await second.ready;

    expect(second.getState().grid.get("0,0")?.char).toBe("A");
    const catalog = await createIndexedDbCanvasCatalog();
    const snapshot = await catalog.load();
    catalog.close();
    expect(snapshot?.sessions.find(({ id }) => id === SESSION_ID))
      .toMatchObject({ documentGeneration: 1 });
    const compacted = second.documents.getCollaborationDocument(SESSION_ID)!;
    const structCount = Array.from(compacted.store.clients.values())
      .reduce((count, structs) => count + structs.length, 0);
    expect(structCount).toBeLessThan(100);
  });

  it("checkpoints a live operation-heavy document without losing content", async () => {
    const storage = new MemoryStorage();
    const runtime = createRuntime(storage);
    runtimes.push(runtime);
    await runtime.ready;

    const doc = runtime.documents.getCollaborationDocument(SESSION_ID)!;
    const root = getCanvasDocumentRoot(doc);
    const page = readCanvasYPage(root, readCanvasPageOrder(root)[0]!)!;
    doc.transact(() => {
      page.operations.push(Array.from({ length: 5_000 }, (_, index) =>
        gridEntriesToCellPlaneOperation(`checkpoint-${index}`, [[
          "1,0",
          { char: String(index % 10), color: "#223344" },
        ]])!
      ));
    });

    const checkpoint = runtime.persistence!.runCheckpointNow();
    runtime.documents.mutateGrid((grid) => {
      grid.set("2,0", { char: "尾", color: "#556677" });
    });

    expect(await checkpoint).toBe(true);
    expect(runtime.documents.getContentReader().getCell({ x: 1, y: 0 }))
      .toEqual({ char: "9", color: "#223344" });
    expect(runtime.documents.getContentReader().getCell({ x: 2, y: 0 }))
      .toEqual({ char: "尾", color: "#556677" });
    expect(runtime.persistence!.getCheckpointDiagnostics()).toMatchObject({
      phase: "idle",
      generation: 1,
      reason: "operations",
      tailActions: 1,
      error: null,
    });
    const catalog = await createIndexedDbCanvasCatalog();
    const snapshot = await catalog.load();
    catalog.close();
    expect(snapshot?.sessions.find(({ id }) => id === SESSION_ID))
      .toMatchObject({ documentGeneration: 1 });
  });
});
