import { describe, expect, it } from "vitest";
import {
  createCharGraphFragment,
  joinCharGraphLines,
  splitCharGraphLines,
  styleCharGraphFragments,
} from "./fragments.js";
import {
  normalizeCharGraphSource,
  restoreCharGraphSourceRanges,
} from "./source-map.js";

describe("CharGraph fragment algebra", () => {
  it("composes styles while retaining fragment identity", () => {
    const [styled] = styleCharGraphFragments([
      createCharGraphFragment(
        "code",
        { color: "#111111", attrs: { italic: true } },
        { from: 2, to: 6 },
        "https://example.com"
      ),
    ], { bgColor: "#eeeeee", attrs: { bold: true } });

    expect(styled).toMatchObject({
      text: "code",
      color: "#111111",
      bgColor: "#eeeeee",
      attrs: { italic: true, bold: true },
      href: "https://example.com",
      origin: { from: 2, to: 6 },
    });
  });

  it("splits and rejoins exact source ranges", () => {
    const lines = splitCharGraphLines([
      createCharGraphFragment("A\nB", {}, { from: 3, to: 6 }),
    ]);
    const joined = joinCharGraphLines(lines, { from: 4, to: 5 });

    expect(joined).toEqual([
      { text: "A", origin: { from: 3, to: 4 } },
      { text: "\n", origin: { from: 4, to: 5 } },
      { text: "B", origin: { from: 5, to: 6 } },
    ]);
  });

  it("maps normalized ranges back to CRLF source offsets", () => {
    const normalized = normalizeCharGraphSource("A\r\nB");
    const restored = restoreCharGraphSourceRanges(normalized, {
      fragments: [createCharGraphFragment("\n", {}, { from: 1, to: 2 })],
      recognized: true,
      diagnostics: [{ code: "fixture", message: "fixture", offset: 1, length: 1 }],
    });

    expect(restored.fragments[0]?.origin).toEqual({ from: 1, to: 3 });
    expect(restored.diagnostics[0]).toMatchObject({ offset: 1, length: 2 });
  });
});
