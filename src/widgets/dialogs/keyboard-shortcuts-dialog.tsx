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
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { formatShortcutLabel } from '@/domains/actions/public';
import {
  shortcutFromKeyboardEvent,
  useEditor,
  useEditorKeymapSnapshot,
  type KeymapBindingSnapshot,
} from '@/domains/editor/public';
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
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { Pressable } from '@/shared/ui/pressable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/shared/ui/tooltip';
import { EDITOR_SHORTCUT_LABEL_KEYS } from './editor-shortcut-catalog';
import { ShortcutKbd } from './shortcut-kbd';

type RecordingTarget = {
  entryId: string;
  index: number | null;
  firstStroke?: string;
};

type PendingConflict = {
  targetEntryId: string;
  shortcuts: readonly string[];
  shortcut: string;
  conflictingEntryIds: readonly string[];
};

type KeyboardShortcutsPanelProps = {
  onDirtyChange?: (dirty: boolean) => void;
  onRecordingChange?: (recording: boolean) => void;
};

export type KeyboardShortcutsPanelHandle = {
  save: () => void;
};

type ShortcutBindings = Record<string, readonly string[]>;

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

const arraysEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const getOverrideValue = (entry: KeymapBindingSnapshot, shortcuts: readonly string[]) =>
  arraysEqual(entry.defaultShortcuts, shortcuts) ? null : shortcuts;

const createShortcutBindings = (entries: readonly KeymapBindingSnapshot[]): ShortcutBindings =>
  Object.fromEntries(
    entries.filter((entry) => entry.configurable).map((entry) => [entry.id, [...entry.shortcuts]])
  );

const bindingsEqual = (left: ShortcutBindings, right: ShortcutBindings) => {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...ids].every((id) => arraysEqual(left[id] ?? [], right[id] ?? []));
};

export const KeyboardShortcutsPanel = forwardRef<
  KeyboardShortcutsPanelHandle,
  KeyboardShortcutsPanelProps
>(function KeyboardShortcutsPanel({ onDirtyChange, onRecordingChange }, ref) {
  const { t } = useUiI18n();
  const editor = useEditor();
  const snapshot = useEditorKeymapSnapshot();
  const [draft, setDraft] = useState<ShortcutDraft>(() => {
    const bindings = createShortcutBindings(snapshot.entries);
    return { baseline: bindings, bindings };
  });
  const [recording, setRecording] = useState<RecordingTarget | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);

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
    },
    [onDirtyChange, onRecordingChange]
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
  const commitBindings = useCallback(
    (entry: KeymapBindingSnapshot, shortcuts: readonly ShortcutSequence[]) => {
      setDraft((current) => ({
        ...current,
        bindings: { ...current.bindings, [entry.id]: shortcuts },
      }));
    },
    []
  );

  const saveDraft = useCallback(() => {
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
  }, [draft, editor, snapshot.entries]);

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

    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      stopRecording();
    };
    const cancelOutsideControl = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const activeControl = document.querySelector(
        '[data-shortcut-recording-control][data-recording="true"]'
      );
      if (!activeControl?.contains(target)) stopRecording();
    };

    document.addEventListener('keydown', cancelOnEscape, true);
    document.addEventListener('pointerdown', cancelOutsideControl, true);
    window.addEventListener('blur', stopRecording);
    return () => {
      document.removeEventListener('keydown', cancelOnEscape, true);
      document.removeEventListener('pointerdown', cancelOutsideControl, true);
      window.removeEventListener('blur', stopRecording);
    };
  }, [recording, stopRecording]);

  const finishRecording = (
    entry: KeymapBindingSnapshot,
    index: number | null,
    shortcut: string
  ) => {
    const next = [...entry.shortcuts];
    if (index === null) next.push(shortcut);
    else next[index] = shortcut;
    const shortcuts = [...new Set(next)];
    const conflictingEntryIds = editableEntries
      .filter(
        (candidate) =>
          candidate.id !== entry.id &&
          candidate.scope === entry.scope &&
          candidate.shortcuts.includes(shortcut)
      )
      .map((candidate) => candidate.id);

    stopRecording();
    if (conflictingEntryIds.length > 0) {
      setPendingConflict({
        targetEntryId: entry.id,
        shortcuts,
        shortcut,
        conflictingEntryIds,
      });
      return;
    }
    commitBindings(entry, shortcuts);
  };

  const captureShortcut = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    entry: KeymapBindingSnapshot,
    index: number | null
  ) => {
    if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      stopRecording();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      stopRecording();
      return;
    }
    if (recording?.firstStroke && event.key === 'Enter') {
      finishRecording(entry, index, recording.firstStroke);
      return;
    }

    const stroke = shortcutFromKeyboardEvent(event.nativeEvent);
    if (!stroke) return;
    if (recording?.firstStroke) {
      finishRecording(entry, index, `${recording.firstStroke} ${stroke}`);
      return;
    }

    setRecording({ entryId: entry.id, index, firstStroke: stroke });
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    recordingTimer.current = setTimeout(() => {
      finishRecording(entry, index, stroke);
    }, 1_500);
  };

  const confirmConflictReplacement = () => {
    if (!pendingConflict) return;
    const target = entriesById.get(pendingConflict.targetEntryId);
    if (!target) return;

    const updates: Record<string, readonly string[]> = {
      [target.id]: pendingConflict.shortcuts,
    };
    for (const entryId of pendingConflict.conflictingEntryIds) {
      const entry = entriesById.get(entryId);
      if (!entry) continue;
      const shortcuts = entry.shortcuts.filter((shortcut) => shortcut !== pendingConflict.shortcut);
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

  const conflictCommands = pendingConflict?.conflictingEntryIds.map(getCommandLabel).join(', ');

  const getScopeLabel = (scope?: string) => {
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
  };

  const shortcutRows = useMemo<ShortcutCategoryRow[]>(() => {
    const grouped = new Map<ShortcutCategory, ShortcutCommandRow[]>(
      SHORTCUT_CATEGORY_ORDER.map((category) => [category, []])
    );
    for (const entry of editableEntries) {
      const candidateCategory = entry.category ?? '';
      const category = isShortcutCategory(candidateCategory) ? candidateCategory : 'General';
      const labelKey = EDITOR_SHORTCUT_LABEL_KEYS[entry.id];
      grouped.get(category)?.push({
        id: entry.id,
        kind: 'command',
        label: labelKey ? t(labelKey) : (entry.label ?? entry.id),
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
  }, [editableEntries, t]);

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

  const renderRecordingState = (firstStroke?: string) =>
    firstStroke ? (
      <span className="flex items-center gap-1">
        <ShortcutKbd shortcut={firstStroke} />
        <span aria-hidden="true">…</span>
      </span>
    ) : (
      <KbdGroup aria-label={t('shortcutEditor.recording')}>
        <Kbd>{t('shortcutEditor.recording')}</Kbd>
      </KbdGroup>
    );

  const renderEmptyShortcutControl = (entry: KeymapBindingSnapshot, commandLabel: string) => {
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
              pressed={isRecording}
              aria-label={t('shortcutEditor.setFor', { command: commandLabel })}
              onClick={() => {
                if (isRecording) stopRecording();
                else beginRecording(entry.id, null);
              }}
              onBlur={() => {
                if (isRecording) stopRecording();
              }}
              onKeyDown={(event) => {
                if (isRecording) captureShortcut(event, entry, null);
              }}
            />
          }
        >
          {isRecording ? (
            renderRecordingState(recording.firstStroke)
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
      {entry.shortcuts.length === 0 ? renderEmptyShortcutControl(entry, commandLabel) : null}
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
              onKeyDown={(event) => {
                if (isRecording) captureShortcut(event, entry, index);
              }}
            >
              {isRecording ? (
                renderRecordingState(recording.firstStroke)
              ) : (
                <ShortcutKbd shortcut={shortcut} />
              )}
            </Pressable>
          </span>
        );
      })}
    </div>
  );

  return (
    <>
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
                    {t('shortcutEditor.conflict.description', {
                      commands: conflictCommands ?? '',
                    })}
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
