'use client';

import {
  createExpandedRowModel,
  rowExpandingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { ChevronRight, Plus, RotateCcw } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { formatShortcutLabel } from '@/domains/actions/public';
import {
  shortcutFromKeyboardEvent,
  findShortcutConflicts,
  shortcutSequenceKey,
  shortcutsEqual,
  useEditor,
  useEditorKeymapSnapshot,
  type KeymapBindingSnapshot,
  type ShortcutConflict,
  type ShortcutSequence,
} from '@/domains/editor/public';
import { SHORTCUT_PRIORITY, useShortcutLayer } from '@/shared/shortcuts/dispatcher';
import { useUiI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { Pressable } from '@/shared/ui/pressable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/shared/ui/tooltip';
import { EDITOR_SHORTCUT_LABEL_KEYS } from './editor-shortcut-catalog';
import { ShortcutKbd } from './shortcut-kbd';

type RecordingTarget = {
  entryId: string;
  index: number | null;
  sequence: ShortcutSequence;
};

type PendingConflict = {
  targetEntryId: string;
  shortcuts: readonly ShortcutSequence[];
  shortcut: ShortcutSequence;
  conflicts: readonly ShortcutConflict[];
};

type KeyboardShortcutsPanelProps = {
  onDirtyChange?: (dirty: boolean) => void;
  onRecordingChange?: (recording: boolean) => void;
  onValidityChange?: (valid: boolean) => void;
};

export type KeyboardShortcutsPanelHandle = {
  save: () => void;
};

type ShortcutBindings = Record<string, readonly ShortcutSequence[]>;

type ShortcutDraft = {
  baseline: ShortcutBindings;
  bindings: ShortcutBindings;
};

const SHORTCUT_CATEGORY_ORDER = [
  'General',
  'Canvas',
  'Selection',
  'Formatting',
  'Tools',
  'Presentation',
  'Structured',
] as const;

type ShortcutCategory = (typeof SHORTCUT_CATEGORY_ORDER)[number];

type ShortcutCommandRow = {
  id: string;
  kind: 'command';
  label: string;
  entry: KeymapBindingSnapshot;
};

type ShortcutCategoryRow = {
  id: string;
  kind: 'category';
  category: ShortcutCategory;
  label: string;
  children: ShortcutCommandRow[];
};

type ShortcutGridRow = ShortcutCategoryRow | ShortcutCommandRow;

const shortcutGridFeatures = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});

const isShortcutCategory = (category: string): category is ShortcutCategory =>
  SHORTCUT_CATEGORY_ORDER.some((candidate) => candidate === category);

const arraysEqual = (left: readonly ShortcutSequence[], right: readonly ShortcutSequence[]) =>
  left.length === right.length && left.every((value, index) => shortcutsEqual(value, right[index]));

const getOverrideValue = (entry: KeymapBindingSnapshot, shortcuts: readonly ShortcutSequence[]) =>
  arraysEqual(entry.defaultShortcuts, shortcuts) ? null : shortcuts;

const createShortcutBindings = (entries: readonly KeymapBindingSnapshot[]): ShortcutBindings =>
  Object.fromEntries(
    entries.filter((entry) => entry.configurable).map((entry) => [
      entry.id,
      entry.shortcuts.map((sequence) => [...sequence]),
    ])
  );

const bindingsEqual = (left: ShortcutBindings, right: ShortcutBindings) => {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...ids].every((id) => arraysEqual(left[id] ?? [], right[id] ?? []));
};

export const KeyboardShortcutsPanel = forwardRef<
  KeyboardShortcutsPanelHandle,
  KeyboardShortcutsPanelProps
>(function KeyboardShortcutsPanel(
  { onDirtyChange, onRecordingChange, onValidityChange },
  ref
) {
  const { t } = useUiI18n();
  const editor = useEditor();
  const snapshot = useEditorKeymapSnapshot();
  const [draft, setDraft] = useState<ShortcutDraft>(() => {
    const bindings = createShortcutBindings(snapshot.entries);
    return { baseline: bindings, bindings };
  });
  const [recording, setRecording] = useState<RecordingTarget | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const dirty = useMemo(
    () => !bindingsEqual(draft.baseline, draft.bindings),
    [draft.baseline, draft.bindings]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
      onRecordingChange?.(false);
      onValidityChange?.(true);
    },
    [onDirtyChange, onRecordingChange, onValidityChange]
  );

  const entriesById = useMemo(
    () =>
      new Map(
        snapshot.entries.map((entry) => {
          const shortcuts = draft.bindings[entry.id] ?? entry.shortcuts;
          return [
            entry.id,
            {
              ...entry,
              shortcuts,
              userDefined: !arraysEqual(entry.defaultShortcuts, shortcuts),
            },
          ];
        })
      ),
    [draft.bindings, snapshot.entries]
  );
  const editableEntries = useMemo(
    () => [...entriesById.values()].filter((entry) => entry.configurable),
    [entriesById]
  );
  const draftConflicts = useMemo(() => {
    const entries = [...entriesById.values()];
    const byKey = new Map<string, ShortcutConflict>();
    for (const entry of entries) {
      for (const shortcut of entry.shortcuts) {
        for (const conflict of findShortcutConflicts(entries, entry.id, shortcut)) {
          const pair = [
            `${conflict.entryId}:${shortcutSequenceKey(conflict.shortcut)}`,
            `${conflict.conflictingEntryId}:${shortcutSequenceKey(conflict.conflictingShortcut)}`,
          ].sort();
          byKey.set(`${conflict.kind}:${pair.join('|')}`, conflict);
        }
      }
    }
    return [...byKey.values()];
  }, [entriesById]);
  const valid = draftConflicts.length === 0;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [onValidityChange, valid]);
  const commitBindings = useCallback(
    (entry: KeymapBindingSnapshot, shortcuts: readonly ShortcutSequence[]) => {
      setDraft((current) => ({
        ...current,
        bindings: { ...current.bindings, [entry.id]: shortcuts },
      }));
    },
    []
  );

  const resetAllBindings = () => {
    setDraft((current) => ({
      ...current,
      bindings: Object.fromEntries(
        editableEntries.map((entry) => [
          entry.id,
          entry.defaultShortcuts.map((sequence) => [...sequence]),
        ])
      ),
    }));
  };

  const saveDraft = useCallback(() => {
    if (!valid) return;
    const updates: Record<string, readonly ShortcutSequence[] | null> = {};
    for (const entry of snapshot.entries) {
      if (!entry.configurable) continue;
      const baseline = draft.baseline[entry.id] ?? entry.shortcuts;
      const shortcuts = draft.bindings[entry.id] ?? entry.shortcuts;
      if (arraysEqual(baseline, shortcuts)) continue;
      updates[entry.id] = getOverrideValue(entry, shortcuts);
    }
    if (Object.keys(updates).length > 0) editor.keymap.updateUserBindings(updates);
    const bindings = Object.fromEntries(
      Object.entries(draft.bindings).map(([id, shortcuts]) => [
        id,
        shortcuts.map((sequence) => [...sequence]),
      ])
    );
    setDraft({ baseline: bindings, bindings });
  }, [draft, editor, snapshot.entries, valid]);

  useImperativeHandle(ref, () => ({ save: saveDraft }), [saveDraft]);

  const stopRecording = useCallback(() => {
    setRecording(null);
    onRecordingChange?.(false);
  }, [onRecordingChange]);

  const beginRecording = (entryId: string, index: number | null) => {
    setRecording({ entryId, index, sequence: [] });
    onRecordingChange?.(true);
  };

  useEffect(() => {
    if (!recording) return;

    const cancelOutsideControl = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const activeControl = document.querySelector(
        '[data-shortcut-recording-control][data-recording="true"]'
      );
      if (!activeControl?.contains(target)) stopRecording();
    };

    document.addEventListener('pointerdown', cancelOutsideControl, true);
    window.addEventListener('blur', stopRecording);
    return () => {
      document.removeEventListener('pointerdown', cancelOutsideControl, true);
      window.removeEventListener('blur', stopRecording);
    };
  }, [recording, stopRecording]);

  const finishRecording = (
    entry: KeymapBindingSnapshot,
    index: number | null,
    shortcut: ShortcutSequence
  ) => {
    const next = [...entry.shortcuts];
    if (index === null) next.push(shortcut);
    else next[index] = shortcut;
    const shortcuts = [...new Map(
      next.map((sequence) => [shortcutSequenceKey(sequence), sequence])
    ).values()];
    const conflictEntries = [...entriesById.values()].map((candidate) =>
      candidate.id === entry.id ? { ...candidate, shortcuts } : candidate
    );
    const conflicts = findShortcutConflicts(conflictEntries, entry.id, shortcut);

    stopRecording();
    if (conflicts.length > 0) {
      setPendingConflict({
        targetEntryId: entry.id,
        shortcuts,
        shortcut,
        conflicts,
      });
      return;
    }
    commitBindings(entry, shortcuts);
  };

  useShortcutLayer({
    id: 'shortcut-recorder',
    priority: SHORTCUT_PRIORITY.observer + 1,
    enabled: recording !== null,
    onKeyDown: (event) => {
      if (!recording) return undefined;
      if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        stopRecording();
        return undefined;
      }
      if (event.key === 'Escape') {
        stopRecording();
        return { claimed: true, preventDefault: true, stopImmediatePropagation: true };
      }
      if (event.key === 'Enter') {
        const entry = entriesById.get(recording.entryId);
        if (entry && recording.sequence.length > 0) {
          finishRecording(entry, recording.index, recording.sequence);
        }
        return { claimed: true, preventDefault: true, stopImmediatePropagation: true };
      }
      const stroke = shortcutFromKeyboardEvent(event);
      if (stroke && recording.sequence.length < 2) {
        setRecording((current) =>
          current ? { ...current, sequence: [...current.sequence, stroke] } : null
        );
      }
      return { claimed: true, preventDefault: true, stopImmediatePropagation: true };
    },
  });

  const confirmConflictReplacement = () => {
    if (!pendingConflict) return;
    const target = entriesById.get(pendingConflict.targetEntryId);
    if (!target) return;

    const updates: Record<string, readonly ShortcutSequence[]> = {};
    const conflictsByEntry = new Map<string, ShortcutSequence[]>();
    for (const conflict of pendingConflict.conflicts) {
      const sequences = conflictsByEntry.get(conflict.conflictingEntryId) ?? [];
      sequences.push(conflict.conflictingShortcut);
      conflictsByEntry.set(conflict.conflictingEntryId, sequences);
    }
    updates[target.id] = pendingConflict.shortcuts.filter((shortcut) =>
      !(conflictsByEntry.get(target.id) ?? []).some((conflict) =>
        shortcutsEqual(shortcut, conflict)
      )
    );
    for (const [entryId, conflictingShortcuts] of conflictsByEntry) {
      if (entryId === target.id) continue;
      const entry = entriesById.get(entryId);
      if (!entry) continue;
      const shortcuts = entry.shortcuts.filter(
        (shortcut) => !conflictingShortcuts.some((conflict) => shortcutsEqual(shortcut, conflict))
      );
      updates[entry.id] = shortcuts;
    }
    setDraft((current) => ({
      ...current,
      bindings: { ...current.bindings, ...updates },
    }));
    setPendingConflict(null);
  };

  const getCommandLabel = (entryId: string) => {
    const entry = entriesById.get(entryId);
    const labelKey = EDITOR_SHORTCUT_LABEL_KEYS[entryId];
    return labelKey ? t(labelKey) : (entry?.label ?? entryId);
  };

  const conflictCommands = pendingConflict
    ? [...new Set(pendingConflict.conflicts.map((conflict) => conflict.conflictingEntryId))]
        .map(getCommandLabel)
        .join(', ')
    : '';

  const getScopeLabel = useCallback((scope?: string) => {
    switch (scope) {
      case 'application':
        return t('shortcutEditor.scope.application');
      case 'canvas':
        return t('shortcutEditor.scope.canvas');
      case 'grid':
        return t('shortcutEditor.scope.grid');
      case 'presentation':
        return t('shortcutEditor.scope.presentation');
      case 'structured':
        return t('shortcutEditor.scope.structured');
      default:
        return '—';
    }
  }, [t]);

  const shortcutRows = useMemo<ShortcutCategoryRow[]>(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const grouped = new Map<ShortcutCategory, ShortcutCommandRow[]>(
      SHORTCUT_CATEGORY_ORDER.map((category) => [category, []])
    );
    for (const entry of editableEntries) {
      const candidateCategory = entry.category ?? '';
      const category = isShortcutCategory(candidateCategory) ? candidateCategory : 'General';
      const labelKey = EDITOR_SHORTCUT_LABEL_KEYS[entry.id];
      const label = labelKey ? t(labelKey) : (entry.label ?? entry.id);
      const searchText = [
        label,
        category,
        getScopeLabel(entry.scope),
        ...entry.shortcuts.map((shortcut) => formatShortcutLabel(shortcut)),
      ].join(' ').toLocaleLowerCase();
      if (query && !searchText.includes(query)) continue;
      grouped.get(category)?.push({
        id: entry.id,
        kind: 'command',
        label,
        entry,
      });
    }

    const categoryLabels: Record<ShortcutCategory, string> = {
      General: t('shortcutEditor.category.general'),
      Canvas: t('shortcutEditor.category.canvas'),
      Selection: t('shortcutEditor.category.selection'),
      Formatting: t('shortcutEditor.category.formatting'),
      Tools: t('shortcutEditor.category.tools'),
      Presentation: t('shortcutEditor.category.presentation'),
      Structured: t('shortcutEditor.category.structured'),
    };
    return SHORTCUT_CATEGORY_ORDER.flatMap((category) => {
      const children = grouped.get(category) ?? [];
      return children.length > 0
        ? [
            {
              id: `category:${category.toLowerCase()}`,
              kind: 'category' as const,
              category,
              label: categoryLabels[category],
              children,
            },
          ]
        : [];
    });
  }, [editableEntries, getScopeLabel, searchQuery, t]);

  const shortcutGridColumns = useMemo<ColumnDef<typeof shortcutGridFeatures, ShortcutGridRow>[]>(
    () => [
      { id: 'command', header: t('shortcutEditor.column.command') },
      { id: 'scope', header: t('shortcutEditor.column.scope') },
      { id: 'shortcut', header: t('shortcutEditor.column.shortcut') },
      { id: 'actions', header: t('shortcutEditor.column.actions') },
    ],
    [t]
  );

  const shortcutTable = useTable({
    features: shortcutGridFeatures,
    columns: shortcutGridColumns,
    data: shortcutRows,
    getRowId: (row) => row.id,
    getSubRows: (row) => (row.kind === 'category' ? row.children : undefined),
    initialState: { expanded: true },
    // Labels and bindings can rebuild the row data without changing the category tree.
    // Preserve the user's disclosure state across those reactive updates.
    autoResetExpanded: false,
  });

  const renderRecordingState = (sequence: ShortcutSequence) =>
    sequence.length > 0 ? (
      <span className="flex items-center gap-1">
        <ShortcutKbd shortcut={sequence} />
        <span aria-hidden="true">…</span>
      </span>
    ) : (
      <KbdGroup aria-label={t('shortcutEditor.recording')}>
        <Kbd>{t('shortcutEditor.recording')}</Kbd>
      </KbdGroup>
    );

  const renderAddShortcutControl = (entry: KeymapBindingSnapshot, commandLabel: string) => {
    const isRecording = recording?.entryId === entry.id && recording.index === null;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              data-shortcut-recording-control=""
              data-recording={isRecording}
              tone="neutral"
              size="xs"
              shape={isRecording ? 'auto' : 'square'}
              className="ml-auto shrink-0"
              pressed={isRecording}
              aria-label={t('shortcutEditor.setFor', { command: commandLabel })}
              onClick={() => {
                if (isRecording) stopRecording();
                else beginRecording(entry.id, null);
              }}
              onBlur={() => {
                if (isRecording) stopRecording();
              }}
            />
          }
        >
          {isRecording ? (
            renderRecordingState(recording.sequence)
          ) : (
            <Plus data-icon="inline-start" />
          )}
        </TooltipTrigger>
        <TooltipPopup side="top">
          {isRecording ? t('shortcutEditor.recording') : t('shortcutEditor.set')}
        </TooltipPopup>
      </Tooltip>
    );
  };

  const renderShortcutCell = (entry: KeymapBindingSnapshot, commandLabel: string) => (
    <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden whitespace-nowrap">
      {entry.shortcuts.map((shortcut, index) => {
        const isRecording = recording?.entryId === entry.id && recording.index === index;
        const shortcutLabel = formatShortcutLabel(shortcut);
        return (
          <span key={`${shortcut}-${index}`} className="contents">
            {index > 0 ? (
              <span aria-hidden="true" className="text-muted-foreground">
                /
              </span>
            ) : null}
            <Pressable
              type="button"
              data-slot="shortcut-binding"
              data-shortcut-recording-control=""
              data-recording={isRecording}
              className="shrink-0"
              aria-label={t('shortcutEditor.edit', {
                command: commandLabel,
                shortcut: shortcutLabel,
              })}
              aria-pressed={isRecording}
              onClick={() => {
                if (isRecording) stopRecording();
                else beginRecording(entry.id, index);
              }}
              onBlur={() => {
                if (isRecording) stopRecording();
              }}
            >
              {isRecording ? (
                renderRecordingState(recording.sequence)
              ) : (
                <ShortcutKbd shortcut={shortcut} />
              )}
            </Pressable>
          </span>
        );
      })}
      {renderAddShortcutControl(entry, commandLabel)}
    </div>
  );

  return (
    <>
      <div className="flex min-w-0 items-center gap-2 pb-2">
        <Input
          type="search"
          density="compact"
          appearance="search"
          value={searchQuery}
          className="min-w-0 flex-1"
          aria-label={t('shortcutEditor.search')}
          placeholder={t('shortcutEditor.searchPlaceholder')}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {editableEntries.some((entry) => entry.userDefined) ? (
          <Button type="button" tone="subtle" size="xs" onClick={resetAllBindings}>
            <RotateCcw data-icon="inline-start" />
            {t('shortcutEditor.resetAll')}
          </Button>
        ) : null}
      </div>
      {!valid ? (
        <p role="alert" className="pb-2 text-xs leading-4 text-destructive">
          {t('shortcutEditor.conflict.remaining', { count: draftConflicts.length })}
        </p>
      ) : null}
      <div data-slot="shortcut-grid">
        <Table density="compact" rowHover="none" className="min-w-[560px] table-fixed">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[16%]" />
            <col />
            <col className="w-10" />
          </colgroup>
          <TableHeader>
            {shortcutTable.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    scope="col"
                    className={cn(header.column.id === 'actions' && 'w-10 px-1 text-right')}
                  >
                    {header.isPlaceholder ? null : header.column.id === 'actions' ? (
                      <span className="sr-only">
                        <shortcutTable.FlexRender header={header} />
                      </span>
                    ) : (
                      <shortcutTable.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody data-slot="shortcut-list">
            {shortcutTable.getRowModel().rows.map((row) => {
              const item = row.original;
              if (item.kind === 'category') {
                const expandedLabel = row.getIsExpanded()
                  ? t('shortcutEditor.category.collapse', { category: item.label })
                  : t('shortcutEditor.category.expand', { category: item.label });
                return (
                  <TableRow key={row.id} data-slot="shortcut-category-row">
                    <TableCell className="p-0" colSpan={4}>
                      <Pressable
                        type="button"
                        className="flex h-8 w-full items-center gap-2 px-3 text-left"
                        aria-expanded={row.getIsExpanded()}
                        aria-label={expandedLabel}
                        onClick={row.getToggleExpandedHandler()}
                      >
                        <ChevronRight
                          className={cn(
                            'size-4 transition-transform',
                            row.getIsExpanded() && 'rotate-90'
                          )}
                        />
                        <span className="font-semibold">{item.label}</span>
                        <span className="ml-auto text-muted-foreground">
                          {t('shortcutEditor.category.commandCount', {
                            count: item.children.length,
                          })}
                        </span>
                      </Pressable>
                    </TableCell>
                  </TableRow>
                );
              }

              const { entry, label } = item;
              return (
                <TableRow key={row.id} data-slot="shortcut-row">
                  <TableCell className="truncate ps-10 text-muted-foreground">{label}</TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {getScopeLabel(entry.scope)}
                  </TableCell>
                  <TableCell>{renderShortcutCell(entry, label)}</TableCell>
                  <TableCell className="p-1 text-right">
                    {entry.userDefined ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <IconButton
                              type="button"
                              size="xs"
                              aria-label={t('shortcutEditor.reset', { command: label })}
                              onClick={() => commitBindings(entry, entry.defaultShortcuts)}
                            />
                          }
                        >
                          <RotateCcw />
                        </TooltipTrigger>
                        <TooltipPopup side="left">
                          {t('shortcutEditor.reset', { command: label })}
                        </TooltipPopup>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingConflict !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConflict(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('shortcutEditor.conflict.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConflict ? (
                <span className="flex flex-wrap items-center gap-1">
                  <ShortcutKbd shortcut={pendingConflict.shortcut} />
                  <span>
                    {t(
                      pendingConflict.conflicts.some((conflict) => conflict.kind === 'prefix')
                        ? 'shortcutEditor.conflict.prefixDescription'
                        : 'shortcutEditor.conflict.description',
                      {
                      commands: conflictCommands ?? '',
                      }
                    )}
                  </span>
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmConflictReplacement}>
              {t('shortcutEditor.conflict.replace')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
