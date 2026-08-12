import { describe, expect, it } from "vitest";
import {
  CHARDESK_DOCUMENT_TYPE,
  CHARDESK_DOCUMENT_VERSION,
  buildFreeformCharDeskDocument,
  buildStructuredCharDeskDocument,
  isCharDeskDocument,
  charDeskDocumentToSnapshot,
} from "@/domains/document/public";

describe("CharDesk document protocol", () => {
  it("round-trips a freeform document", () => {
    const document = buildFreeformCharDeskDocument(
      new Map([["0,0", { char: "A", color: "#ffffff" }]])
    );
    expect(document).toEqual({
      type: CHARDESK_DOCUMENT_TYPE,
      version: CHARDESK_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [{ x: 0, y: 0, char: "A", color: "#ffffff" }],
    });
    expect(isCharDeskDocument(document)).toBe(true);
    expect(charDeskDocumentToSnapshot(document).grid).toEqual([
      ["0,0", { char: "A", color: "#ffffff" }],
    ]);
  });

  it("preserves structured nodes", () => {
    const document = buildStructuredCharDeskDocument([
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
    expect(charDeskDocumentToSnapshot(document).mode).toBe("structured");
  });

  it("round-trips structured arrow line markers", () => {
    const document = buildStructuredCharDeskDocument([
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
    ]);

    expect(document.nodes[0]).toMatchObject({ endMarker: "arrow" });
    expect(charDeskDocumentToSnapshot(document).scene[0]).toMatchObject({
      type: "line",
      endMarker: "arrow",
    });
  });

  it("rejects unknown structured line markers", () => {
    expect(isCharDeskDocument({
      type: CHARDESK_DOCUMENT_TYPE,
      version: CHARDESK_DOCUMENT_VERSION,
      mode: "structured",
      nodes: [
        {
          id: "invalid-line",
          type: "line",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 0 },
          axis: "horizontal",
          endMarker: "diamond",
          style: { color: "#ffffff" },
        },
      ],
    })).toBe(false);
  });
});
