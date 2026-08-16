'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Loader2, RefreshCcw, X } from 'lucide-react';
import { writeClipboardPayload } from '@/domains/actions/public';
import { useCanvasState } from '@/domains/canvas/public';
import {
  useLibraryStore,
  type CharacterGroup,
  type CharacterPackId,
  type CharacterRecord,
  type CharacterViewId,
  type UnicodeFacetType,
} from '@/domains/character-library/public';
import { cn } from '@/shared/lib/utils';
import { getRenderFontFamilyForGrapheme } from '@/shared/metrics';
import { useUiI18n, type I18nKey } from '@/shared/i18n';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { SelectableItem } from '@/shared/ui/selectable-item';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipTrigger,
  type TooltipHandle,
} from '@/shared/ui/tooltip';

const PAGE_SIZE = 240;
const COPY_SUCCESS_DURATION_MS = 600;
const COPY_ERROR_DURATION_MS = 1200;

type CopyFeedback = {
  entryKey: string;
  grapheme: string;
  status: 'success' | 'error';
};

const getCharacterEntryKey = (entry: CharacterRecord) => `${entry.id}-${entry.grapheme}`;

const UNICODE_FACET_LABEL_KEYS: Record<UnicodeFacetType, I18nKey> = {
  block: 'character.unicode.block',
  script: 'character.unicode.script',
  category: 'character.unicode.category',
};

const CHARACTER_GROUP_LABEL_KEYS: Record<CharacterPackId, Record<string, I18nKey>> = {
  essentials: {
    ascii: 'character.group.essentials.ascii',
    lines: 'character.group.essentials.lines',
    arrows: 'character.group.essentials.arrows',
    shapes: 'character.group.essentials.shapes',
    math: 'character.group.essentials.math',
    technical: 'character.group.essentials.technical',
    numbers: 'character.group.essentials.numbers',
    dingbats: 'character.group.essentials.dingbats',
    braille: 'character.group.essentials.braille',
    'common-symbols': 'character.group.essentials.common-symbols',
  },
  nerd: {
    'seti-ui-custom': 'character.group.nerd.seti-ui-custom',
    devicons: 'character.group.nerd.devicons',
    'font-awesome': 'character.group.nerd.font-awesome',
    'font-awesome-ext': 'character.group.nerd.font-awesome-ext',
    'material-design': 'character.group.nerd.material-design',
    'weather-icons': 'character.group.nerd.weather-icons',
    octicons: 'character.group.nerd.octicons',
    'powerline-symbols': 'character.group.nerd.powerline-symbols',
    'powerline-extra': 'character.group.nerd.powerline-extra',
    'iec-power': 'character.group.nerd.iec-power',
    'font-logos': 'character.group.nerd.font-logos',
    pomicons: 'character.group.nerd.pomicons',
    codicons: 'character.group.nerd.codicons',
    'progress-indicators': 'character.group.nerd.progress-indicators',
    'heavy-angle-brackets': 'character.group.nerd.heavy-angle-brackets',
  },
  emoji: {
    'smileys-emotion': 'character.group.emoji.smileys-emotion',
    'people-body': 'character.group.emoji.people-body',
    component: 'character.group.emoji.component',
    'animals-nature': 'character.group.emoji.animals-nature',
    'food-drink': 'character.group.emoji.food-drink',
    'travel-places': 'character.group.emoji.travel-places',
    activities: 'character.group.emoji.activities',
    objects: 'character.group.emoji.objects',
    symbols: 'character.group.emoji.symbols',
    flags: 'character.group.emoji.flags',
  },
};

const getCodePointLabel = (grapheme: string) =>
  Array.from(grapheme)
    .map((part) => {
      const codePoint = part.codePointAt(0);
      return codePoint === undefined
        ? ''
        : `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
    })
    .filter(Boolean)
    .join(' ');

function CharButton({
  entry,
  feedbackStatus,
  onClick,
  tooltipHandle,
}: {
  entry: CharacterRecord;
  feedbackStatus: CopyFeedback['status'] | null;
  onClick: (entry: CharacterRecord) => void;
  tooltipHandle: TooltipHandle<string>;
}) {
  const { t } = useUiI18n();
  const codePoints = getCodePointLabel(entry.grapheme);
  const unavailable = !entry.insertable;
  const tooltipLabel = `${entry.name} · ${codePoints}${
    unavailable ? ` · ${t('character.metadataOnly')}` : ''
  }`;
  const actionLabel = unavailable
    ? tooltipLabel
    : `${t('character.copy', { character: entry.grapheme })} · ${tooltipLabel}`;
  const preview = entry.category.startsWith('M')
    ? `◌${entry.grapheme}`
    : entry.category === 'Zs'
      ? '␠'
      : entry.grapheme;

  return (
    <TooltipTrigger
      handle={tooltipHandle}
      payload={`${entry.name} · ${codePoints}`}
      disabled={unavailable}
      render={
        <IconButton
          type="button"
          size="sm"
          active={feedbackStatus === 'success'}
          destructive={feedbackStatus === 'error'}
          aria-label={actionLabel}
          data-character-codepoints={codePoints}
          data-copy-feedback={feedbackStatus ?? undefined}
          disabled={unavailable}
          onClick={() => onClick(entry)}
          style={{ fontFamily: getRenderFontFamilyForGrapheme(entry.grapheme) }}
          className="size-7 min-h-0 shrink-0 justify-center p-0 font-mono text-sm leading-none"
        />
      }
    >
      <span className="relative flex size-full items-center justify-center">
        <span
          aria-hidden="true"
          className={cn(
            'transition-[opacity,transform] duration-[var(--motion-fast)] ease-out motion-reduce:transition-none',
            feedbackStatus ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
          )}
        >
          {preview}
        </span>
        <Check
          data-icon="inline-start"
          aria-hidden="true"
          className={cn(
            'absolute transition-[opacity,transform] duration-[var(--motion-fast)] ease-out motion-reduce:transition-none',
            feedbackStatus === 'success' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          )}
        />
        <X
          data-icon="inline-start"
          aria-hidden="true"
          className={cn(
            'absolute transition-[opacity,transform] duration-[var(--motion-fast)] ease-out motion-reduce:transition-none',
            feedbackStatus === 'error' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          )}
        />
      </span>
    </TooltipTrigger>
  );
}

function CharacterGrid({
  entries,
  copyFeedback,
  onSelect,
  paged = true,
}: {
  entries: CharacterRecord[];
  copyFeedback: CopyFeedback | null;
  onSelect: (entry: CharacterRecord) => void;
  paged?: boolean;
}) {
  const { t } = useUiI18n();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const tooltipHandle = useMemo(() => TooltipCreateHandle<string>(), []);
  const visibleEntries = paged ? entries.slice(0, visibleCount) : entries;
  return (
    <>
      <div className="flex flex-wrap gap-0.5 overflow-hidden py-1">
        {visibleEntries.map((entry) => (
          <CharButton
            key={getCharacterEntryKey(entry)}
            entry={entry}
            feedbackStatus={
              copyFeedback?.entryKey === getCharacterEntryKey(entry) ? copyFeedback.status : null
            }
            onClick={onSelect}
            tooltipHandle={tooltipHandle}
          />
        ))}
      </div>
      <Tooltip handle={tooltipHandle}>
        {({ payload }) => <TooltipPopup side="top">{payload}</TooltipPopup>}
      </Tooltip>
      {paged && visibleCount < entries.length && (
        <Button
          type="button"
          tone="neutral"
          size="sm"
          onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
          className="my-1"
        >
          {t('character.showMore', {
            count: Math.min(PAGE_SIZE, entries.length - visibleCount),
          })}
        </Button>
      )}
    </>
  );
}

function GroupSection({
  pack,
  group,
  defaultOpen,
  copyFeedback,
  onSelect,
}: {
  pack: CharacterPackId;
  group: CharacterGroup;
  defaultOpen: boolean;
  copyFeedback: CopyFeedback | null;
  onSelect: (entry: CharacterRecord) => void;
}) {
  const { t } = useUiI18n();
  const labelKey = CHARACTER_GROUP_LABEL_KEYS[pack][group.id];
  const label = labelKey ? t(labelKey) : group.label;

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/character-group">
      <CollapsibleTrigger asChild>
        <SelectableItem type="button" density="default" muted className="w-full justify-start">
          <span className="truncate">{label}</span>
          <span className="ml-auto text-[10px] tabular-nums">{group.entries.length}</span>
          <ChevronRight className="shrink-0 transition-transform group-data-[state=open]/character-group:rotate-90" />
        </SelectableItem>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1">
        <CharacterGrid entries={group.entries} copyFeedback={copyFeedback} onSelect={onSelect} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function EmptySearch() {
  const { t } = useUiI18n();
  return <p className="px-2 py-4 text-xs text-muted-foreground">{t('character.empty')}</p>;
}

function PackPane({
  pack,
  copyFeedback,
  onSelect,
}: {
  pack: CharacterPackId;
  copyFeedback: CopyFeedback | null;
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
          {t('character.results', { count: results.length })}
        </p>
        {results.length ? (
          <CharacterGrid
            entries={results}
            copyFeedback={copyFeedback}
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
    <div className="flex flex-col gap-1 p-2 pb-10">
      {status === 'loading' && (
        <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {t('character.loading')}
        </div>
      )}
      {error && (
        <div className="flex flex-col gap-2 px-2 py-3 text-[11px] text-muted-foreground">
          <p className="break-words">{error}</p>
          <Button
            type="button"
            tone="neutral"
            size="sm"
            onClick={() => void retryPack(pack)}
            className="self-start"
          >
            <RefreshCcw /> {t('character.retry')}
          </Button>
        </div>
      )}
      {groups?.map((group, index) => (
        <GroupSection
          key={group.id}
          pack={pack}
          group={group}
          defaultOpen={index === 0}
          copyFeedback={copyFeedback}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function UnicodePane({
  copyFeedback,
  onSelect,
}: {
  copyFeedback: CopyFeedback | null;
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
  const [facetType, setFacetType] = useState<UnicodeFacetType>('block');

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
    <div className="flex flex-col gap-2 p-2 pb-10">
      {unicodeStatus === 'loading' && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {t('character.loadingIndex')}
        </div>
      )}
      {unicodeError && <p className="break-words text-[11px] text-destructive">{unicodeError}</p>}
      {unicodeManifest && (
        <Tabs
          value={facetType}
          onValueChange={(value) => {
            void selectFacetType(value as UnicodeFacetType);
          }}
          className="gap-2"
        >
          <TabsList className="w-full">
            {(['block', 'script', 'category'] as const).map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                active={facetType === type}
                className="flex-1 px-1 text-[10px] capitalize"
              >
                {t(UNICODE_FACET_LABEL_KEYS[type])}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={facetType} className="flex flex-col gap-2">
            <Select
              value={selectedFacetId}
              onValueChange={(value) => void loadUnicodePage(facetType, value)}
            >
              <SelectTrigger
                aria-label={t('character.unicodeFacet')}
                size="sm"
                appearance="search"
                className="w-full text-[11px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="max-h-72 w-[var(--radix-select-trigger-width)] border-0"
              >
                {unicodeManifest.facets[facetType].map((facet) => (
                  <SelectItem key={facet.id} value={facet.id}>
                    {facet.label} ({facet.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CharacterGrid
              entries={unicodeResults}
              copyFeedback={copyFeedback}
              onSelect={onSelect}
              paged={false}
            />
            {unicodeHasMore && unicodeFacetId && (
              <Button
                type="button"
                tone="neutral"
                size="sm"
                onClick={() =>
                  void loadUnicodePage(unicodeFacetType, unicodeFacetId, unicodeOffset + PAGE_SIZE)
                }
              >
                {t('character.loadMore', { count: PAGE_SIZE })}
              </Button>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export function CharLibrary({ view }: { view: CharacterViewId }) {
  const { t } = useUiI18n();
  const brushColor = useCanvasState((state) => state.brushColor);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequestIdRef = useRef(0);

  useEffect(
    () => () => {
      copyRequestIdRef.current += 1;
      if (feedbackTimeoutRef.current !== null) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    },
    []
  );

  const handleSelect = async (entry: CharacterRecord) => {
    if (!entry.insertable) return;
    const requestId = ++copyRequestIdRef.current;
    if (feedbackTimeoutRef.current !== null) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    setCopyFeedback(null);

    const copied = await writeClipboardPayload(
      {
        plain: entry.grapheme,
        rich: JSON.stringify({
          type: 'ascii-metropolis-zone',
          version: 1,
          cells: [{ x: 0, y: 0, char: entry.grapheme, color: brushColor }],
        }),
      },
      { withRich: true }
    );
    if (requestId !== copyRequestIdRef.current) return;

    const status = copied ? 'success' : 'error';
    const nextFeedback: CopyFeedback = {
      entryKey: getCharacterEntryKey(entry),
      grapheme: entry.grapheme,
      status,
    };
    setCopyFeedback(nextFeedback);
    feedbackTimeoutRef.current = setTimeout(
      () => {
        setCopyFeedback((current) => (current === nextFeedback ? null : current));
        feedbackTimeoutRef.current = null;
      },
      copied ? COPY_SUCCESS_DURATION_MS : COPY_ERROR_DURATION_MS
    );
  };

  return (
    <>
      {view === 'unicode' ? (
        <UnicodePane copyFeedback={copyFeedback} onSelect={handleSelect} />
      ) : (
        <PackPane pack={view} copyFeedback={copyFeedback} onSelect={handleSelect} />
      )}
      <span role="status" className="sr-only">
        {copyFeedback
          ? t(copyFeedback.status === 'success' ? 'character.copied' : 'character.copyFailed', {
              character: copyFeedback.grapheme,
            })
          : ''}
      </span>
    </>
  );
}
