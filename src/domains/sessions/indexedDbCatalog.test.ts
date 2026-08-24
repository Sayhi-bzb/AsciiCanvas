import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANVAS_CATALOG_DATABASE,
  createIndexedDbCanvasCatalog,
  type CanvasCatalogSnapshot,
  type CanvasCatalog,
} from "./indexedDbCatalog";

const snapshot: CanvasCatalogSnapshot = {
  activeSessionId: "canvas-a",
  sessions: [
    {
      id: "canvas-a",
      name: "Canvas A",
      mode: "slide",
      activeSlideId: "slide-2",
      viewport: { offset: { x: 12, y: 8 }, zoom: 1.5 },
    },
  ],
  slides: [
    {
      id: "slide-2",
      sessionId: "canvas-a",
      name: "Second",
      size: { columns: 100, rows: 27 },
      order: 1,
    },
    {
      id: "slide-1",
      sessionId: "canvas-a",
      name: "First",
      size: { columns: 80, rows: 24 },
      order: 0,
    },
  ],
  preferences: {
    brushChar: "#",
    brushColor: "#111111",
    brushBackgroundColor: "#ffffff",
    showGrid: true,
    exportShowGrid: false,
  },
};

describe("IndexedDB canvas catalog", () => {
  let catalogs: CanvasCatalog[] = [];
  beforeEach(() => deleteDB(CANVAS_CATALOG_DATABASE));
  afterEach(async () => {
    catalogs.forEach((catalog) => catalog.close());
    catalogs = [];
    await deleteDB(CANVAS_CATALOG_DATABASE);
  });

  it("stores metadata without canvas cell payloads", async () => {
    const catalog = await createIndexedDbCanvasCatalog();
    catalogs.push(catalog);
    expect(await catalog.load()).toBeNull();

    await catalog.save(snapshot);

    expect(await catalog.load()).toEqual({
      ...snapshot,
      slides: [snapshot.slides[1], snapshot.slides[0]],
    });
  });

  it("replaces removed sessions and slides atomically", async () => {
    const catalog = await createIndexedDbCanvasCatalog();
    catalogs.push(catalog);
    await catalog.save(snapshot);
    await catalog.save({
      ...snapshot,
      activeSessionId: "canvas-b",
      sessions: [{ id: "canvas-b", name: "Canvas B", mode: "freeform" }],
      slides: [],
    });

    const restored = await catalog.load();
    expect(restored?.sessions.map(({ id }) => id)).toEqual(["canvas-b"]);
    expect(restored?.slides).toEqual([]);
  });
});
