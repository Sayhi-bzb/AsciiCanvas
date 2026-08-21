import { describe, expect, it } from "vitest";
import { createLayeredErDiagram, getErEndpointGlyphs } from "./er.js";

describe("ER ELK adapter", () => {
  it("rotates Unicode cardinality glyphs for every endpoint side", () => {
    expect(getErEndpointGlyphs("one", "right", false)).toEqual(["│"]);
    expect(getErEndpointGlyphs("one", "bottom", false)).toEqual(["─"]);
    expect(getErEndpointGlyphs("zero-one", "left", false)).toEqual(["│", "○"]);
    expect(getErEndpointGlyphs("many", "right", false)).toEqual(["╢"]);
    expect(getErEndpointGlyphs("many", "left", false)).toEqual(["╟"]);
    expect(getErEndpointGlyphs("many", "bottom", false)).toEqual(["╨"]);
    expect(getErEndpointGlyphs("many", "top", false)).toEqual(["╥"]);
    expect(getErEndpointGlyphs("zero-many", "top", false)).toEqual(["╥", "○"]);
  });

  it("uses directional ASCII cardinality glyphs", () => {
    expect(getErEndpointGlyphs("one", "top", true)).toEqual(["-"]);
    expect(getErEndpointGlyphs("zero-one", "right", true)).toEqual(["|", "o"]);
    expect(getErEndpointGlyphs("many", "right", true)).toEqual([">"]);
    expect(getErEndpointGlyphs("many", "left", true)).toEqual(["<"]);
    expect(getErEndpointGlyphs("many", "bottom", true)).toEqual(["v"]);
    expect(getErEndpointGlyphs("many", "top", true)).toEqual(["^"]);
  });

  it("creates a left-to-right graph with distributed entity ports", () => {
    const diagram = createLayeredErDiagram(`erDiagram
  A ||--o{ B : owns
  A {
    string id PK
  }`, {
      useAscii: false,
      paddingX: 5,
      paddingY: 5,
      boxBorderPadding: 1,
      graphDirection: "TD",
    })!;

    expect(diagram.graph.direction).toBe("LR");
    expect(diagram.graph.nodes.every((node) => node.portPlacement === "distributed"))
      .toBe(true);
    expect(diagram.graph.edges[0]).toMatchObject({
      source: "entity:A",
      target: "entity:B",
      label: { text: "owns", width: 4, height: 1 },
    });
  });
});
