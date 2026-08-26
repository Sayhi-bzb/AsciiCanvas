import { describe, expect, it } from "vitest";
import { parseCharDeskFontFaces } from "./fonts.js";

describe("CharDesk Node font CSS", () => {
  it("resolves generated font faces and Unicode ranges", () => {
    const faces = parseCharDeskFontFaces(`
      @font-face {
        font-family: 'Example Mono';
        font-weight: 700;
        src: url(./assets/example.woff2) format('woff2');
        unicode-range: U+41-5A, U+1F600;
      }
    `, "/fonts/fonts.css");

    expect(faces).toEqual([{
      family: "Example Mono",
      path: "/fonts/assets/example.woff2",
      weight: 700,
      ranges: [
        { from: 0x41, to: 0x5a },
        { from: 0x1f600, to: 0x1f600 },
      ],
    }]);
  });
});
