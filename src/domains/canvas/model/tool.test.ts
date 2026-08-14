import { describe, expect, it } from "vitest";

import { isToolAllowedForMode } from "./tool";

describe("canvas tool availability", () => {
  it("allows Hand in every canvas mode", () => {
    expect(isToolAllowedForMode("pan", "freeform")).toBe(true);
    expect(isToolAllowedForMode("pan", "structured")).toBe(true);
    expect(isToolAllowedForMode("pan", "slide")).toBe(true);
  });

  it("keeps mode-specific text tools constrained", () => {
    expect(isToolAllowedForMode("text", "structured")).toBe(true);
    expect(isToolAllowedForMode("text", "freeform")).toBe(false);
    expect(isToolAllowedForMode("arrowLine", "structured")).toBe(true);
    expect(isToolAllowedForMode("arrowLine", "slide")).toBe(false);
  });
});
