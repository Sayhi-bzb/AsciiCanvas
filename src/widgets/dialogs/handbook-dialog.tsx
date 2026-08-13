"use client";

import { CircleHelp } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type TooltipContentProps,
} from "@/shared/ui/tooltip";
import { useUiI18n, type I18nKey } from "@/shared/i18n";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";

const HELP_REFERENCE = [
  ["manual.reference.select", "manual.reference.selectDescription"],
  ["manual.reference.insert", "manual.reference.insertDescription"],
  ["manual.reference.editText", "manual.reference.editTextDescription"],
  ["manual.reference.rangeStyle", "manual.reference.rangeStyleDescription"],
  ["manual.reference.shapeColor", "manual.reference.shapeColorDescription"],
  ["manual.reference.copy", "manual.reference.copyDescription"],
] as const satisfies readonly [I18nKey, I18nKey][];

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
                <CircleHelp />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>{t("manual.title")}</TooltipContent>
        </Tooltip>
      )}
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("manual.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {onStartTour ? (
              <Button type="button" tone="neutral" outlined onClick={onStartTour}>
                {t("onboarding.start")}
              </Button>
            ) : null}
            <KeyboardShortcutsDialog
              trigger={
                <Button type="button" tone="neutral" outlined>
                  {t("shortcutEditor.title")}
                </Button>
              }
            />
            <Button asChild tone="neutral" outlined>
              <a href="/docs" target="_blank" rel="noreferrer">
                {t("manual.fullDocumentation")}
              </a>
            </Button>
          </div>
          <dl data-slot="help-reference" className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
            {HELP_REFERENCE.map(([labelKey, descriptionKey]) => (
              <div key={labelKey} className="contents">
                <dt className="font-medium text-foreground">{t(labelKey)}</dt>
                <dd className="text-muted-foreground">{t(descriptionKey)}</dd>
              </div>
            ))}
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
