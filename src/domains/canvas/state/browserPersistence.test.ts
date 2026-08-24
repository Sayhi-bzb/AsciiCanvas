import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { clearDocument } from "y-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSelectionCommandFactory } from "@/domains/actions/public";
import { parseDocumentSessionSource } from "@/domains/document/public";
import {
  CANVAS_CATALOG_DATABASE,
  CANVAS_CATALOG_MARKER_KEY,
  EDITOR_PERSISTENCE_KEY,
  EDITOR_PERSISTENCE_VERSION,
  type CanvasSession,
} from "@/domains/sessions/public";
import { createCanvasRuntime, type CanvasRuntime } from "../runtime";

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
const EXTRA_DOCUMENT_DATABASES = [
  `chardesk-local-document-v1:${LEGACY_SESSION_ID}`,
  `chardesk-local-document-v1:${SLIDE_SESSION_ID}:slide:slide-a`,
];

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
        renderer: "plain",
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
  });

  afterEach(async () => {
    runtimes.forEach((runtime) => runtime.dispose());
    runtimes = [];
    await new Promise((resolve) => setTimeout(resolve, 0));
    await deleteDB(CANVAS_CATALOG_DATABASE);
    await clearDocument(DOCUMENT_DATABASE);
    await Promise.all(EXTRA_DOCUMENT_DATABASES.map(clearDocument));
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

  it("persists slide grids in their Yjs editing documents", async () => {
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
    first.commands.interaction.setTextCursor({ x: 1, y: 0 });
    first.commands.text.write("Y");
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
});
