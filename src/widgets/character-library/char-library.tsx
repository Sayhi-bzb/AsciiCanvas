"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { writeClipboardPayload } from "@/domains/actions/public";
import { useCanvasState } from "@/domains/canvas/public";
import {
  useLibraryStore,
  type CharacterGroup,
  type CharacterPackId,
  type CharacterRecord,
  type CharacterViewId,
  type UnicodeFacetType,
} from "@/domains/character-library/public";
import { cn } from "@/shared/lib/utils";
import { getRenderFontFamilyForGrapheme } from "@/shared/metrics";
import { feedback } from "@/shared/services/effects";
import { useUiI18n, type I18nKey } from "@/shared/i18n";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

const PAGE_SIZE = 240;

const UNICODE_FACET_LABEL_KEYS: Record<UnicodeFacetType, I18nKey> = {
  block: "character.unicode.block",
  script: "character.unicode.script",
  category: "character.unicode.category",
};

const CHARACTER_GROUP_LABEL_KEYS: Record<
  CharacterPackId,
  Record<string, I18nKey>
> = {
  essentials: {
    ascii: "character.group.essentials.ascii",
    lines: "character.group.essentials.lines",
    arrows: "character.group.essentials.arrows",
    shapes: "character.group.essentials.shapes",
    math: "character.group.essentials.math",
    technical: "character.group.essentials.technical",
    numbers: "character.group.essentials.numbers",
    dingbats: "character.group.essentials.dingbats",
    braille: "character.group.essentials.braille",
    "common-symbols": "character.group.essentials.common-symbols",
  },
  nerd: {
    "seti-ui-custom": "character.group.nerd.seti-ui-custom",
    devicons: "character.group.nerd.devicons",
    "font-awesome": "character.group.nerd.font-awesome",
    "font-awesome-ext": "character.group.nerd.font-awesome-ext",
    "material-design": "character.group.nerd.material-design",
    "weather-icons": "character.group.nerd.weather-icons",
    octicons: "character.group.nerd.octicons",
    "powerline-symbols": "character.group.nerd.powerline-symbols",
    "powerline-extra": "character.group.nerd.powerline-extra",
    "iec-power": "character.group.nerd.iec-power",
    "font-logos": "character.group.nerd.font-logos",
    pomicons: "character.group.nerd.pomicons",
    codicons: "character.group.nerd.codicons",
    "progress-indicators": "character.group.nerd.progress-indicators",
    "heavy-angle-brackets": "character.group.nerd.heavy-angle-brackets",
  },
  emoji: {
    "smileys-emotion": "character.group.emoji.smileys-emotion",
    "people-body": "character.group.emoji.people-body",
    component: "character.group.emoji.component",
    "animals-nature": "character.group.emoji.animals-nature",
    "food-drink": "character.group.emoji.food-drink",
    "travel-places": "character.group.emoji.travel-places",
    activities: "character.group.emoji.activities",
    objects: "character.group.emoji.objects",
    symbols: "character.group.emoji.symbols",
    flags: "character.group.emoji.flags",
  },
};

const getCodePointLabel = (grapheme: string) =>
  Array.from(grapheme)
    .map((part) => {
      const codePoint = part.codePointAt(0);
      return codePoint === undefined
        ? ""
        : `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
    })
    .filter(Boolean)
    .join(" ");

function CharButton({
  entry,
  isSelected,
  onClick,
}: {
  entry: CharacterRecord;
  isSelected: boolean;
  onClick: (entry: CharacterRecord) => void;
}) {
  const { t } = useUiI18n();
  const codePoints = getCodePointLabel(entry.grapheme);
  const unavailable = !entry.insertable;
  const tooltipLabel = `${entry.name} · ${codePoints}${
    unavailable ? ` · ${t("character.metadataOnly")}` : ""
  }`;
  const preview = entry.category.startsWith("M")
    ? `◌${entry.grapheme}`
    : entry.category === "Zs"
      ? "␠"
      : entry.grapheme;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={tooltipLabel}
          data-character-codepoints={codePoints}
          disabled={unavailable}
          onClick={() => onClick(entry)}
          style={{ fontFamily: getRenderFontFamilyForGrapheme(entry.grapheme) }}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md p-0 font-mono text-sm leading-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            isSelected
              ? "bg-accent text-foreground"
              : "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
            unavailable && "cursor-not-allowed opacity-35"
          )}
        >
          {preview}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div data-slot="tooltip-title" className="font-medium">
          {entry.name}
        </div>
        <div
          data-slot="tooltip-meta"
          className="mt-0.5 font-mono text-[10px] text-background/70"
        >
          {codePoints} &middot; {entry.category}
        </div>
        {unavailable && (
          <div
            data-slot="tooltip-status"
            className="mt-1 text-[10px] text-background/70"
          >
            {t("character.metadataOnly")}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function CharacterGrid({
  entries,
  copiedChar,
  onSelect,
  paged = true,
}: {
  entries: CharacterRecord[];
  copiedChar: string | null;
  onSelect: (entry: CharacterRecord) => void;
  paged?: boolean;
}) {
  const { t } = useUiI18n();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleEntries = paged ? entries.slice(0, visibleCount) : entries;
  return (
    <>
      <div className="flex flex-wrap gap-0.5 overflow-hidden py-1">
        {visibleEntries.map((entry) => (
          <CharButton
            key={`${entry.id}-${entry.grapheme}`}
            entry={entry}
            isSelected={copiedChar === entry.grapheme}
            onClick={onSelect}
          />
        ))}
      </div>
      {paged && visibleCount < entries.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
          className="my-1 h-7 rounded-md bg-accent px-2 text-[11px] font-medium text-accent-foreground"
        >
          {t("character.showMore", {
            count: Math.min(PAGE_SIZE, entries.length - visibleCount),
          })}
        </button>
      )}
    </>
  );
}

function GroupSection({
  pack,
  group,
  defaultOpen,
  copiedChar,
  onSelect,
}: {
  pack: CharacterPackId;
  group: CharacterGroup;
  defaultOpen: boolean;
  copiedChar: string | null;
  onSelect: (entry: CharacterRecord) => void;
}) {
  const { t } = useUiI18n();
  const labelKey = CHARACTER_GROUP_LABEL_KEYS[pack][group.id];
  const label = labelKey ? t(labelKey) : group.label;

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/character-group">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="truncate">{label}</span>
          <span className="ml-auto text-[10px] tabular-nums">
            {group.entries.length}
          </span>
          <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]/character-group:rotate-90" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1">
        <CharacterGrid
          entries={group.entries}
          copiedChar={copiedChar}
          onSelect={onSelect}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function EmptySearch() {
  const { t } = useUiI18n();
  return (
    <p className="px-2 py-4 text-xs text-muted-foreground">
      {t("character.empty")}
    </p>
  );
}

function PackPane({
  pack,
  copiedChar,
  onSelect,
}: {
  pack: CharacterPackId;
  copiedChar: string | null;
  onSelect: (entry: CharacterRecord) => void;
}) {
  const { t } = useUiI18n();
  const groups = useLibraryStore((state) => state.packs[pack]);
  const status = useLibraryStore((state) => state.packStatus[pack]);
  const error = useLibraryStore((state) => state.packErrors[pack]);
  const query = useLibraryStore((state) => state.searchQueries[pack]);
  const results = useLibraryStore((state) => state.searchResults[pack]);
  const retryPack = useLibraryStore((state) => state.retryPack);

  if (query.trim()) {
    return (
      <div className="p-2 pb-10">
        <p className="px-1 pb-2 text-[11px] text-muted-foreground">
          {t("character.results", { count: results.length })}
        </p>
        {results.length ? (
          <CharacterGrid
            entries={results}
            copiedChar={copiedChar}
            onSelect={onSelect}
            paged={false}
          />
        ) : (
          <EmptySearch />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2 pb-10">
      {status === "loading" && (
        <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {t("character.loading")}
        </div>
      )}
      {error && (
        <div className="space-y-2 px-2 py-3 text-[11px] text-muted-foreground">
          <p className="break-words">{error}</p>
          <button
            type="button"
            onClick={() => void retryPack(pack)}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2 text-foreground"
          >
            <RefreshCcw className="size-3" /> {t("character.retry")}
          </button>
        </div>
      )}
      {groups?.map((group, index) => (
        <GroupSection
          key={group.id}
          pack={pack}
          group={group}
          defaultOpen={index === 0}
          copiedChar={copiedChar}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function UnicodePane({
  copiedChar,
  onSelect,
}: {
  copiedChar: string | null;
  onSelect: (entry: CharacterRecord) => void;
}) {
  const { t } = useUiI18n();
  const {
    unicodeManifest,
    unicodeStatus,
    unicodeError,
    unicodeFacetType,
    unicodeFacetId,
    unicodeResults,
    unicodeOffset,
    unicodeHasMore,
    loadUnicodeManifest,
    loadUnicodePage,
  } = useLibraryStore();
  const [facetType, setFacetType] = useState<UnicodeFacetType>("block");

  useEffect(() => {
    void loadUnicodeManifest();
  }, [loadUnicodeManifest]);

  useEffect(() => {
    if (!unicodeManifest || unicodeFacetId) return;
    const first = unicodeManifest.facets[facetType][0];
    if (first) void loadUnicodePage(facetType, first.id);
  }, [facetType, loadUnicodePage, unicodeFacetId, unicodeManifest]);

  const selectFacetType = async (value: UnicodeFacetType) => {
    setFacetType(value);
    const first = unicodeManifest?.facets[value][0];
    if (first) await loadUnicodePage(value, first.id);
  };

  const selectedFacetId =
    unicodeFacetType === facetType && unicodeFacetId
      ? unicodeFacetId
      : unicodeManifest?.facets[facetType][0]?.id;

  return (
    <div className="space-y-2 p-2 pb-10">
      {unicodeStatus === "loading" && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {t("character.loadingIndex")}
        </div>
      )}
      {unicodeError && (
        <p className="break-words text-[11px] text-destructive">
          {unicodeError}
        </p>
      )}
      {unicodeManifest && (
        <>
          <div className="flex rounded-lg bg-muted p-[3px]">
            {(["block", "script", "category"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => void selectFacetType(type)}
                className={cn(
                  "h-7 flex-1 rounded-md px-1 text-[10px] capitalize transition-colors",
                  facetType === type
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(UNICODE_FACET_LABEL_KEYS[type])}
              </button>
            ))}
          </div>
          <Select
            value={selectedFacetId}
            onValueChange={(value) =>
              void loadUnicodePage(facetType, value)
            }
          >
            <SelectTrigger
              aria-label={t("character.unicodeFacet")}
              size="sm"
              className="w-full border-0 bg-accent/60 px-2 text-[11px] shadow-none dark:bg-accent/60 dark:hover:bg-accent/80"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="max-h-72 w-[var(--radix-select-trigger-width)] border-0"
            >
              {unicodeManifest.facets[facetType].map((facet) => (
                <SelectItem
                  key={facet.id}
                  value={facet.id}
                  className="text-[11px]"
                >
                  {facet.label} ({facet.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CharacterGrid
            entries={unicodeResults}
            copiedChar={copiedChar}
            onSelect={onSelect}
            paged={false}
          />
          {unicodeHasMore && unicodeFacetId && (
            <button
              type="button"
              onClick={() =>
                void loadUnicodePage(
                  unicodeFacetType,
                  unicodeFacetId,
                  unicodeOffset + PAGE_SIZE
                )
              }
              className="h-7 rounded-md bg-accent px-2 text-[11px] font-medium"
            >
              {t("character.loadMore", { count: PAGE_SIZE })}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function CharLibrary({ view }: { view: CharacterViewId }) {
  const brushColor = useCanvasState((state) => state.brushColor);
  const [copiedChar, setCopiedChar] = useState<string | null>(null);

  const handleSelect = async (entry: CharacterRecord) => {
    if (!entry.insertable) return;
    const copied = await writeClipboardPayload(
      {
        plain: entry.grapheme,
        rich: JSON.stringify({
          type: "ascii-metropolis-zone",
          version: 1,
          cells: [{ x: 0, y: 0, char: entry.grapheme, color: brushColor }],
        }),
      },
      { withRich: true }
    );
    if (!copied) {
      feedback.error("Could not copy character.", {
        duration: 1200,
        position: "top-right",
      });
      return;
    }
    setCopiedChar(entry.grapheme);
    feedback.success(`Copied: ${entry.grapheme}`, {
      duration: 600,
      position: "top-right",
    });
  };

  return view === "unicode" ? (
    <UnicodePane copiedChar={copiedChar} onSelect={handleSelect} />
  ) : (
    <PackPane pack={view} copiedChar={copiedChar} onSelect={handleSelect} />
  );
}
