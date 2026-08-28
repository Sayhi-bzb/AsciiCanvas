import { describe, expect, it } from "vitest";
import { parseBlackboardManifest } from "./manifest.js";

const manifest = (areas: string, extra = "") => `
chardesk: blackboard/v1
title: GPU
panels:
  introduction:
    source: panels/introduction.panel
  architecture:
    source: panels/architecture.panel
  draft:
    source: panels/draft.panel
layout:
  areas: ${areas}
${extra}`;

describe("parseBlackboardManifest", () => {
  it("decodes named rectangular areas and default gaps", () => {
    const parsed = parseBlackboardManifest(manifest(
      "[[introduction, architecture], [null, architecture]]",
    ));
    expect(parsed.manifest).toMatchObject({
      chardesk: "blackboard/v1",
      title: "GPU",
      layout: {
        areas: [["introduction", "architecture"], [null, "architecture"]],
        gap: { column: 4, row: 1 },
      },
    });
    expect(parsed.warnings).toEqual([
      expect.objectContaining({ code: "unused-panel", panel: "draft" }),
    ]);
  });

  it("accepts explicit zero gaps", () => {
    const parsed = parseBlackboardManifest(manifest(
      "[[introduction, architecture]]",
      "  gap: { column: 0, row: 0 }",
    ));
    expect(parsed.manifest.layout.gap).toEqual({ column: 0, row: 0 });
  });

  it.each([
    ["unknown fields", `${manifest("[[introduction]]")}\ncolor: red`, "color is not supported"],
    ["unknown panels", manifest("[[missing]]"), "unknown panel"],
    ["ragged matrices", manifest("[[introduction, architecture], [architecture]]"), "exactly 2"],
    [
      "non-rectangular spans",
      manifest("[[architecture, architecture], [architecture, introduction]]"),
      "filled rectangle",
    ],
  ])("rejects %s", (_name, source, message) => {
    expect(() => parseBlackboardManifest(source)).toThrow(message);
  });
});
