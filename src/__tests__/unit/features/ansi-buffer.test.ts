import { describe, expect, it } from "vitest";
import { renderAnsiAnimationDocument } from "@/domains/ansi-animation/utils/ansi-buffer";

describe("ANSI animation buffer", () => {
  it("renders text, truecolor, cursor movement, and clear-screen commands", () => {
    const frame = renderAnsiAnimationDocument({
      script: "\u001b[2J\u001b[2;3H\u001b[38;2;255;0;0mHi\u001b[0m\n!",
      width: 8,
      height: 4,
      fps: 12,
      background: "#0f0f0f",
    });

    expect(frame.width).toBe(8);
    expect(frame.height).toBe(4);
    expect(frame.cells).toEqual([
      ["2,1", { char: "H", color: "#ff0000" }],
      ["3,1", { char: "i", color: "#ff0000" }],
      ["0,2", { char: "!", color: "#e5e7eb" }],
    ]);
  });
});
