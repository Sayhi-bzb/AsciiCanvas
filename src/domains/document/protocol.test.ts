import { describe, expect, it } from "vitest";
import {
  ASCII_CANVAS_DOCUMENT_TYPE,
  ASCII_CANVAS_DOCUMENT_VERSION,
  buildFreeformProtocolDocument,
  buildStructuredProtocolDocument,
  isAsciiCanvasDocument,
  protocolDocumentToSnapshot,
} from "@/domains/document/public";

describe("AsciiCanvas document protocol", () => {
  it("round-trips a freeform document", () => {
    const document = buildFreeformProtocolDocument(
      new Map([["0,0", { char: "A", color: "#ffffff" }]])
    );
    expect(document).toEqual({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [{ x: 0, y: 0, char: "A", color: "#ffffff" }],
    });
    expect(isAsciiCanvasDocument(document)).toBe(true);
    expect(protocolDocumentToSnapshot(document).grid).toEqual([
      ["0,0", { char: "A", color: "#ffffff" }],
    ]);
  });

  it("preserves structured nodes", () => {
    const document = buildStructuredProtocolDocument([
      {
        id: "box-1",
        type: "box",
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 4, y: 2 },
        style: { color: "#ffffff" },
      },
    ]);
    expect(document.mode).toBe("structured");
    expect(document.nodes).toHaveLength(1);
    expect(protocolDocumentToSnapshot(document).mode).toBe("structured");
  });
});
