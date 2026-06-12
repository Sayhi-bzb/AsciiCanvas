import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLibraryStore } from "@/domains/character-library/stores/useLibraryStore";

const resetLibraryStore = () => {
  useLibraryStore.setState({
    data: null,
    isLoading: false,
    error: null,
    searchQuery: "",
    searchResults: [],
  });
};

const okJson = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const libraryPayloads: Record<string, unknown> = {
  entities: { symbols: { star: "*" } },
  related: {},
  unicode_blocks: {
    "Basic Latin": [{ char: "A", name: "LATIN CAPITAL LETTER A" }],
  },
  box_drawing: {
    "Box Drawing": [
      { char: "─", name: "BOX DRAWINGS LIGHT HORIZONTAL" },
    ],
  },
  nerdfonts_enriched: { icons: [{ name: "nf-test", char: "" }] },
  emojis_enriched: {
    "Smileys & Emotion": {
      "face-smiling": [{ name: "grinning face", char: "😀" }],
    },
  },
};

describe("useLibraryStore", () => {
  beforeEach(() => {
    resetLibraryStore();
    vi.restoreAllMocks();
  });

  it("loads library data and merges character labels", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const fileName = String(input).match(/\/data\/(.+)\.json$/)?.[1];
      return okJson(libraryPayloads[fileName ?? ""]);
    });

    await useLibraryStore.getState().fetchLibrary();

    const state = useLibraryStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.data?.unicodeBlocks["Basic Latin"]).toEqual([
      { char: "A", name: "LATIN CAPITAL LETTER A" },
    ]);
    expect(state.data?.characterLabels["─"]).toBe(
      "BOX DRAWINGS LIGHT HORIZONTAL"
    );
    expect(state.data?.characterLabels["😀"]).toBe("grinning face");
    expect(state.data?.characterLabels[""]).toBe("nf-test");
  });

  it("reports the file name when a data file returns HTML", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const fileName = String(input).match(/\/data\/(.+)\.json$/)?.[1];
      if (fileName === "unicode_blocks") {
        return new Response("<!DOCTYPE html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return okJson(libraryPayloads[fileName ?? ""]);
    });

    await useLibraryStore.getState().fetchLibrary();

    const state = useLibraryStore.getState();
    expect(state.data).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toContain("data/unicode_blocks.json");
    expect(state.error).toContain("text/html");
  });
});
