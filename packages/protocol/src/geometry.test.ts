import { describe, expect, it } from "vitest";
import {
  compareCharDeskGeometry,
  createCharDeskGeometrySnapshot,
} from "./index.js";

describe("CharDesk geometry comparison", () => {
  it("accepts style-only changes across ASCII and CJK cells", () => {
    const plain = "┌────┐\n│你好│\n└────┘";
    const ansi = "[34m┌────┐[0m\n│[1;31m你好[0m│\n[34m└────┘[0m";
    const result = compareCharDeskGeometry(plain, ansi);

    expect(result.matches).toBe(true);
    expect(result.actual.hasAnsi).toBe(true);
    expect(result.actual.signature).toBe(result.expected.signature);
  });

  it("rejects visible text changes even when cell geometry is unchanged", () => {
    const result = compareCharDeskGeometry("cat", "[31mdog[0m");

    expect(result.matches).toBe(false);
    expect(result.mismatch).toMatchObject({ code: "plain-text", offset: 0 });
  });

  it("detects ANSI inserted inside a grapheme cluster", () => {
    const result = compareCharDeskGeometry("e\u0301", "e[31m\u0301[0m");

    expect(result.matches).toBe(false);
    expect(result.mismatch?.code).not.toBe("plain-text");
  });

  it("normalizes plain tabs and line endings before signing", () => {
    const snapshot = createCharDeskGeometrySnapshot("A\t界\r\n", {
      syntax: "plain",
      tabSize: 4,
    });

    expect(snapshot).toMatchObject({
      plainText: "A   界\n",
      width: 6,
      height: 2,
    });
    expect(snapshot.signature).toMatch(/^v1:6x2:[0-9a-f]{8}$/);
  });
});
