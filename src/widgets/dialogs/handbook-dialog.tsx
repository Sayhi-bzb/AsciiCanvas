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
  TooltipPopup,
  TooltipTrigger,
  type TooltipPopupProps,
} from "@/shared/ui/tooltip";
import { useUiI18n, type I18nKey } from "@/shared/i18n";

const HELP_REFERENCE = [
  ["manual.reference.select", "manual.reference.selectDescription"],
  ["manual.reference.gridNavigation", "manual.reference.gridNavigationDescription"],
  ["manual.reference.insert", "manual.reference.insertDescription"],
  ["manual.reference.editText", "manual.reference.editTextDescription"],
  ["manual.reference.rangeStyle", "manual.reference.rangeStyleDescription"],
  ["manual.reference.shapeColor", "manual.reference.shapeColorDescription"],
  ["manual.reference.copy", "manual.reference.copyDescription"],
] as const satisfies readonly [I18nKey, I18nKey][];

type HandbookDialogProps = {
  tooltipSide?: TooltipPopupProps["side"];
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
          <DialogTrigger asChild>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("manual.open")}
                  tone="subtle"
                  shape="square"
                  size="md"
                />
              }
            >
              <CircleHelp />
            </TooltipTrigger>
          </DialogTrigger>
          <TooltipPopup side={tooltipSide}>{t("manual.title")}</TooltipPopup>
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
