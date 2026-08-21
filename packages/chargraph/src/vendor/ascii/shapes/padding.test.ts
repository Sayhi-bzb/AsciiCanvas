import { describe, expect, it } from "vitest";
import { getShapeDimensions, renderShape } from "./index.js";

describe("shape padding", () => {
  it("supports horizontal breathing room without vertical blank rows", () => {
    const dimensions = getShapeDimensions("rectangle", "AB", {
      useAscii: false,
      padding: 0,
      paddingX: 1,
      paddingY: 0,
    });

    expect(dimensions).toMatchObject({
      width: 6,
      height: 3,
      labelArea: { x: 2, y: 1, width: 2, height: 1 },
    });
  });

  it("keeps scalar padding as the axis fallback", () => {
    const dimensions = getShapeDimensions("rectangle", "AB", {
      useAscii: false,
      padding: 1,
    });

    expect(dimensions).toMatchObject({
      width: 6,
      height: 5,
      labelArea: { x: 2, y: 2, width: 2, height: 1 },
    });
  });

  it.each(["rectangle", "stadium", "subroutine", "cylinder"] as const)(
    "keeps %s dimensions aligned with its rendered canvas",
    (shape) => {
      const options = {
        useAscii: false,
        padding: 0,
        paddingX: 1,
        paddingY: 0,
      };
      const dimensions = getShapeDimensions(shape, "节点", options);
      const canvas = renderShape(shape, "节点", options);

      expect(canvas.length).toBe(dimensions.width);
      expect(canvas[0]?.length).toBe(dimensions.height);
    },
  );
});
