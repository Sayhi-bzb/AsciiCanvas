import { describe, expect, it } from "vitest";
import { buildStructuredTemplateNodes } from "@/domains/canvas/state/helpers/structuredTemplates";

describe("structuredTemplates", () => {
  it("builds a button template as a bg layer plus text", () => {
    const nodes = buildStructuredTemplateNodes(
      "button",
      { x: 4, y: 7 },
      { brushColor: "#334155", startOrder: 10 }
    );

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      type: "bg",
      order: 10,
      start: { x: 4, y: 7 },
      end: { x: 11, y: 7 },
      style: { bgColor: "#334155" },
    });
    expect(nodes[1]).toMatchObject({
      type: "text",
      order: 11,
      position: { x: 5, y: 7 },
      text: "BUTTON",
    });
  });
});
