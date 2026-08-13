import { describe, expect, it } from "vitest";
import {
  resolveEditorFormFactor,
  resolveEditorViewportFrame,
  resolveSidebarPresentation,
} from "./public";

const rect = (
  left: number,
  top: number,
  width: number,
  height: number
) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe("editor chrome geometry", () => {
  it("resolves container form factors and sidebar presentations", () => {
    expect(resolveEditorFormFactor(1400)).toBe("desktop");
    expect(resolveEditorFormFactor(1199)).toBe("compact");
    expect(resolveEditorFormFactor(767)).toBe("phone");
    expect(resolveSidebarPresentation("desktop")).toBe("docked");
    expect(resolveSidebarPresentation("compact")).toBe("overlay");
    expect(resolveSidebarPresentation("phone")).toBe("sheet");
  });

  it("aggregates occupied edges into one usable viewport", () => {
    const frame = resolveEditorViewportFrame(rect(0, 0, 1000, 700), [
      { edge: "top", rect: rect(12, 12, 320, 32) },
      { edge: "top", rect: rect(500, 12, 100, 40) },
      { edge: "bottom", rect: rect(300, 650, 400, 38) },
      { edge: "right", rect: rect(700, 12, 288, 676) },
    ]);

    expect(frame.insets).toEqual({ top: 52, right: 300, bottom: 50, left: 0 });
    expect(frame.usableRect).toEqual({
      x: 0,
      y: 52,
      width: 700,
      height: 598,
    });
    expect(frame.center).toEqual({ x: 350, y: 351 });
  });
});
