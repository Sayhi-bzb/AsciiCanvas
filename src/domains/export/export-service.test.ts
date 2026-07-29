import { describe, expect, it, vi } from "vitest";
import {
  deliverExportClipboard,
  getAvailableExportFormats,
  prepareExport,
  prepareTextExport,
  type ExportContext,
} from "@/domains/export/public";
import { clipboard } from "@/shared/services/effects";
import {
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "@/domains/document/public";

const createContext = (
  overrides: Partial<ExportContext> = {}
): ExportContext => ({
  canvasMode: "freeform",
  grid: new Map([["0,0", { char: "A", color: "#ffffff" }]]),
  structuredScene: [],
  structuredComponents: [],
  canvasBounds: null,
  animationTimeline: null,
  includeColor: true,
  showGrid: false,
  ...overrides,
});

describe("export service", () => {
  it("derives available formats from the session mode", () => {
    expect(
      getAvailableExportFormats("freeform").map(({ format }) => format)
    ).toEqual(["txt", "ascanvas", "ansi", "png"]);
    expect(
      getAvailableExportFormats("structured").map(({ format }) => format)
    ).toEqual(["txt", "ascanvas", "ansi", "png"]);
    expect(
      getAvailableExportFormats("animation").map(({ format }) => format)
    ).toEqual(["ascanvas", "cast", "gif"]);
  });

  it("builds a round-trippable AsciiCanvas project artifact", () => {
    const result = prepareTextExport(createContext(), "ascanvas");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      kind: "text",
      format: "ascanvas",
      mimeType: "application/vnd.ascii-canvas+json;charset=utf-8",
    });
    expect(result.value.filename).toMatch(/^ascii-canvas-\d+\.ascanvas$/);
    const snapshot = protocolDocumentToSnapshot(
      parseProtocolDocument(result.value.content)
    );
    expect(snapshot).toMatchObject({
      mode: "freeform",
      grid: [["0,0", { char: "A", color: "#ffffff" }]],
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
    expect(result.value.filename).toMatch(/^ascii-canvas-\d+\.txt$/);
  });

  it("returns a typed error when animation state is incomplete", async () => {
    const result = await prepareExport(
      createContext({ canvasMode: "animation" }),
      "gif"
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "missing-animation-state" },
    });
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
});
