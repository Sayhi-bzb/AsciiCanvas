import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  publishCanvasFiles,
  seedCanvasFiles,
  validateStyledCanvas,
} from "./authoring.js";

describe("canvas authoring", () => {
  it("accepts sparse styling and a default-only candidate", () => {
    expect(validateStyledCanvas("A界", "[31mA[0m界")).toMatchObject({ accepted: true });
    expect(validateStyledCanvas("A界", "A界")).toMatchObject({ accepted: true });
  });

  it("rejects malformed controls and geometry changes", () => {
    expect(validateStyledCanvas("red", "[999mred[0m")).toMatchObject({
      accepted: false,
      code: "invalid-ansi",
    });
    expect(validateStyledCanvas("box", "[31mbax[0m")).toMatchObject({
      accepted: false,
      code: "geometry-mismatch",
    });
    expect(validateStyledCanvas("red", "\u001b[31mred\u001b[0m")).toMatchObject({
      accepted: false,
      code: "invalid-ansi",
    });
  });

  it("seeds once and publishes the styled source verbatim", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-authoring-"));
    const plain = join(root, "plain.txt");
    const styled = join(root, "styled.ans");
    const output = join(root, "result.chardesk");
    await writeFile(plain, "A界", "utf8");

    await expect(seedCanvasFiles(plain, styled)).resolves.toMatchObject({ status: "created" });
    await writeFile(styled, "[31mA[0m界", "utf8");
    await expect(seedCanvasFiles(plain, styled)).resolves.toMatchObject({ status: "exists" });
    await expect(publishCanvasFiles(plain, styled, output)).resolves.toMatchObject({ accepted: true });

    await expect(readFile(output, "utf8")).resolves.toBe("[31mA[0m界");
  });

  it("preserves the previous product file when validation fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-authoring-"));
    const plain = join(root, "plain.txt");
    const styled = join(root, "styled.ans");
    const output = join(root, "result.chardesk");
    await Promise.all([
      writeFile(plain, "A", "utf8"),
      writeFile(styled, "B", "utf8"),
      writeFile(output, "previous", "utf8"),
    ]);
    await expect(publishCanvasFiles(plain, styled, output)).resolves.toMatchObject({ accepted: false });
    await expect(readFile(output, "utf8")).resolves.toBe("previous");
  });
});
