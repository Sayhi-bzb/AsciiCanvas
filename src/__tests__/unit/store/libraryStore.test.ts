import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLibraryStore } from "@/domains/character-library/stores/useLibraryStore";

const resetLibraryStore = () => {
  useLibraryStore.setState({
    data: null,
    isLoading: false,
    error: null,
    unicodeBlocks: null,
    unicodeIsLoading: false,
    unicodeError: null,
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

const mockLibraryFetch = (
  override?: (fileName: string | undefined) => Response | undefined
) => {
  const requested: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const fileName = String(input).match(/\/data\/(.+)\.json$/)?.[1];
    if (fileName) requested.push(fileName);
    const overridden = override?.(fileName);
    if (overridden) return overridden;
    return okJson(libraryPayloads[fileName ?? ""]);
  });
  return requested;
};

describe("useLibraryStore", () => {
  beforeEach(() => {
    resetLibraryStore();
    vi.restoreAllMocks();
  });

  it("loads base library data without fetching Unicode blocks", async () => {
    const requested = mockLibraryFetch();

    await useLibraryStore.getState().fetchLibrary();

    const state = useLibraryStore.getState();
    expect(requested).not.toContain("unicode_blocks");
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.unicodeBlocks).toBeNull();
    expect(state.data?.characterLabels["─"]).toBe(
      "BOX DRAWINGS LIGHT HORIZONTAL"
    );
    expect(state.data?.characterLabels["😀"]).toBe("grinning face");
    expect(state.data?.characterLabels[""]).toBe("nf-test");
  });

  it("loads Unicode blocks on demand and merges Unicode labels", async () => {
    mockLibraryFetch();

    await useLibraryStore.getState().fetchLibrary();
    await useLibraryStore.getState().fetchUnicodeBlocks();

    const state = useLibraryStore.getState();
    expect(state.unicodeBlocks?.["Basic Latin"]).toEqual([
      { char: "A", name: "LATIN CAPITAL LETTER A" },
    ]);
    expect(state.unicodeIsLoading).toBe(false);
    expect(state.unicodeError).toBeNull();
    expect(state.data?.characterLabels.A).toBe("LATIN CAPITAL LETTER A");
  });

  it("reports the file name when base data returns HTML", async () => {
    mockLibraryFetch((fileName) => {
      if (fileName === "box_drawing") {
        return new Response("<!DOCTYPE html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return undefined;
    });

    await useLibraryStore.getState().fetchLibrary();

    const state = useLibraryStore.getState();
    expect(state.data).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toContain("data/box_drawing.json");
    expect(state.error).toContain("text/html");
  });

  it("keeps base library data when Unicode loading fails", async () => {
    mockLibraryFetch((fileName) => {
      if (fileName === "unicode_blocks") {
        return new Response("<!DOCTYPE html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return undefined;
    });

    await useLibraryStore.getState().fetchLibrary();
    await useLibraryStore.getState().fetchUnicodeBlocks();

    const state = useLibraryStore.getState();
    expect(state.data).not.toBeNull();
    expect(state.unicodeBlocks).toBeNull();
    expect(state.unicodeIsLoading).toBe(false);
    expect(state.unicodeError).toContain("data/unicode_blocks.json");
  });
});
