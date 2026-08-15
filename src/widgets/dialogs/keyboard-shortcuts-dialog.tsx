"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import {
  Fragment,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";
import { formatShortcutLabel } from "@/domains/actions/public";
import {
  shortcutFromKeyboardEvent,
  useEditor,
  useEditorKeymapSnapshot,
  type KeymapBindingSnapshot,
} from "@/domains/editor/public";
import { useUiI18n } from "@/shared/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { ContentScrollArea } from "@/shared/ui/content-scroll-area";
import { Separator } from "@/shared/ui/separator";
import {
  EDITABLE_EDITOR_SHORTCUTS,
  getEditorShortcutEntryId,
} from "./editor-shortcut-catalog";
import { ShortcutKbd } from "./shortcut-kbd";

type RecordingTarget = {
  entryId: string;
  index: number | null;
};

type PendingConflict = {
  targetEntryId: string;
  shortcuts: readonly string[];
  shortcut: string;
  conflictingEntryIds: readonly string[];
};

type KeyboardShortcutsDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement | null;
};

const arraysEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const getOverrideValue = (
  entry: KeymapBindingSnapshot,
  shortcuts: readonly string[]
) => (arraysEqual(entry.defaultShortcuts, shortcuts) ? null : shortcuts);

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  trigger,
}: KeyboardShortcutsDialogProps) {
  const { t } = useUiI18n();
  const editor = useEditor();
  const snapshot = useEditorKeymapSnapshot();
  const [recording, setRecording] = useState<RecordingTarget | null>(null);
  const [pendingConflict, setPendingConflict] =
    useState<PendingConflict | null>(null);

  const entriesById = useMemo(
    () => new Map(snapshot.entries.map((entry) => [entry.id, entry])),
    [snapshot]
  );
  const editableEntryIds = useMemo(
    () =>
      new Set(
        EDITABLE_EDITOR_SHORTCUTS.map(({ commandId }) =>
          getEditorShortcutEntryId(commandId)
        )
      ),
    []
  );
  const hasOverrides = [...editableEntryIds].some(
    (entryId) => entriesById.get(entryId)?.userDefined
  );

  const commitBindings = (
    entry: KeymapBindingSnapshot,
    shortcuts: readonly string[]
  ) => {
    editor.keymap.setUserBindings(entry.id, getOverrideValue(entry, shortcuts));
  };

  const beginRecording = (entryId: string, index: number | null) => {
    setRecording({ entryId, index });
  };

  const captureShortcut = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    entry: KeymapBindingSnapshot,
    index: number | null
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(null);
      return;
    }

    const shortcut = shortcutFromKeyboardEvent(event.nativeEvent);
    if (!shortcut) return;

    const next = [...entry.shortcuts];
    if (index === null) next.push(shortcut);
    else next[index] = shortcut;
    const shortcuts = [...new Set(next)];
    const conflictingEntryIds = snapshot.entries
      .filter(
        (candidate) =>
          candidate.id !== entry.id &&
          editableEntryIds.has(candidate.id) &&
          candidate.shortcuts.includes(shortcut)
      )
      .map((candidate) => candidate.id);

    setRecording(null);
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

  const confirmConflictReplacement = () => {
    if (!pendingConflict) return;
    const target = entriesById.get(pendingConflict.targetEntryId);
    if (!target) return;

    const updates: Record<string, readonly string[] | null> = {
      [target.id]: getOverrideValue(target, pendingConflict.shortcuts),
    };
    for (const entryId of pendingConflict.conflictingEntryIds) {
      const entry = entriesById.get(entryId);
      if (!entry) continue;
      const shortcuts = entry.shortcuts.filter(
        (shortcut) => shortcut !== pendingConflict.shortcut
      );
      updates[entry.id] = getOverrideValue(entry, shortcuts);
    }
    editor.keymap.updateUserBindings(updates);
    setPendingConflict(null);
  };

  const getCommandLabel = (entryId: string) => {
    const command = EDITABLE_EDITOR_SHORTCUTS.find(
      ({ commandId }) => getEditorShortcutEntryId(commandId) === entryId
    );
    return command ? t(command.labelKey) : entryId;
  };

  const conflictCommands = pendingConflict?.conflictingEntryIds
    .map(getCommandLabel)
    .join(", ");

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRecording(null);
          onOpenChange?.(nextOpen);
        }}
      >
        {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
        <DialogContent
          className="sm:max-w-[440px]"
          onEscapeKeyDown={(event) => {
            if (!recording) return;
            event.preventDefault();
            setRecording(null);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("shortcutEditor.title")}</DialogTitle>
          </DialogHeader>
          <ContentScrollArea className="max-h-[60vh]">
            <DialogBody>
              <div data-slot="shortcut-list" className="flex flex-col">
                {EDITABLE_EDITOR_SHORTCUTS.map(
                  ({ commandId, labelKey }, rowIndex) => {
                    const entryId = getEditorShortcutEntryId(commandId);
                    const entry = entriesById.get(entryId);
                    if (!entry) return null;
                    const commandLabel = t(labelKey);
                    return (
                      <Fragment key={commandId}>
                        <div
                          data-slot="shortcut-row"
                          className="group/row flex min-h-10 items-center justify-between gap-3 py-2.5"
                        >
                          <span className="text-sm text-muted-foreground">
                            {commandLabel}
                          </span>
                          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                            {entry.shortcuts.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {t("shortcutEditor.none")}
                              </span>
                            ) : null}
                            {entry.shortcuts.map((shortcut, index) => {
                              const isRecording =
                                recording?.entryId === entry.id &&
                                recording.index === index;
                              const shortcutLabel = formatShortcutLabel(shortcut);
                              return (
                                <div
                                  key={`${shortcut}-${index}`}
                                  className="group/binding flex items-center gap-0.5"
                                >
                                  <Button
                                    type="button"
                                    tone="subtle"
                                    size="sm"
                                    pressed={isRecording}
                                    aria-label={t("shortcutEditor.edit", {
                                      command: commandLabel,
                                      shortcut: shortcutLabel,
                                    })}
                                    onClick={() => beginRecording(entry.id, index)}
                                    onKeyDown={(event) => {
                                      if (isRecording) {
                                        captureShortcut(event, entry, index);
                                      }
                                    }}
                                  >
                                    {isRecording ? (
                                      t("shortcutEditor.recording")
                                    ) : (
                                      <ShortcutKbd shortcut={shortcut} />
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    tone="subtle"
                                    shape="square"
                                    size="sm"
                                    className="opacity-0 transition-opacity group-hover/binding:opacity-100 group-focus-within/binding:opacity-100 [@media(pointer:coarse)]:opacity-100"
                                    aria-label={t("shortcutEditor.remove", {
                                      command: commandLabel,
                                      shortcut: shortcutLabel,
                                    })}
                                    onClick={() =>
                                      commitBindings(
                                        entry,
                                        entry.shortcuts.filter(
                                          (_, current) => current !== index
                                        )
                                      )
                                    }
                                  >
                                    <X />
                                  </Button>
                                </div>
                              );
                            })}
                            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(pointer:coarse)]:opacity-100">
                              <Button
                                type="button"
                                tone={
                                  recording?.entryId === entry.id &&
                                  recording.index === null
                                    ? "primary"
                                    : "subtle"
                                }
                                shape={
                                  recording?.entryId === entry.id &&
                                  recording.index === null
                                    ? "auto"
                                    : "square"
                                }
                                size="sm"
                                aria-label={t("shortcutEditor.add", {
                                  command: commandLabel,
                                })}
                                onClick={() => beginRecording(entry.id, null)}
                                onKeyDown={(event) => {
                                  if (
                                    recording?.entryId === entry.id &&
                                    recording.index === null
                                  ) {
                                    captureShortcut(event, entry, null);
                                  }
                                }}
                              >
                                {recording?.entryId === entry.id &&
                                recording.index === null ? (
                                  t("shortcutEditor.recording")
                                ) : (
                                  <Plus />
                                )}
                              </Button>
                              {entry.userDefined ? (
                                <Button
                                  type="button"
                                  tone="subtle"
                                  shape="square"
                                  size="sm"
                                  aria-label={t("shortcutEditor.reset", {
                                    command: commandLabel,
                                  })}
                                  onClick={() =>
                                    editor.keymap.setUserBindings(entry.id, null)
                                  }
                                >
                                  <RotateCcw />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {rowIndex < EDITABLE_EDITOR_SHORTCUTS.length - 1 ? (
                          <Separator />
                        ) : null}
                      </Fragment>
                    );
                  }
                )}
              </div>
            </DialogBody>
          </ContentScrollArea>
          {hasOverrides ? (
            <DialogFooter>
              <Button
                type="button"
                tone="neutral"
                outlined
                onClick={() => editor.keymap.resetUserBindings()}
              >
                <RotateCcw data-icon="inline-start" />
                {t("shortcutEditor.resetAll")}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingConflict !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConflict(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("shortcutEditor.conflict.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConflict ? (
                <span className="flex flex-wrap items-center gap-1">
                  <ShortcutKbd shortcut={pendingConflict.shortcut} />
                  <span>
                    {t("shortcutEditor.conflict.description", {
                      commands: conflictCommands ?? "",
                    })}
                  </span>
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmConflictReplacement}>
              {t("shortcutEditor.conflict.replace")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
