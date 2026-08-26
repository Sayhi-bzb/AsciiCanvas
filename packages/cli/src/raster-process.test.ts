import { describe, expect, it } from "vitest";
import { renderSourceInRasterProcess } from "./raster-process.js";

describe("PNG raster process", () => {
  it("maps a native process signal to a stable CLI error", async () => {
    await expect(renderSourceInRasterProcess({
      source: "A",
      inputMode: "chargraph",
    }, {
      workerUrl: new URL("./test-fixtures/raster-crash.mjs", import.meta.url),
    })).rejects.toMatchObject({ code: "raster-backend-crash" });
  });
});
