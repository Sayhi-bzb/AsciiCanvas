import { describe, expect, it } from "vitest";
import {
  ASCII_CANVAS_DOCUMENT_TYPE,
  ASCII_CANVAS_DOCUMENT_VERSION,
  buildAnimationProtocolDocument,
  buildFreeformProtocolDocument,
  buildProtocolDocument,
  buildProtocolDocumentFromCanvasState,
  buildStructuredProtocolDocument,
  isAsciiCanvasDocument,
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "@/domains/protocol";
import { normalizeAnimationTimeline } from "@/domains/canvas/state/helpers/animationHelpers";
import type { GridMap, StructuredNode } from "@/shared/types";

describe("protocol builders", () => {
  it("builds a stable freeform document from a colored sparse grid", () => {
    const grid: GridMap = new Map([
      ["2,1", { char: "B", color: "#00ff00" }],
      ["0,0", { char: "A", color: "#ff0000" }],
    ]);

    expect(buildFreeformProtocolDocument(grid)).toEqual({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [
        { x: 0, y: 0, char: "A", color: "#ff0000" },
        { x: 2, y: 1, char: "B", color: "#00ff00" },
      ],
    });
  });

  it("builds an animation document with stable playback and frame metadata", () => {
    const timeline = normalizeAnimationTimeline({
      fps: 12,
      loop: true,
      currentFrameId: "f1",
      frames: [
        {
          id: "f1",
          name: "Idle",
          grid: [["1,2", { char: "@", color: "#ff0000" }]],
        },
        {
          id: "f2",
          name: "Blink",
          grid: [["0,0", { char: "*", color: "#00ffcc" }]],
        },
      ],
    });

    expect(
      buildAnimationProtocolDocument({ width: 80, height: 25 }, timeline)
    ).toEqual({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "animation",
      size: { width: 80, height: 25 },
      playback: { fps: 12, loop: true },
      frames: [
        {
          id: "f1",
          name: "Idle",
          cells: [{ x: 1, y: 2, char: "@", color: "#ff0000" }],
        },
        {
          id: "f2",
          name: "Blink",
          cells: [{ x: 0, y: 0, char: "*", color: "#00ffcc" }],
        },
      ],
    });
  });

  it("builds a structured document without flattening semantic nodes", () => {
    const scene: StructuredNode[] = [
      {
        id: "line-1",
        type: "line",
        order: 2,
        start: { x: 1, y: 1 },
        end: { x: 4, y: 3 },
        axis: "horizontal",
        style: { color: "#999999" },
      },
      {
        id: "box-1",
        type: "box",
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 5, y: 5 },
        name: "Shell",
        style: { color: "#111111" },
      },
      {
        id: "text-1",
        type: "text",
        order: 3,
        position: { x: 2, y: 2 },
        text: "hi",
        style: { color: "#ffffff" },
      },
      {
        id: "bg-1",
        type: "bg",
        order: 4,
        start: { x: 1, y: 1 },
        end: { x: 4, y: 4 },
        style: { color: "#000000", bgColor: "#334155" },
      },
    ];

    expect(buildStructuredProtocolDocument(scene)).toEqual({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "structured",
      nodes: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 5, y: 5 },
          name: "Shell",
          style: { color: "#111111" },
        },
        {
          id: "line-1",
          type: "line",
          order: 2,
          start: { x: 1, y: 1 },
          end: { x: 4, y: 3 },
          axis: "horizontal",
          style: { color: "#999999" },
        },
        {
          id: "text-1",
          type: "text",
          order: 3,
          position: { x: 2, y: 2 },
          text: "hi",
          style: { color: "#ffffff" },
        },
        {
          id: "bg-1",
          type: "bg",
          order: 4,
          start: { x: 1, y: 1 },
          end: { x: 4, y: 4 },
          style: { color: "#000000", bgColor: "#334155" },
        },
      ],
    });
  });

  it("round-trips extended cell style fields in v1 documents", () => {
    const grid: GridMap = new Map([
      [
        "0,0",
        {
          char: "A",
          color: "#ff0000",
          bgColor: "#0000ff",
          attrs: { bold: true, underline: true },
        },
      ],
    ]);

    const document = buildFreeformProtocolDocument(grid);
    expect(document.cells).toEqual([
      {
        x: 0,
        y: 0,
        char: "A",
        color: "#ff0000",
        bgColor: "#0000ff",
        attrs: { bold: true, underline: true },
      },
    ]);
    expect(isAsciiCanvasDocument(document)).toBe(true);
    expect(protocolDocumentToSnapshot(document).grid).toEqual([
      [
        "0,0",
        {
          char: "A",
          color: "#ff0000",
          bgColor: "#0000ff",
          attrs: { bold: true, underline: true },
        },
      ],
    ]);
  });

  it("round-trips cell hyperlinks in v1 documents", () => {
    const grid: GridMap = new Map([
      [
        "0,0",
        {
          char: "A",
          color: "#ff0000",
          href: "https://example.com",
        },
      ],
    ]);

    const document = buildFreeformProtocolDocument(grid);
    expect(document.cells).toEqual([
      {
        x: 0,
        y: 0,
        char: "A",
        color: "#ff0000",
        href: "https://example.com",
      },
    ]);
    expect(isAsciiCanvasDocument(document)).toBe(true);
    expect(protocolDocumentToSnapshot(document).grid).toEqual([
      [
        "0,0",
        {
          char: "A",
          color: "#ff0000",
          href: "https://example.com",
        },
      ],
    ]);
  });
  it("validates protocol headers and rejects mode mismatches", () => {
    const valid = {
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [{ x: 0, y: 0, char: "#", color: "#000000" }],
    };

    expect(isAsciiCanvasDocument(valid)).toBe(true);
    expect(
      isAsciiCanvasDocument({
        ...valid,
        type: "ascii-animation",
      })
    ).toBe(false);
    expect(
      isAsciiCanvasDocument({
        ...valid,
        version: 2,
      })
    ).toBe(false);
    expect(
      isAsciiCanvasDocument({
        type: ASCII_CANVAS_DOCUMENT_TYPE,
        version: ASCII_CANVAS_DOCUMENT_VERSION,
        mode: "structured",
        cells: valid.cells,
      })
    ).toBe(false);
  });

  it("dispatches by mode and ignores transient editor state", () => {
    const document = buildProtocolDocumentFromCanvasState({
      canvasMode: "freeform",
      grid: new Map([["3,4", { char: "Z", color: "#abcdef" }]]),
      structuredScene: [],
      canvasBounds: null,
      animationTimeline: null,
    } as const);

    expect(document).toEqual(
      buildProtocolDocument({
        mode: "freeform",
        grid: new Map([["3,4", { char: "Z", color: "#abcdef" }]]),
      })
    );
    expect(document).not.toHaveProperty("selections");
    expect(document).not.toHaveProperty("scratchLayer");
    expect(document).not.toHaveProperty("hoveredGrid");
  });

  it("throws when animation state is incomplete", () => {
    expect(() =>
      buildProtocolDocumentFromCanvasState({
        canvasMode: "animation",
        grid: new Map(),
        structuredScene: [],
        canvasBounds: null,
        animationTimeline: null,
      })
    ).toThrow(
      "Animation protocol export requires both canvasBounds and animationTimeline."
    );
  });

  it("parses and imports a freeform protocol document", () => {
    const document = parseProtocolDocument({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [
        { x: 3, y: 4, char: "Z", color: "#abcdef" },
        { x: 0, y: 0, char: "@", color: "#ff0000" },
      ],
    });

    expect(protocolDocumentToSnapshot(document)).toEqual({
      mode: "freeform",
      scene: [],
      components: [],
      grid: [
        ["3,4", { char: "Z", color: "#abcdef" }],
        ["0,0", { char: "@", color: "#ff0000" }],
      ],
    });
  });

  it("imports an animation protocol document into a session snapshot", () => {
    const document = parseProtocolDocument({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "animation",
      size: { width: 64, height: 32 },
      playback: { fps: 8, loop: false },
      frames: [
        {
          id: "f1",
          name: "Idle",
          cells: [{ x: 1, y: 2, char: "@", color: "#ff0000" }],
        },
        {
          id: "f2",
          name: "Blink",
          cells: [{ x: 0, y: 1, char: "*", color: "#00ffcc" }],
        },
      ],
    });

    const snapshot = protocolDocumentToSnapshot(document);
    expect(snapshot.mode).toBe("animation");
    expect(snapshot.size).toEqual({ width: 64, height: 32 });
    expect(snapshot.timeline?.fps).toBe(8);
    expect(snapshot.timeline?.loop).toBe(false);
    expect(snapshot.timeline?.frames).toHaveLength(2);
    expect(snapshot.timeline?.frames[0]).toMatchObject({
      id: "f1",
      name: "Idle",
    });
    expect(snapshot.grid).toEqual([
      ["1,2", { char: "@", color: "#ff0000" }],
    ]);

    expect(snapshot.timeline?.currentFrameId).toBe("f1");
  });

  it("imports a structured protocol document into semantic nodes and grid entries", () => {
    const document = parseProtocolDocument({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "structured",
      nodes: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 3, y: 2 },
          name: "Box",
          style: { color: "#111111" },
          component: {
            instanceId: "component-1",
            templateId: "card",
            role: "container",
          },
        },
        {
          id: "text-1",
          type: "text",
          order: 2,
          position: { x: 1, y: 1 },
          text: "Hi",
          style: { color: "#ffffff" },
        },
      ],
    });

    const snapshot = protocolDocumentToSnapshot(document);
    expect(snapshot.mode).toBe("structured");
    expect(snapshot.scene).toHaveLength(2);
    expect(snapshot.scene[0]).toMatchObject({
      id: "box-1",
      type: "box",
      style: { color: "#111111" },
      component: {
        instanceId: "component-1",
        templateId: "card",
        role: "container",
      },
    });
    expect(snapshot.grid.length).toBeGreaterThan(0);
  });

  it("rejects invalid protocol payloads during parse", () => {
    expect(() =>
      parseProtocolDocument('{"type":"ascii-canvas-document","version":2}')
    ).toThrow("Invalid ascii-canvas-document payload.");
    expect(() =>
      parseProtocolDocument({
        type: ASCII_CANVAS_DOCUMENT_TYPE,
        version: ASCII_CANVAS_DOCUMENT_VERSION,
        mode: "animation",
        playback: { fps: 10, loop: true },
      })
    ).toThrow("Invalid ascii-canvas-document payload.");
  });

  it("supports round-tripping key fields through export and import", () => {
    const source = buildProtocolDocument({
      mode: "structured",
      scene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 2, y: 2 },
          text: "Hello",
          style: { color: "#ffaa00" },
        },
      ],
    });

    const restored = protocolDocumentToSnapshot(source);
    const rebuilt = buildStructuredProtocolDocument(restored.scene);

    expect(rebuilt).toEqual(source);
  });
});
