import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAnimationExchangeDocument,
  buildProtocolExportDocument,
  exportAnimationFrameToAnsi,
  exportAnimationToGIF,
  exportAnimationToJSON,
  exportProtocolToJSON,
  exportSelectionToAnsi,
  exportSelectionToJSON,
  exportToAnsi,
} from "@/domains/export/utils/export";
import { normalizeAnimationTimeline } from "@/domains/canvas/state/helpers/animationHelpers";
import type { GridMap, StructuredNode } from "@/shared/types";

const quantizeGifIndex = (red: number, green: number, blue: number) => {
  return ((red & 0xe0) | ((green & 0xe0) >> 3) | (blue >> 6)) & 0xff;
};

const createComplexImageData = (width: number, height: number) => {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const x = index % width;
    const y = Math.floor(index / width);
    data[offset] = (x * 17 + y * 29) % 256;
    data[offset + 1] = (x * 47 + y * 13) % 256;
    data[offset + 2] = (x * 7 + y * 71) % 256;
    data[offset + 3] = 255;
  }

  return data;
};

const quantizeImageData = (data: Uint8ClampedArray) => {
  const indices = new Uint8Array(data.length / 4);

  for (let src = 0, dest = 0; src < data.length; src += 4, dest += 1) {
    indices[dest] = quantizeGifIndex(data[src], data[src + 1], data[src + 2]);
  }

  return indices;
};

const readGifImageData = (bytes: Uint8Array) => {
  const graphicsControlIndex = bytes.findIndex(
    (_byte, index) =>
      bytes[index] === 0x21 &&
      bytes[index + 1] === 0xf9 &&
      bytes[index + 2] === 0x04
  );
  const imageDescriptorIndex = bytes.indexOf(0x2c, graphicsControlIndex);
  const minimumCodeSize = bytes[imageDescriptorIndex + 10];
  const data: number[] = [];

  for (
    let index = imageDescriptorIndex + 11;
    index < bytes.length && bytes[index] > 0;
    index += bytes[index] + 1
  ) {
    data.push(...bytes.slice(index + 1, index + 1 + bytes[index]));
  }

  return {
    graphicsControlIndex,
    imageDescriptorIndex,
    minimumCodeSize,
    data: new Uint8Array(data),
  };
};

const decodeGifLzw = (
  data: Uint8Array,
  minimumCodeSize: number,
  expectedLength: number
) => {
  const clearCode = 1 << minimumCodeSize;
  const endOfInformationCode = clearCode + 1;
  let bitOffset = 0;
  let codeSize = minimumCodeSize + 1;
  let nextCode = endOfInformationCode + 1;
  let dictionary = new Map<number, number[]>();

  const resetDictionary = () => {
    dictionary = new Map<number, number[]>();
    for (let index = 0; index < clearCode; index += 1) {
      dictionary.set(index, [index]);
    }
    nextCode = endOfInformationCode + 1;
    codeSize = minimumCodeSize + 1;
  };

  const readCode = () => {
    let code = 0;
    for (let bit = 0; bit < codeSize; bit += 1) {
      const byte = data[Math.floor(bitOffset / 8)] ?? 0;
      code |= ((byte >> (bitOffset % 8)) & 1) << bit;
      bitOffset += 1;
    }
    return code;
  };

  resetDictionary();

  const output: number[] = [];
  let previous: number[] | null = null;

  while (bitOffset < data.length * 8) {
    const code = readCode();

    if (code === clearCode) {
      resetDictionary();
      previous = null;
      continue;
    }

    if (code === endOfInformationCode) break;

    const dictionaryEntry = dictionary.get(code);
    const entry: number[] | null =
      dictionaryEntry ??
      (code === nextCode && previous
        ? [...previous, previous[0]]
        : null);

    if (!entry) {
      throw new Error(`Invalid GIF LZW code ${code}.`);
    }

    output.push(...entry);

    if (previous) {
      dictionary.set(nextCode, [...previous, entry[0]]);
      nextCode += 1;
      if (nextCode === 1 << codeSize && codeSize < 12) {
        codeSize += 1;
      }
    }

    previous = entry;

    if (output.length >= expectedLength) break;
  }

  if (output.length < expectedLength) {
    throw new Error("GIF LZW stream ended before all pixels were decoded.");
  }

  return new Uint8Array(output.slice(0, expectedLength));
};

describe("export utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a stable animation exchange document", () => {
    const timeline = normalizeAnimationTimeline({
      fps: 12,
      loop: true,
      frames: [
        {
          id: "f1",
          name: "Idle",
          grid: [["1,2", { char: "@", color: "#ff0000" }]],
        },
      ],
      currentFrameId: "f1",
    });

    const document = buildAnimationExchangeDocument(
      { width: 80, height: 25 },
      timeline
    );

    expect(document).toEqual({
      type: "ascii-animation",
      version: 1,
      size: { width: 80, height: 25 },
      playback: {
        fps: 12,
        loop: true,
      },
      frames: [
        {
          name: "Idle",
          cells: [{ x: 1, y: 2, char: "@", color: "#ff0000" }],
        },
      ],
    });
  });

  it("serializes the animation exchange document without editor-only fields", () => {
    const timeline = normalizeAnimationTimeline({
      frames: [{ id: "f1", name: "Frame 1", grid: [] }],
      currentFrameId: "f1",
    });

    const json = exportAnimationToJSON({ width: 64, height: 64 }, timeline);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe("ascii-animation");
    expect(parsed.playback).toEqual({
      fps: timeline.fps,
      loop: timeline.loop,
    });
    expect(parsed.frames[0]).toHaveProperty("name", "Frame 1");
    expect(parsed.frames[0]).not.toHaveProperty("id");
    expect(parsed.frames[0]).not.toHaveProperty("index");
  });

  it("builds a freeform protocol export document", () => {
    const grid: GridMap = new Map([
      ["1,2", { char: "@", color: "#ff0000" }],
      ["0,0", { char: "#", color: "#00ff00" }],
    ]);

    const document = buildProtocolExportDocument({
      canvasMode: "freeform",
      grid,
      structuredScene: [],
      canvasBounds: null,
      animationTimeline: null,
    });

    expect(document).toEqual({
      type: "ascii-canvas-document",
      version: 1,
      mode: "freeform",
      cells: [
        { x: 0, y: 0, char: "#", color: "#00ff00" },
        { x: 1, y: 2, char: "@", color: "#ff0000" },
      ],
    });
    expect(document).not.toHaveProperty("selections");
    expect(document).not.toHaveProperty("scratchLayer");
  });

  it("serializes the animation protocol document", () => {
    const timeline = normalizeAnimationTimeline({
      fps: 8,
      loop: false,
      frames: [
        {
          id: "f1",
          name: "Frame 1",
          grid: [["2,3", { char: "*", color: "#ffaa00" }]],
        },
      ],
      currentFrameId: "f1",
    });

    const json = exportProtocolToJSON({
      canvasMode: "animation",
      grid: new Map(),
      structuredScene: [],
      canvasBounds: { width: 64, height: 64 },
      animationTimeline: timeline,
    });
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe("ascii-canvas-document");
    expect(parsed.version).toBe(1);
    expect(parsed.mode).toBe("animation");
    expect(parsed.playback).toEqual({ fps: 8, loop: false });
    expect(parsed.frames[0]).toHaveProperty("id", "f1");
    expect(parsed.frames[0]).toHaveProperty("name", "Frame 1");
    expect(parsed.frames[0].cells[0]).toEqual({
      x: 2,
      y: 3,
      char: "*",
      color: "#ffaa00",
    });
  });

  it("serializes the structured protocol document", () => {
    const scene: StructuredNode[] = [
      {
        id: "box-1",
        type: "box",
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 4, y: 4 },
        name: "Box",
        style: { color: "#111111" },
      },
      {
        id: "text-1",
        type: "text",
        order: 2,
        position: { x: 1, y: 1 },
        text: "Hi",
        style: { color: "#ffffff" },
      },
    ];

    const json = exportProtocolToJSON({
      canvasMode: "structured",
      grid: new Map(),
      structuredScene: scene,
      canvasBounds: null,
      animationTimeline: null,
    });
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe("ascii-canvas-document");
    expect(parsed.version).toBe(1);
    expect(parsed.mode).toBe("structured");
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.nodes[0]).toMatchObject({
      id: "box-1",
      type: "box",
      name: "Box",
      style: { color: "#111111" },
    });
    expect(parsed.nodes[1]).toMatchObject({
      id: "text-1",
      type: "text",
      text: "Hi",
      style: { color: "#ffffff" },
    });
  });

  it("serializes protocol JSON in monochrome when color export is disabled", () => {
    const json = exportProtocolToJSON({
      canvasMode: "freeform",
      grid: new Map([["1,2", { char: "@", color: "#ff0000" }]]),
      structuredScene: [],
      canvasBounds: null,
      animationTimeline: null,
      includeColor: false,
    });
    const parsed = JSON.parse(json);

    expect(parsed.cells).toEqual([
      { x: 1, y: 2, char: "@", color: "#000000" },
    ]);
  });

  it("exports ANSI truecolor runs and merges adjacent cells with the same color", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#ff0000" }],
      ["2,0", { char: "C", color: "#00ff00" }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[38;2;255;0;0mAB\u001b[0m\u001b[38;2;0;255;0mC\u001b[0m"
    );
  });

  it("exports default black ANSI text without color escapes", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "C", color: "#000000" }],
      ["1,0", { char: "l", color: "#000000" }],
      ["2,0", { char: "o", color: "#000000" }],
      ["3,0", { char: "u", color: "#000000" }],
      ["4,0", { char: "d", color: "#000000" }],
    ]);

    expect(exportToAnsi(grid)).toBe("Cloud");
  });

  it("exports selected default black ANSI text without color escapes", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "C", color: "#000000" }],
      ["1,0", { char: "l", color: "#000000" }],
      ["2,0", { char: "o", color: "#000000" }],
      ["3,0", { char: "u", color: "#000000" }],
      ["4,0", { char: "d", color: "#000000" }],
    ]);

    expect(
      exportSelectionToAnsi(grid, [{ start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }])
    ).toBe("Cloud");
  });

  it("resets to default text when ANSI color returns to black", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#000000" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[38;2;255;0;0mA\u001b[0mB");
  });

  it("exports selected cells as ANSI truecolor within the selection bounds", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#00ff00" }],
      ["3,0", { char: "X", color: "#ffffff" }],
    ]);

    expect(
      exportSelectionToAnsi(grid, [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }])
    ).toBe("\u001b[38;2;255;0;0mA\u001b[0m\u001b[38;2;0;255;0mB\u001b[0m");
  });

  it("exports ANSI background and text attributes", () => {
    const grid: GridMap = new Map([
      [
        "0,0",
        {
          char: "A",
          color: "#ff0000",
          bgColor: "#0000ff",
          attrs: { bold: true, italic: true, underline: true, strike: true },
        },
      ],
      ["1,0", { char: "B", color: "#000000" }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[1;3;4;9;38;2;255;0;0;48;2;0;0;255mA\u001b[0mB"
    );
  });

  it("exports inverse ANSI using swapped effective colors", () => {
    const grid: GridMap = new Map([
      [
        "0,0",
        {
          char: "A",
          color: "#ff0000",
          bgColor: "#0000ff",
          attrs: { inverse: true },
        },
      ],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[7;38;2;0;0;255;48;2;255;0;0mA\u001b[0m"
    );
  });

  it("exports selected ANSI without rich color escapes when color export is disabled", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#00ff00" }],
    ]);

    expect(
      exportSelectionToAnsi(
        grid,
        [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
        { includeColor: false }
      )
    ).toBe("AB");
  });

  it("exports selection rich JSON with background and text attributes", () => {
    const grid: GridMap = new Map([
      [
        "0,0",
        {
          char: " ",
          color: "#ffffff",
          bgColor: "#eff6ff",
          attrs: { bold: true },
        },
      ],
    ]);

    expect(
      JSON.parse(
        exportSelectionToJSON(grid, [
          { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        ])!
      )
    ).toEqual({
      type: "ascii-metropolis-zone",
      version: 1,
      cells: [
        {
          x: 0,
          y: 0,
          char: " ",
          color: "#ffffff",
          bgColor: "#eff6ff",
          attrs: { bold: true },
        },
      ],
    });
  });

  it("preserves wide-character stepping in selected ANSI export", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "你", color: "#ffffff" }],
      ["2,0", { char: "A", color: "#ffffff" }],
    ]);

    expect(
      exportSelectionToAnsi(grid, [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }])
    ).toBe("\u001b[38;2;255;255;255m你A\u001b[0m");
  });

  it("supports short hex ANSI colors and falls back to default text on invalid colors", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#0f0" }],
      ["1,0", { char: "B", color: "oklch(0.7 0.2 120)" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[38;2;0;255;0mA\u001b[0mB");
  });

  it("exports ANSI without escape colors when color export is disabled", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#00ff00" }],
    ]);

    expect(exportToAnsi(grid, { includeColor: false })).toBe("AB");
  });

  it("preserves wide-character stepping in ANSI export", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "你", color: "#ffffff" }],
      ["2,0", { char: "A", color: "#ffffff" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[38;2;255;255;255m你A\u001b[0m");
  });

  it("exports animation frames as fixed-size ANSI output", () => {
    const ansi = exportAnimationFrameToAnsi(
      { width: 3, height: 2 },
      [["1,0", { char: "@", color: "#ff0000" }]]
    );

    expect(ansi).toBe(" \u001b[38;2;255;0;0m@\u001b[0m \n   ");
  });

  it("encodes complex GIF pixel streams without corrupting LZW data", async () => {
    const timeline = normalizeAnimationTimeline({
      fps: 1,
      loop: false,
      frames: [{ id: "f1", name: "Frame 1", grid: [] }],
      currentFrameId: "f1",
    });
    let exportedBlob: Blob | null = null;
    const originalFonts = document.fonts;
    const loadFont = vi.fn().mockResolvedValue([]);
    let expectedIndices = new Uint8Array();

    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        load: loadFont,
        ready: Promise.resolve([]),
      },
    });

    try {
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        getImageData: (_x: number, _y: number, width: number, height: number) => {
          const data = createComplexImageData(width, height);
          expectedIndices = quantizeImageData(data);

          return {
            width,
            height,
            data,
          } as ImageData;
        },
      } as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
        exportedBlob = blob instanceof Blob ? blob : null;
        return "blob:ascii-canvas-test";
      });
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

      await exportAnimationToGIF({ width: 10, height: 10 }, timeline);

      expect(loadFont).toHaveBeenCalled();
      expect(exportedBlob).not.toBeNull();
      const blob = exportedBlob as Blob | null;
      if (!blob) {
        throw new Error("GIF export did not produce a blob.");
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const gifImageData = readGifImageData(bytes);
      const decodedIndices = decodeGifLzw(
        gifImageData.data,
        gifImageData.minimumCodeSize,
        expectedIndices.length
      );

      expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");
      expect(gifImageData.graphicsControlIndex).toBeGreaterThan(0);
      expect(gifImageData.imageDescriptorIndex).toBeGreaterThan(0);
      expect(bytes[gifImageData.imageDescriptorIndex + 9]).toBe(0x00);
      expect(gifImageData.minimumCodeSize).toBe(0x08);
      expect(decodedIndices).toEqual(expectedIndices);
    } finally {
      Object.defineProperty(document, "fonts", {
        configurable: true,
        value: originalFonts,
      });
    }
  });
});
