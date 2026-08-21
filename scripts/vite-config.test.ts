import path from "node:path";
import { describe, expect, it } from "vitest";

import config from "../vite.config";

describe("Vite workspace aliases", () => {
  it("serves the font stylesheet and its assets from the active worktree", () => {
    expect(config).not.toBeTypeOf("function");
    const aliases = Array.isArray(config.resolve?.alias) ? config.resolve.alias : [];
    const fontStylesheet = aliases.find(
      (alias) =>
        typeof alias === "object" &&
        alias.find instanceof RegExp &&
        alias.find.test("@chardesk/fonts/fonts.css")
    );

    expect(fontStylesheet).toMatchObject({
      replacement: path.resolve(import.meta.dirname, "../packages/fonts/fonts.css"),
    });
    expect(fontStylesheet && aliases.indexOf(fontStylesheet)).toBeLessThan(
      aliases.findIndex(
        (alias) =>
          typeof alias === "object" &&
          alias.find instanceof RegExp &&
          alias.find.test("@chardesk/fonts")
      )
    );
  });
});
