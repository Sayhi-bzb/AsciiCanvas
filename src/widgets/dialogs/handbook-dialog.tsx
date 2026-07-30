"use client";

import {
  Box,
  CircleHelp,
  Clipboard,
  Info,
  Keyboard,
  Layers,
  Maximize,
  Mouse,
  Move,
  Type,
} from "lucide-react";
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
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type TooltipContentProps,
} from "@/shared/ui/tooltip";
import { useUiI18n } from "@/shared/i18n";

type HandbookDialogProps = {
  tooltipSide?: TooltipContentProps["side"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement | null;
};

export function HandbookDialog({
  tooltipSide = "left",
  open,
  onOpenChange,
  trigger,
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
              aria-label="Open user manual"
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
            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Move className="size-4" /> {t("manual.view")}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-accent/40 p-2 rounded-md flex justify-between items-center">
                  <span>{t("manual.pan")}</span>
                  <div className="flex gap-1 items-center">
                    <kbd className="bg-background px-1.2 py-0.5 rounded border text-[9px] font-mono">
                      Space
                    </kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <Mouse className="size-3" />
                  </div>
                </div>
                <div className="bg-accent/40 p-2 rounded-md flex justify-between items-center">
                  <span>{t("manual.zoom")}</span>
                  <div className="flex gap-1">
                    <kbd className="bg-background px-1.2 py-0.5 rounded border text-[9px] font-mono">
                      Ctrl
                    </kbd>
                    <span className="text-muted-foreground text-[10px]">+</span>
                    <span className="font-mono text-[10px]">Scroll</span>
                  </div>
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
                    text/bg/box
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
                    Double
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
