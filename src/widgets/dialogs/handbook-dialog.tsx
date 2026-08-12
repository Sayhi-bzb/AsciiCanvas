"use client";

import {
  Box,
  CircleHelp,
  Clipboard,
  Info,
  Keyboard,
  Layers,
  Maximize,
  Move,
  Type,
} from "lucide-react";
import type { ReactElement } from "react";
import {
  getAppActionShortcutLabel,
  getEditorCommandShortcutLabel,
} from "@/domains/actions/public";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type TooltipContentProps,
} from "@/shared/ui/tooltip";
import { useUiI18n } from "@/shared/i18n";
import { useEditor } from "@/domains/editor/public";
import type { I18nKey } from "@/shared/i18n";

const ACTION_SHORTCUT_ROWS = [
  { actionId: "undo", labelKey: "manual.shortcut.undo" },
  { actionId: "redo", labelKey: "manual.shortcut.redo" },
  { actionId: "copy", labelKey: "manual.shortcut.copy" },
  { actionId: "cut", labelKey: "manual.shortcut.cut" },
  { actionId: "paste", labelKey: "manual.shortcut.paste" },
  { actionId: "delete-selection", labelKey: "manual.shortcut.delete" },
] as const satisfies readonly {
  actionId: Parameters<typeof getEditorCommandShortcutLabel>[1];
  labelKey: I18nKey;
}[];

const CANVAS_SHORTCUT_ROWS = [
  {
    labelKey: "manual.shortcut.dockTools",
    shortcutKey: "manual.shortcut.keys.dockTools",
  },
  {
    labelKey: "manual.shortcut.temporaryPan",
    shortcutKey: "manual.shortcut.keys.temporaryPan",
  },
  {
    labelKey: "manual.shortcut.zoom",
    shortcutKey: "manual.shortcut.keys.zoom",
  },
  {
    labelKey: "manual.shortcut.keyboardPan",
    shortcutKey: "manual.shortcut.keys.keyboardPan",
  },
  {
    labelKey: "manual.shortcut.move",
    shortcutKey: "manual.shortcut.keys.move",
  },
  {
    labelKey: "manual.shortcut.extend",
    shortcutKey: "manual.shortcut.keys.extend",
  },
  {
    labelKey: "manual.shortcut.anchorSelect",
    shortcutKey: "manual.shortcut.keys.anchorSelect",
  },
  {
    labelKey: "manual.shortcut.newline",
    shortcutKey: "manual.shortcut.keys.newline",
  },
  {
    labelKey: "manual.shortcut.indent",
    shortcutKey: "manual.shortcut.keys.indent",
  },
  {
    labelKey: "manual.shortcut.cancel",
    shortcutKey: "manual.shortcut.keys.cancel",
  },
  {
    labelKey: "manual.shortcut.fillSelection",
    shortcutKey: "manual.shortcut.keys.fillSelection",
  },
] as const satisfies readonly {
  labelKey: I18nKey;
  shortcutKey: I18nKey;
}[];

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="bg-accent/40 p-2 rounded-md flex justify-between items-start gap-3">
      <span className="font-medium leading-5">{label}</span>
      <kbd className="bg-background px-1.5 py-0.5 rounded border text-[9px] font-mono text-right leading-4 shrink-0 max-w-[58%]">
        {shortcut}
      </kbd>
    </div>
  );
}

type HandbookDialogProps = {
  tooltipSide?: TooltipContentProps["side"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement | null;
  onStartTour?: () => void;
};

export function HandbookDialog({
  tooltipSide = "left",
  open,
  onOpenChange,
  trigger,
  onStartTour,
}: HandbookDialogProps = {}) {
  const { t } = useUiI18n();
  const editor = useEditor();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger === null ? null : trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              aria-label={t("manual.open")}
              tone="subtle"
              shape="square"
              size="md"
              className="size-8 text-muted-foreground hover:text-primary"
            >
              <CircleHelp className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>{t("manual.title")}</TooltipContent>
        </Tooltip>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5 text-primary" />
            <span>{t("manual.title")}</span>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] overflow-y-auto">
          <DialogBody className="space-y-6">
            {onStartTour ? (
              <Button
                type="button"
                tone="primary"
                className="w-full justify-center"
                onClick={onStartTour}
              >
                {t("onboarding.start")}
              </Button>
            ) : null}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Keyboard className="size-4" /> {t("manual.shortcuts")}
              </h4>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("manual.shortcut.commands")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {ACTION_SHORTCUT_ROWS.map(({ actionId, labelKey }) => {
                    const shortcut = getEditorCommandShortcutLabel(
                      editor.keymap,
                      actionId
                    );
                    return shortcut ? (
                      <ShortcutRow
                        key={actionId}
                        label={t(labelKey)}
                        shortcut={shortcut}
                      />
                    ) : null;
                  })}
                  <ShortcutRow
                    label={t("manual.shortcut.toggleSidebar")}
                    shortcut={getAppActionShortcutLabel("toggle-sidebar") ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("manual.shortcut.canvas")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {CANVAS_SHORTCUT_ROWS.map(({ labelKey, shortcutKey }) => (
                    <ShortcutRow
                      key={labelKey}
                      label={t(labelKey)}
                      shortcut={t(shortcutKey)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Maximize className="size-4" /> {t("manual.freeform")}
              </h4>
              <div className="bg-accent/40 p-3 rounded-lg text-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground">{t("manual.selectFill")}</p>
                    <p className="text-muted-foreground">
                      {t("manual.selectFillDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-start border-t border-accent pt-2">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground">{t("manual.textFlow")}</p>
                    <p className="text-muted-foreground">
                      {t("manual.textFlowDescription")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Layers className="size-4" /> {t("manual.structuredCanvas")}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-accent">
                  <div className="flex flex-col">
                    <span className="font-medium">{t("manual.insert")}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("manual.insertDescription")}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {t("manual.insertTypes")}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-accent">
                  <div className="flex flex-col">
                    <span className="font-medium">{t("manual.move")}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("manual.moveDescription")}
                    </span>
                  </div>
                  <Move className="size-3 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-accent">
                  <div className="flex flex-col">
                    <span className="font-medium">{t("manual.resize")}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("manual.resizeDescription")}
                    </span>
                  </div>
                  <Box className="size-3 text-muted-foreground" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Type className="size-4" /> {t("manual.structuredEditing")}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-accent">
                  <div className="flex flex-col">
                    <span className="font-medium">{t("manual.textEdit")}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("manual.textEditDescription")}
                    </span>
                  </div>
                  <kbd className="bg-muted px-2 py-0.5 rounded border text-[10px] font-mono">
                    {t("manual.doubleClick")}
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-accent">
                  <div className="flex flex-col">
                    <span className="font-medium">{t("manual.rangeStyle")}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("manual.rangeStyleDescription")}
                    </span>
                  </div>
                  <Type className="size-3 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-accent">
                  <div className="flex flex-col">
                    <span className="font-medium">{t("manual.shapeStyle")}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("manual.shapeStyleDescription")}
                    </span>
                  </div>
                  <Layers className="size-3 text-muted-foreground" />
                </div>
              </div>
            </section>

            <div className="flex gap-2 p-3 rounded-md bg-accent/50">
              <Clipboard className="size-4 text-primary shrink-0" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("manual.copyNote")}
              </p>
            </div>

            <div className="flex gap-2 p-3 rounded-md bg-accent/30">
              <Info className="size-4 text-primary shrink-0" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("manual.contextNote")}
              </p>
            </div>
          </DialogBody>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
