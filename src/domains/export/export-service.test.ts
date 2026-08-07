import { describe, expect, it, vi } from "vitest";
import {
  deliverExportClipboard,
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
  includeColor: true,
  showGrid: false,
  ...overrides,
});

describe("export service", () => {

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
