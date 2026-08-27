import { describe, expect, it } from "vitest";
import { parseDocumentSessionSource } from "@/domains/document/public";

describe("CharDesk canvas text", () => {
  it("imports a canonical freeform document without rendering its envelope", () => {
    const snapshot = parseDocumentSessionSource([
      "---",
      "chardesk: document/v1",
      "mode: freeform",
      "title: Board",
      "---",
      "[31mA[0m",
    ].join("\n"));

    expect(snapshot).toMatchObject({
      mode: "freeform",
      name: "Board",
      grid: [["0,0", { char: "A", color: "#800000" }]],
    });
  });

  it("imports a canonical structured document without flattening its scene", () => {
    const snapshot = parseDocumentSessionSource([
      "---",
      "chardesk: document/v1",
      "mode: structured",
      "title: Diagram",
      "---",
      JSON.stringify({
        scene: [{
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 2 },
          style: { color: "#ff0000" },
        }],
        components: [],
      }),
    ].join("\n"));

    expect(snapshot).toMatchObject({
      mode: "structured",
      name: "Diagram",
      scene: [{ id: "box-1", type: "box" }],
      components: [],
    });
  });

  it("rejects broken structured references", () => {
    expect(() => parseDocumentSessionSource([
      "---",
      "chardesk: document/v1",
      "mode: structured",
      "---",
      JSON.stringify({
        scene: [],
        components: [{
          id: "component-1",
          templateId: "card",
          label: "Card",
          atomIds: ["missing"],
          roles: {},
        }],
      }),
    ].join("\n"))).toThrow("references a missing node");
  });

  it("imports visible ESC-less ANSI as a freeform canvas", () => {
    const snapshot = parseDocumentSessionSource(
      "[1;38;2;255;0;0mA界[0m\n]8;;https://example.com\\B]8;;\\"
    );

    expect(snapshot.mode).toBe("freeform");
    if (snapshot.mode !== "freeform") return;
    expect(snapshot.grid).toEqual([
      ["0,0", { char: "A", color: "#ff0000", attrs: { bold: true } }],
      ["1,0", { char: "界", color: "#ff0000", attrs: { bold: true } }],
      ["0,1", { char: "B", color: "#000000", href: "https://example.com" }],
    ]);
  });

  it("imports unstyled Unicode with inherited defaults", () => {
    const snapshot = parseDocumentSessionSource("人🙂");
    expect(snapshot).toMatchObject({
      mode: "freeform",
      grid: [
        ["0,0", { char: "人", color: "#000000" }],
        ["2,0", { char: "🙂", color: "#000000" }],
      ],
    });
  });

  it("rejects invisible escapes, malformed controls, and legacy JSON", () => {
    expect(() => parseDocumentSessionSource("\u001b[31mA\u001b[0m")).toThrow(
      "visible ESC-less ANSI"
    );
    expect(() => parseDocumentSessionSource("A\u0001B")).toThrow(
      "malformed or unsupported controls"
    );
    expect(() => parseDocumentSessionSource(
      '{"type":"chardesk-document","version":1,"mode":"freeform","cells":[]}'
    )).toThrow("Legacy JSON");
  });
});
