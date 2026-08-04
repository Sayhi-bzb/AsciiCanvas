import { describe, expect, it } from "vitest";
import { HOST_ICONOLOGY } from "./iconology";

describe("host iconology", () => {
  it("maps the supported canvas modes", () => {
    expect(HOST_ICONOLOGY.canvasMode.freeform).toBeDefined();
    expect(HOST_ICONOLOGY.canvasMode.structured).toBeDefined();
    expect(Object.keys(HOST_ICONOLOGY.canvasMode)).toEqual(["freeform", "structured"]);
  });
});
