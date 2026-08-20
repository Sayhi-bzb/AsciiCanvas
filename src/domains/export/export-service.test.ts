import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deliverExportClipboard,
  prepareTextExport,
  type ExportContext,
} from "@/domains/export/public";
import { ExportPipelineError } from "./core/types";
import { clipboard } from "@/shared/services/effects";
import {
  parseDocumentSessionSource,
} from "@/domains/document/public";
import { parseSlideMarkdown } from "@/domains/slides/public";

const createContext = (
  overrides: Partial<ExportContext> = {}
): ExportContext => ({
  canvasMode: "freeform",
  grid: new Map([["0,0", { char: "A", color: "#ffffff" }]]),
  structuredScene: [],
  structuredComponents: [],
  includeColor: true,
  showGrid: false,
  ...overrides,
});

describe("export service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds a round-trippable CharDesk text artifact", () => {
    const result = prepareTextExport(createContext(), "chardesk");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      kind: "text",
      format: "chardesk",
      mimeType: "text/plain;charset=utf-8",
    });
    expect(result.value.filename).toMatch(/^chardesk-\d+\.chardesk$/);
    expect(result.value.content).not.toContain("\u001b");
    const snapshot = parseDocumentSessionSource(result.value.content);
    expect(snapshot).toMatchObject({
      mode: "freeform",
      grid: [["0,0", { char: "A", color: "#ffffff" }]],
    });
  });

  it("flattens structured exports to a freeform visual canvas", () => {
    const result = prepareTextExport(
      createContext({
        canvasMode: "structured",
        grid: new Map([["0,0", { char: "X", color: "#ff0000" }]]),
        structuredScene: [{
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ff0000" },
        }],
      }),
      "chardesk"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parseDocumentSessionSource(result.value.content)).toMatchObject({
      mode: "freeform",
      scene: [],
      grid: [["0,0", { char: "X", color: "#ff0000" }]],
    });
  });

  it("builds text artifacts with stable metadata", () => {
    const result = prepareTextExport(createContext(), "txt");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      kind: "text",
      format: "txt",
      mimeType: "text/plain;charset=utf-8",
    });
    expect(result.value.content).toContain("A");
    expect(result.value.filename).toMatch(/^chardesk-\d+\.txt$/);
  });

  it("includes arrow line markers in structured text exports", () => {
    const result = prepareTextExport(
      createContext({
        canvasMode: "structured",
        grid: new Map(),
        structuredScene: [
          {
            id: "arrow-1",
            type: "line",
            order: 1,
            start: { x: 0, y: 0 },
            end: { x: 4, y: 0 },
            axis: "horizontal",
            endMarker: "arrow",
            style: { color: "#ffffff" },
          },
        ],
      }),
      "txt"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content).toContain('endMarker="arrow"');
  });


  it("round-trips positioned ANSI slide content through Markdown", () => {
    const result = prepareTextExport(
      createContext({
        canvasMode: "slide",
        grid: new Map(),
        slideDeck: {
          activeSlideId: "slide-1",
          slides: [
            {
              id: "slide-1",
              name: "Intro",
              size: { columns: 6, rows: 3 },
              grid: [["2,1", { char: "R", color: "#ff0000" }]],
            },
          ],
        },
        documentName: "Agent Deck",
      }),
      "md"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      format: "md",
      mimeType: "text/markdown;charset=utf-8",
    });
    expect(result.value.filename).toMatch(/^chardesk-slides-\d+\.slides\.md$/);
    expect(result.value.content).not.toContain("\u001b");
    expect(result.value.content).toContain("chardesk: slides/v1");
    expect(result.value.content).toContain("```chardesk size=6x3");

    const parsed = parseSlideMarkdown(result.value.content);
    expect(parsed.title).toBe("Agent Deck");
    expect(parsed.slideDeck.slides[0].grid).toEqual([
      ["2,1", { char: "R", color: "#ff0000" }],
    ]);
  });

  it("returns a typed clipboard error instead of throwing", async () => {
    vi.spyOn(clipboard, "writeText").mockResolvedValue(false);
    const artifact = prepareTextExport(createContext(), "txt");
    expect(artifact.ok).toBe(true);
    if (!artifact.ok) return;

    await expect(deliverExportClipboard(artifact.value)).resolves.toEqual({
      ok: false,
      error: { code: "clipboard-write-failed" },
    });
  });

  it("starts a PNG clipboard write before its Blob promise settles", async () => {
    let clipboardData: Record<string, Blob | Promise<Blob> | string> = {};
    class ClipboardItemMock {
      constructor(data: Record<string, Blob | Promise<Blob> | string>) {
        clipboardData = data;
      }
    }
    vi.stubGlobal("ClipboardItem", ClipboardItemMock);

    let resolveBlob!: (blob: Blob) => void;
    const content = new Promise<Blob>((resolve) => {
      resolveBlob = resolve;
    });
    const writeItems = vi.spyOn(clipboard, "writeItemsResult").mockImplementation(
      async () => {
        await clipboardData["image/png"];
        return { ok: true as const };
      }
    );

    const delivery = deliverExportClipboard({
      kind: "blob",
      format: "png",
      filename: "snapshot.png",
      mimeType: "image/png",
      content,
    });

    expect(writeItems).toHaveBeenCalledOnce();
    expect(clipboardData["image/png"]).toBeInstanceOf(Promise);

    resolveBlob(new Blob(["png"], { type: "image/png" }));
    await expect(delivery).resolves.toEqual({ ok: true, value: true });
  });

  it("preserves a raster failure through the Clipboard promise", async () => {
    let clipboardData: Record<string, Promise<Blob>> = {};
    class ClipboardItemMock {
      constructor(data: Record<string, Promise<Blob>>) {
        clipboardData = data;
      }
    }
    vi.stubGlobal("ClipboardItem", ClipboardItemMock);
    vi.spyOn(clipboard, "writeItemsResult").mockImplementation(async () => {
      try {
        await clipboardData["image/png"];
        return { ok: true as const };
      } catch (cause) {
        return { ok: false as const, cause };
      }
    });

    const result = await deliverExportClipboard({
      kind: "blob",
      format: "png",
      filename: "snapshot.png",
      mimeType: "image/png",
      content: Promise.reject(new ExportPipelineError("image-too-large")),
    });

    expect(result).toEqual({ ok: false, error: { code: "image-too-large" } });
  });
});
