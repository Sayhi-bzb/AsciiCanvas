import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ASCII_CANVAS_EMOJI_FONT_FAMILY,
  ASCII_CANVAS_FONT_PROFILE,
  ASCII_CANVAS_FONT_PROFILE_ID,
  ASCII_CANVAS_TEXT_FONT_FAMILY,
} from "./index.js";

describe("default font profile", () => {
  it("keeps its stable id, routes, and pinned source versions together", () => {
    expect(ASCII_CANVAS_FONT_PROFILE.id).toBe("ascii-canvas/default-v1");
    expect(ASCII_CANVAS_FONT_PROFILE_ID).toBe(ASCII_CANVAS_FONT_PROFILE.id);
    expect(ASCII_CANVAS_FONT_PROFILE.families.text).toBe(
      ASCII_CANVAS_TEXT_FONT_FAMILY
    );
    expect(ASCII_CANVAS_FONT_PROFILE.families.emoji).toBe(
      ASCII_CANVAS_EMOJI_FONT_FAMILY
    );
    expect(ASCII_CANVAS_FONT_PROFILE.sources.map(({ id }) => id)).toEqual([
      "maple-mono-nf-cn",
      "noto-sans-symbols-2",
      "noto-emoji",
    ]);
  });

  it("matches the published canvas manifest without UI fonts", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../manifest.json", import.meta.url), "utf8")
    ) as {
      profileId: string;
      sources: Array<{ id: string; family: string; version: string }>;
    };

    expect(manifest.profileId).toBe(ASCII_CANVAS_FONT_PROFILE.id);
    expect(
      manifest.sources.map(({ id, family, version }) => ({
        id,
        family,
        version,
      }))
    ).toEqual(ASCII_CANVAS_FONT_PROFILE.sources);
    expect(manifest.sources.map(({ family }) => family)).not.toContain("Inter");
    expect(manifest.sources.map(({ family }) => family)).not.toContain(
      "Noto Sans SC"
    );
  });
});
