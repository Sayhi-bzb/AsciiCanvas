import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAnimationExchangeDocument,
  buildProtocolExportDocument,
  exportAnimationFrameToAnsi,
  createAnimationGifBlob,
  exportAnimationToJSON,
  exportProtocolToJSON,
  exportSelectionToAnsi,
  exportSelectionToJSON,
  exportStructuredHierarchyText,
  exportToAnsi,
} from "@/domains/export/public";
import { normalizeAnimationTimeline } from "@/domains/animation/public";
import type { GridMap } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";

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
      frames: [
        {
          id: "f1",
          name: "Frame 1",
          grid: [["0,0", { char: "@", color: "#ffffff" }]],
        },
      ],
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
      component: {
        instanceId: "component-1",
        templateId: "card",
        role: "container",
      },
    });
    expect(parsed.nodes[1]).toMatchObject({
      id: "text-1",
      type: "text",
      text: "Hi",
      style: { color: "#ffffff" },
    });
  });

  it("exports simplified structured hierarchy without coordinates or ids", () => {
    const scene: StructuredNode[] = [
      {
        id: "box-1",
        type: "box",
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 8, y: 4 },
        name: "API",
        style: { color: "#111111" },
      },
      {
        id: "text-1",
        type: "text",
        order: 2,
        position: { x: 1, y: 1 },
        text: "Hello",
        style: { color: "#ffffff" },
      },
      {
        id: "bg-1",
        type: "bg",
        order: 3,
        start: { x: 1, y: 2 },
        end: { x: 3, y: 3 },
        style: { color: "#000000", bgColor: "#334155" },
      },
      {
        id: "line-1",
        type: "line",
        order: 4,
        start: { x: 10, y: 0 },
        end: { x: 14, y: 0 },
        axis: "horizontal",
        style: { color: "#ffffff" },
      },
    ];

    expect(exportStructuredHierarchyText(scene)).toBe([
      '<canvas',
      '  mode="structured"',
      '>',
      '  <box',
      '    name="API"',
      '  >',
      '    <text',
      '      value="Hello"',
      '    />',
      '    <bg',
      '    />',
      '  </box>',
      '  <line',
      '    axis="horizontal"',
      '  />',
      '</canvas>',
    ].join("\n"));
  });

  it("exports component roles in simplified structured hierarchy", () => {
    const scene: StructuredNode[] = [
      {
        id: "bg-1",
        type: "bg",
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 7, y: 0 },
        style: { color: "#000000", bgColor: "#dbeafe" },
        component: {
          instanceId: "component-1",
          templateId: "button",
          role: "fill",
        },
      },
      {
        id: "text-1",
        type: "text",
        order: 2,
        position: { x: 0, y: 0 },
        text: "[BUTTON]",
        style: { color: "#000000" },
        component: {
          instanceId: "component-1",
          templateId: "button",
          role: "label",
        },
      },
    ];

    expect(exportStructuredHierarchyText(scene)).toBe([
      '<canvas',
      '  mode="structured"',
      '>',
      '  <component',
      '    template="button"',
      '    label="button"',
      '  >',
      '    <role',
      '      name="fill"',
      '    >',
      '      <bg',
      '        component="button"',
      '        role="fill"',
      '      />',
      '    </role>',
      '    <role',
      '      name="label"',
      '    >',
      '      <text',
      '        component="button"',
      '        role="label"',
      '        value="[BUTTON]"',
      '      />',
      '    </role>',
      '  </component>',
      '</canvas>',
    ].join("\n"));
  });

  it("exports selected structured roots without duplicating selected descendants", () => {
    const scene: StructuredNode[] = [
      {
        id: "box-1",
        type: "box",
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 8, y: 4 },
        name: "API",
        style: { color: "#111111" },
      },
      {
        id: "text-1",
        type: "text",
        order: 2,
        position: { x: 1, y: 1 },
        text: "Hello",
        style: { color: "#ffffff" },
      },
      {
        id: "text-2",
        type: "text",
        order: 3,
        position: { x: 12, y: 1 },
        text: "Loose",
        style: { color: "#ffffff" },
      },
    ];

    expect(exportStructuredHierarchyText(scene, ["box-1", "text-1"])).toBe([
      '<canvas',
      '  mode="structured"',
      '>',
      '  <box',
      '    name="API"',
      '  >',
      '    <text',
      '      value="Hello"',
      '    />',
      '  </box>',
      '</canvas>',
    ].join("\n"));
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

  it("exports ANSI16 runs and merges adjacent cells with the same color", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#ff0000" }],
      ["2,0", { char: "C", color: "#00ff00" }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[91mAB\u001b[92mC\u001b[m"
    );
  });

  it("merges adjacent cells with equivalent normalized ANSI colors", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#f00" }],
      ["1,0", { char: "B", color: "#FF0000" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[91mAB\u001b[m");
  });

  it("emits selective ANSI diffs for changed attributes and colors", () => {
    const grid: GridMap = new Map([
      [
        "0,0",
        {
          char: "A",
          color: "#ff0000",
          bgColor: "#0000ff",
          attrs: { bold: true },
        },
      ],
      ["1,0", { char: "B", color: "#00ff00", bgColor: "#0000ff" }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[1;91;104mA\u001b[22;92mB\u001b[m"
    );
  });

  it("carries invisible foreground style across unstyled spaces", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["2,0", { char: "B", color: "#ff0000" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[91mA B\u001b[m");
  });

  it("carries foreground style across explicit visually empty cells", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: " ", color: "#000000" }],
      ["2,0", { char: "B", color: "#ff0000" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[91mA B\u001b[m");
  });

  it("delays invisible leading-space styles and trims invisible trailing spaces", () => {
    const leadingGrid: GridMap = new Map([
      ["0,0", { char: " ", color: "#ff0000", attrs: { bold: true } }],
      ["1,0", { char: "A", color: "#ff0000", attrs: { bold: true } }],
    ]);
    const trailingGrid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000", attrs: { italic: true } }],
      ["1,0", { char: " ", color: "#ff0000", attrs: { italic: true } }],
    ]);

    expect(exportToAnsi(leadingGrid)).toBe(" \u001b[1;91mA\u001b[m");
    expect(exportToAnsi(trailingGrid)).toBe("\u001b[3;91mA\u001b[m");
  });

  it("does not carry visible background style across unstyled spaces", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000", bgColor: "#0000ff" }],
      ["2,0", { char: "B", color: "#ff0000", bgColor: "#0000ff" }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[91;104mA\u001b[0m \u001b[91;104mB\u001b[m"
    );
  });

  it("does not collapse visibly decorated spaces", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000", attrs: { underline: true } }],
      ["1,0", { char: " ", color: "#000000" }],
      ["2,0", { char: "B", color: "#ff0000", attrs: { underline: true } }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[4;91mA\u001b[0m \u001b[4;91mB\u001b[m"
    );
  });

  it("uses exact ANSI256 colors when they are shorter than truecolor", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#5f87af" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[38;5;67mA\u001b[m");
  });

  it("keeps ANSI lines self-contained", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["0,1", { char: "B", color: "#ff0000" }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[91mA\u001b[m\n\u001b[91mB\u001b[m"
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

  it("exports default slate ANSI text without color escapes", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "C", color: "#0f172a" }],
      ["1,0", { char: "l", color: "#0f172a" }],
      ["2,0", { char: "e", color: "#0f172a" }],
      ["3,0", { char: "a", color: "#0f172a" }],
      ["4,0", { char: "r", color: "#0f172a" }],
    ]);

    expect(exportToAnsi(grid)).toBe("Clear");
  });

  it("resets to default text when ANSI color returns to black", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#000000" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[91mA\u001b[0mB");
  });

  it("resets to default text when ANSI color returns to default slate", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#0f172a" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[91mA\u001b[0mB");
  });

  it("exports selected ANSI16 cells within the selection bounds", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["1,0", { char: "B", color: "#00ff00" }],
      ["3,0", { char: "X", color: "#ffffff" }],
    ]);

    expect(
      exportSelectionToAnsi(grid, [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }])
    ).toBe("\u001b[91mA\u001b[92mB\u001b[m");
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
      "\u001b[1;3;4;9;91;104mA\u001b[0mB"
    );
  });

  it("exports background and attributes without default slate foreground escapes", () => {
    const grid: GridMap = new Map([
      [
        "0,0",
        {
          char: "A",
          color: "#0f172a",
          bgColor: "#eff6ff",
          attrs: { bold: true, underline: true },
        },
      ],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[1;4;48;2;239;246;255mA\u001b[m"
    );
  });

  it("preserves trailing spaces with visible ANSI background", () => {
    const grid: GridMap = new Map(
      Array.from(" BUTTON ").map((char, x) => [
        `${x},0`,
        { char, color: "#000000", bgColor: "#dbeafe" },
      ])
    );

    expect(exportToAnsi(grid)).toBe(
      "\u001b[48;2;219;234;254m BUTTON \u001b[m"
    );
    expect(
      exportSelectionToAnsi(grid, [
        { start: { x: 0, y: 0 }, end: { x: 7, y: 0 } },
      ])
    ).toBe("\u001b[48;2;219;234;254m BUTTON \u001b[m");
  });

  it("still trims trailing spaces without visible ANSI style", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#000000" }],
      ["1,0", { char: " ", color: "#000000" }],
    ]);

    expect(exportToAnsi(grid)).toBe("A");
    expect(
      exportSelectionToAnsi(grid, [
        { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
      ])
    ).toBe("A");
  });

  it("trims styled trailing spaces when ANSI color export is disabled", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#000000" }],
      ["1,0", { char: " ", color: "#000000", bgColor: "#dbeafe" }],
    ]);

    expect(exportToAnsi(grid, { includeColor: false })).toBe("A");
    expect(
      exportSelectionToAnsi(
        grid,
        [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
        { includeColor: false }
      )
    ).toBe("A");
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
      "\u001b[7;94;101mA\u001b[m"
    );
  });

  it("exports hyperlink cells as OSC 8-like shorthand", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ffffff", href: "https://example.com" }],
      ["1,0", { char: "B", color: "#ffffff", href: "https://example.com" }],
      ["2,0", { char: "C", color: "#ffffff" }],
    ]);

    expect(exportToAnsi(grid)).toBe(
      "\u001b[97m]8;;https://example.com\\AB]8;;\\C\u001b[m"
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
    ).toBe("\u001b[97m你A\u001b[m");
  });

  it("supports short hex ANSI16 colors and falls back to default text on invalid colors", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#0f0" }],
      ["1,0", { char: "B", color: "oklch(0.7 0.2 120)" }],
    ]);

    expect(exportToAnsi(grid)).toBe("\u001b[92mA\u001b[0mB");
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

    expect(exportToAnsi(grid)).toBe("\u001b[97m你A\u001b[m");
  });

  it("exports animation frames as fixed-size ANSI output", () => {
    const ansi = exportAnimationFrameToAnsi(
      { width: 3, height: 2 },
      [["1,0", { char: "@", color: "#ff0000" }]]
    );

    expect(ansi).toBe(" \u001b[91m@ \u001b[m\n   ");
  });

  it("encodes complex GIF pixel streams without corrupting LZW data", async () => {
    const timeline = normalizeAnimationTimeline({
      fps: 1,
      loop: false,
      frames: [
        {
          id: "f1",
          name: "Frame 1",
          grid: [["0,0", { char: "@", color: "#ffffff" }]],
        },
      ],
      currentFrameId: "f1",
    });
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
        save: vi.fn(),
        restore: vi.fn(),
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
      const blob = await createAnimationGifBlob(
        { width: 10, height: 10 },
        timeline
      );

      expect(loadFont).toHaveBeenCalled();
      expect(blob).not.toBeNull();      if (!blob) {
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
