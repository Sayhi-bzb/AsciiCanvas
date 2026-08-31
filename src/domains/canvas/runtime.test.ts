import { afterEach, describe, expect, it } from "vitest";
import { createSelectionCommandFactory } from "@/domains/actions/public";
import { parseDocumentSessionSource } from "@/domains/document/public";
import type { CanvasSession } from "@/domains/sessions/public";
import { createCanvasRuntime, type CanvasRuntime } from "./runtime";

const sessions: CanvasSession[] = [
  {
    id: "canvas-a",
    name: "Alpha",
    mode: "freeform",
    scene: [],
    components: [],
    grid: [["0,0", { char: "A", color: "#111111" }]],
  },
  {
    id: "canvas-b",
    name: "Beta",
    mode: "freeform",
    scene: [],
    components: [],
    grid: [["0,0", { char: "B", color: "#222222" }]],
  },
  {
    id: "canvas-structured",
    name: "Structure",
    mode: "structured",
    scene: [{
      id: "text-1",
      type: "text",
      order: 1,
      position: { x: 2, y: 3 },
      text: "Node",
      style: { color: "#333333" },
    }],
    components: [],
    grid: [],
  },
  {
    id: "canvas-slides",
    name: "Deck",
    mode: "slide",
    scene: [],
    components: [],
    grid: [],
    slideDeck: {
      activeSlideId: "slide-1",
      slides: [{
        id: "slide-1",
        name: "Slide 1",
        size: { columns: 80, rows: 24 },
        grid: [["1,1", { char: "S", color: "#444444" }]],
      }],
    },
  },
  {
    id: "canvas-blackboard",
    name: "Board",
    mode: "blackboard",
    workspaceId: "workspace-a",
    scene: [],
    components: [],
    grid: [],
  },
];

describe("CanvasRuntime.materializeSession", () => {
  let runtime: CanvasRuntime | null = null;

  afterEach(() => {
    runtime?.dispose();
    runtime = null;
  });

  it("reads an inactive session without activating it", async () => {
    runtime = createCanvasRuntime({
      persistence: false,
      initialSessions: sessions,
      parseSessionSource: parseDocumentSessionSource,
      selectionCommands: createSelectionCommandFactory({
        getActiveDocumentId: () => runtime!.documents.getActiveDocumentId(),
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
    });
    runtime.commands.sessions.switch("canvas-b");
    const activeCanvasId = runtime.getState().activeCanvasId;
    const viewport = runtime.getState().offset;

    const materialized = await runtime.materializeSession("canvas-a");

    expect(materialized?.name).toBe("Alpha");
    expect(materialized?.surface.getCell({ x: 0, y: 0 })?.char).toBe("A");
    expect(runtime.getState().activeCanvasId).toBe(activeCanvasId);
    expect(runtime.getState().offset).toEqual(viewport);
  });

  it("returns null for an unknown session", async () => {
    runtime = createCanvasRuntime({
      persistence: false,
      initialSessions: sessions,
      parseSessionSource: parseDocumentSessionSource,
      selectionCommands: createSelectionCommandFactory({
        getActiveDocumentId: () => runtime!.documents.getActiveDocumentId(),
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
    });

    await expect(runtime.materializeSession("missing")).resolves.toBeNull();
  });

  it("materializes the derived Blackboard surface instead of its empty shell", async () => {
    runtime = createCanvasRuntime({
      persistence: false,
      initialSessions: sessions,
      parseSessionSource: parseDocumentSessionSource,
      selectionCommands: createSelectionCommandFactory({
        getActiveDocumentId: () => runtime!.documents.getActiveDocumentId(),
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
    });

    runtime.commands.sessions.replaceBlackboardProjection(
      "canvas-blackboard",
      {
        mode: "freeform",
        grid: [["3,2", { char: "B", color: "#111111" }]],
        scene: [],
        components: [],
      },
    );

    const materialized = await runtime.materializeSession("canvas-blackboard");
    expect(materialized?.surface.getCell({ x: 3, y: 2 })?.char).toBe("B");
    expect(runtime.documents.getDocumentSeed("canvas-blackboard", "freeform")?.grid)
      .toEqual([]);
  });

  it("materializes structured projections and complete slide decks", async () => {
    runtime = createCanvasRuntime({
      persistence: false,
      initialSessions: sessions,
      parseSessionSource: parseDocumentSessionSource,
      selectionCommands: createSelectionCommandFactory({
        getActiveDocumentId: () => runtime!.documents.getActiveDocumentId(),
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
    });

    const structured = await runtime.materializeSession("canvas-structured");
    const slides = await runtime.materializeSession("canvas-slides");

    expect(structured?.structuredScene).toHaveLength(1);
    expect(structured?.surface.getCell({ x: 2, y: 3 })?.char).toBe("N");
    expect(slides?.slideDeck?.slides[0].grid).toEqual([
      ["1,1", { char: "S", color: "#444444" }],
    ]);
    expect(slides?.surface.getCell({ x: 1, y: 1 })?.char).toBe("S");
  });
});
