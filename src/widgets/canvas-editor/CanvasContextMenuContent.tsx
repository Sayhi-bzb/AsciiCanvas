import type { RefObject } from "react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/shared/ui/context-menu";
import {
  ACTION_CATALOG,
  canRunAction,
  runAction,
} from "@/domains/actions/public";
import { getActionShortcutLabel } from "@/domains/actions/public";
import type { ContextMenuEntry } from "@/domains/actions/public";
import { useEditorStore } from "@/domains/canvas/public";
import { useUiI18n, type I18nKey } from "@/shared/i18n";

const LABEL_KEY_BY_ID: Record<string, I18nKey> = {
  copy: "context.copyText",
  "copy-rich": "context.copyColor",
  "copy-ansi": "context.copyAnsi",
  cut: "context.cutZone",
  paste: "context.paste",
  "fill-selection-char": "context.fillSelection",
  "snapshot-png": "context.snapshotPng",
  "delete-selection": "context.delete",
  "structured-rename": "context.rename",
  "structured-bring-forward": "context.bringForward",
  "structured-send-backward": "context.sendBackward",
  "structured-bring-to-front": "context.bringToFront",
  "structured-send-to-back": "context.sendToBack",
  "structured-duplicate": "context.duplicate",
  "structured-copy-hierarchy": "context.copyStructure",
  "structured-split-horizontal": "context.splitHorizontal",
  "structured-split-vertical": "context.splitVertical",
  "structured-delete-divider": "context.deleteDivider",
};

type CanvasContextMenuContentProps = {
  entries: readonly ContextMenuEntry[];
  managedTextareaRef: RefObject<HTMLTextAreaElement | null>;
};

export const CanvasContextMenuContent = ({
  entries,
  managedTextareaRef,
}: CanvasContextMenuContentProps) => {
  const { t } = useUiI18n();

  const renderEntry = (entry: ContextMenuEntry, index: number) => {
    if (entry.type === "separator") {
      return <ContextMenuSeparator key={`sep-${index}`} />;
    }

    if (entry.type === "submenu") {
      const Icon = entry.icon;
      const hasEnabledChild = entry.children.some(
        (child) =>
          child.type === "action" &&
          canRunAction(child.id, useEditorStore.getState())
      );
      return (
        <ContextMenuSub key={`sub-${entry.label}-${index}`}>
          <ContextMenuSubTrigger disabled={!hasEnabledChild}>
            {Icon && <Icon className="mr-2 size-4" />}
            <span>
              {entry.label === "Layer" ? t("context.layer") : entry.label}
            </span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {entry.children.map(renderEntry)}
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
    }

    const meta = ACTION_CATALOG[entry.id];
    const Icon = meta.icon;
    const labelKey = LABEL_KEY_BY_ID[entry.id];
    const shortcutLabel = getActionShortcutLabel(entry.id);
    return (
      <ContextMenuItem
        key={entry.id}
        onClick={() =>
          runAction(entry.id, {
            source: "context-menu",
            managedTextarea: managedTextareaRef.current,
          })
        }
        variant={meta.destructive ? "destructive" : "default"}
        disabled={!canRunAction(entry.id, useEditorStore.getState())}
      >
        {Icon && <Icon className="mr-2 size-4" />}
        <span>{labelKey ? t(labelKey) : meta.label}</span>
        {shortcutLabel && (
          <ContextMenuShortcut>{shortcutLabel}</ContextMenuShortcut>
        )}
      </ContextMenuItem>
    );
  };

  return (
    <ContextMenuContent className="w-56">
      {entries.map(renderEntry)}
    </ContextMenuContent>
  );
};
