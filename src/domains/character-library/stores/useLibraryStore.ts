import { create } from "zustand";

interface CharacterEntry {
  char: string;
  name: string;
}

interface LibraryData {
  entities: Record<string, Record<string, string>>;
  related: Record<string, string[]>;
  boxDrawing: Record<string, CharacterEntry[]>;
  nerdfonts: Record<string, { name: string; char: string }[]>;
  emojis: Record<string, Record<string, { name: string; char: string }[]>>;
  characterLabels: Record<string, string>;
}

interface LibraryState {
  data: LibraryData | null;
  isLoading: boolean;
  error: string | null;
  unicodeBlocks: Record<string, CharacterEntry[]> | null;
  unicodeIsLoading: boolean;
  unicodeError: string | null;
  searchQuery: string;
  searchResults: string[];
  fetchLibrary: () => Promise<void>;
  fetchUnicodeBlocks: () => Promise<void>;
  setSearchQuery: (query: string) => void;
}

const fetchLibraryJson = async (base: string, file: string) => {
  const path = `data/${file}.json`;
  const response = await fetch(`${base}${path}`);

  if (!response.ok) {
    throw new Error(
      `Failed to load ${path}: ${response.status} ${response.statusText}`.trim()
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("json")) {
    throw new Error(`Expected JSON for ${path}, received ${contentType}`);
  }

  try {
    return await response.json();
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`Failed to parse ${path} as JSON${detail}`);
  }
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  unicodeBlocks: null,
  unicodeIsLoading: false,
  unicodeError: null,
  searchQuery: "",
  searchResults: [],

  fetchLibrary: async () => {
    if (get().data) return;

    set({ isLoading: true, error: null });
    try {
      const base = import.meta.env.BASE_URL;
      const files = [
        "entities",
        "related",
        "box_drawing",
        "nerdfonts_enriched",
        "emojis_enriched",
      ];
      const [
        entities,
        related,
        boxDrawing,
        nerdfonts,
        emojis,
      ] =
        await Promise.all(
          files.map((file) => fetchLibraryJson(base, file))
        );

      set({
        data: {
          entities,
          related,
          boxDrawing,
          nerdfonts,
          emojis,
          characterLabels: buildNamedCharacterLookup(
            entities,
            boxDrawing,
            nerdfonts,
            emojis
          ),
        },
        isLoading: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load library data";
      set({ error: message, isLoading: false });
      console.error("Library fetch error:", err);
    }
  },

  fetchUnicodeBlocks: async () => {
    if (get().unicodeBlocks || get().unicodeIsLoading) return;

    set({ unicodeIsLoading: true, unicodeError: null });
    try {
      const base = import.meta.env.BASE_URL;
      const unicodeBlocks = await fetchLibraryJson(base, "unicode_blocks");

      set((state) => ({
        unicodeBlocks,
        unicodeIsLoading: false,
        data: state.data
          ? {
              ...state.data,
              characterLabels: {
                ...state.data.characterLabels,
                ...buildEntryLookup(unicodeBlocks),
              },
            }
          : state.data,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load Unicode blocks";
      set({ unicodeError: message, unicodeIsLoading: false });
      console.error("Unicode blocks fetch error:", err);
    }
  },

  setSearchQuery: (query: string) => {
    const { data } = get();
    if (!data || !query.trim()) {
      set({ searchQuery: query, searchResults: [] });
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = new Set<string>();

    Object.values(data.entities).forEach((category) => {
      Object.entries(category).forEach(([name, char]) => {
        if (name.toLowerCase().includes(lowerQuery)) results.add(char);
      });
    });

    Object.values(data.nerdfonts).forEach((items) => {
      items.forEach((item) => {
        if (item.name.toLowerCase().includes(lowerQuery)) {
          results.add(item.char);
        }
      });
    });

    Object.values(data.emojis).forEach((group) => {
      Object.values(group).forEach((subgroup) => {
        subgroup.forEach((item) => {
          if (item.name.toLowerCase().includes(lowerQuery)) {
            results.add(item.char);
          }
        });
      });
    });

    if (query.length === 1 && data.related[query]) {
      data.related[query].forEach((char) => results.add(char));
    }

    set({
      searchQuery: query,
      searchResults: Array.from(results).slice(0, 100),
    });
  },
}));

const buildNamedCharacterLookup = (
  entities: Record<string, Record<string, string>>,
  boxDrawing: Record<string, CharacterEntry[]>,
  nerdfonts: Record<string, { name: string; char: string }[]>,
  emojis: Record<string, Record<string, { name: string; char: string }[]>>
) => {
  const lookup: Record<string, string> = {};

  Object.values(entities).forEach((category) => {
    Object.entries(category).forEach(([name, char]) => {
      lookup[char] = name;
    });
  });

  Object.assign(lookup, buildEntryLookup(boxDrawing));

  Object.values(nerdfonts).forEach((items) => {
    items.forEach((item) => {
      lookup[item.char] = item.name;
    });
  });

  Object.values(emojis).forEach((group) => {
    Object.values(group).forEach((subgroup) => {
      subgroup.forEach((item) => {
        lookup[item.char] = item.name;
      });
    });
  });

  return lookup;
};

const buildEntryLookup = (groups: Record<string, CharacterEntry[]>) => {
  const lookup: Record<string, string> = {};

  Object.values(groups).forEach((items) => {
    items.forEach((item) => {
      lookup[item.char] = item.name;
    });
  });

  return lookup;
};
