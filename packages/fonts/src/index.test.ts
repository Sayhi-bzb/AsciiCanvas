import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  CHARDESK_EMOJI_FONT_FAMILY,
  CHARDESK_FONT_PROFILE,
  CHARDESK_FONT_PROFILE_ID,
  CHARDESK_TEXT_FONT_FAMILY,
} from "./index.js";

describe("default font profile", () => {
  it("keeps its stable id, routes, and pinned source versions together", () => {
    expect(CHARDESK_FONT_PROFILE.id).toBe("chardesk/default-v1");
    expect(CHARDESK_FONT_PROFILE_ID).toBe(CHARDESK_FONT_PROFILE.id);
    expect(CHARDESK_FONT_PROFILE.families.text).toBe(
      CHARDESK_TEXT_FONT_FAMILY
    );
    expect(CHARDESK_FONT_PROFILE.families.emoji).toBe(
      CHARDESK_EMOJI_FONT_FAMILY
    );
    expect(CHARDESK_FONT_PROFILE.sources.map(({ id }) => id)).toEqual([
      "maple-mono-nf-cn",
      "maple-mono-nf-cn-bold",
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

    expect(manifest.profileId).toBe(CHARDESK_FONT_PROFILE.id);
    expect(
      manifest.sources.map(({ id, family, version }) => ({
        id,
        family,
        version,
      }))
    ).toEqual(CHARDESK_FONT_PROFILE.sources);
    expect(manifest.sources.map(({ family }) => family)).not.toContain("Inter");
    expect(manifest.sources.map(({ family }) => family)).not.toContain(
      "Noto Sans SC"
    );
  });
});
