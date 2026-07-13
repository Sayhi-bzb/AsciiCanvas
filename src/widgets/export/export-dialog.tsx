"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Copy, Download } from "lucide-react";
import type { GridMap } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { AnimationCanvasSize, AnimationTimeline } from "@/domains/animation/public";
import { Button } from "@/shared/ui/button";
import { ActionButton } from "@/shared/ui/action-button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { feedback } from "@/shared/services/effects";
import { cn } from "@/shared/lib/utils";
import { useUiI18n } from "@/shared/i18n";
import { ExportPreview } from "./export-preview";
import { AnimationExportPreview } from "./animation-export-preview";
import {
  deliverExportClipboard,
  deliverExportDownload,
  getAvailableExportFormats,
  getExportFormatDefinition,
  prepareExport,
  prepareTextExport,
  type ExportContext,
  type ExportFormat,
} from "@/domains/export/public";

type ExportDialogProps = {
  grid: GridMap;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  structuredComponents: StructuredComponentInstance[];
  canvasBounds: AnimationCanvasSize | null;
  animationTimeline: AnimationTimeline | null;
  exportShowGrid: boolean;
  setExportShowGrid: (show: boolean) => void;
};

type ExportOptionToggleProps = {
  checked: boolean;
  label: string;
  onCheckedChange: () => void;
};

const PREVIEW_CHAR_LIMIT = 12_000;
const PREVIEW_LINE_LIMIT = 160;

function createPreviewSnippet(value: string) {
  let index = 0;
  let lineCount = 0;

  while (index < value.length && index < PREVIEW_CHAR_LIMIT) {
    if (value[index] === "\n") {
      lineCount += 1;
      if (lineCount >= PREVIEW_LINE_LIMIT) {
        break;
      }
    }
    index += 1;
  }

  const hitCharLimit = index >= PREVIEW_CHAR_LIMIT && index < value.length;
  const hitLineLimit = lineCount >= PREVIEW_LINE_LIMIT && index < value.length;
  const endIndex = hitCharLimit || hitLineLimit ? index : value.length;

  return {
    content: value.slice(0, endIndex),
    truncated: endIndex < value.length,
  };
}

function ExportOptionToggle({
  checked,
  label,
  onCheckedChange,
}: ExportOptionToggleProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onCheckedChange}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          checked
            ? "border-primary bg-primary"
            : "border-border bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

export function ExportDialog({
  grid,
  canvasMode,
  structuredScene,
  structuredComponents,
  canvasBounds,
  animationTimeline,
  exportShowGrid,
  setExportShowGrid,
}: ExportDialogProps) {
  const { t } = useUiI18n();
  const shouldExportStructured = canvasMode === "structured";
  const shouldExportAnimation = canvasMode === "animation";
  const [exportFormat, setExportFormat] = useState<ExportFormat>("txt");
  const [includeColor, setIncludeColor] = useState(true);
  const availableFormats = useMemo(
    () =>
      getAvailableExportFormats(canvasMode).map((definition) => ({
        value: definition.format,
        label: definition.label,
      })),
    [canvasMode]
  );
  const activeFormat = availableFormats.some(
    (format) => format.value === exportFormat
  )
    ? exportFormat
    : availableFormats[0].value;
  const exportContext = useMemo<ExportContext>(
    () => ({
      canvasMode,
      grid,
      structuredScene,
      structuredComponents,
      canvasBounds,
      animationTimeline,
      includeColor,
      showGrid: exportShowGrid,
    }),
    [
      animationTimeline,
      canvasBounds,
      canvasMode,
      exportShowGrid,
      grid,
      includeColor,
      structuredComponents,
      structuredScene,
    ]
  );
  const textResult = useMemo(
    () => prepareTextExport(exportContext, activeFormat),
    [activeFormat, exportContext]
  );
  const textExport = textResult.ok ? textResult.value.content : "";
  const formatDefinition = getExportFormatDefinition(activeFormat);
  const supportsColorToggle = formatDefinition?.supportsColor ?? false;
  const shouldTruncatePreview = formatDefinition?.truncatePreview ?? false;
  const activeFormatMeta =
    availableFormats.find((format) => format.value === activeFormat) ??
    availableFormats[0];
  const previewState = useMemo(() => {
    if (!textExport) {
      return { content: "", truncated: false };
    }
    if (!shouldTruncatePreview) {
      return { content: textExport, truncated: false };
    }
    return createPreviewSnippet(textExport);
  }, [shouldTruncatePreview, textExport]);
  const previewFallback = useMemo(() => {
    if (activeFormat === "json") {
      return shouldExportAnimation
        ? '{\n  "type": "ascii-canvas-document",\n  "version": 1,\n  "mode": "animation",\n  "frames": []\n}'
        : shouldExportStructured
        ? '{\n  "type": "ascii-canvas-document",\n  "version": 1,\n  "mode": "structured",\n  "nodes": []\n}'
        : '{\n  "type": "ascii-canvas-document",\n  "version": 1,\n  "mode": "freeform",\n  "cells": []\n}';
    }

    if (activeFormat === "ansi") {
      return "\u001b[38;2;255;255;255m# ANSI preview will appear here\u001b[0m";
    }

    if (activeFormat === "cast") {
      return '{"version":2,"width":80,"height":25,"env":{"TERM":"xterm-256color"}}';
    }

    return shouldExportStructured
      ? "No structured nodes to export yet."
      : "No characters to export yet.";
  }, [
    activeFormat,
    shouldExportAnimation,
    shouldExportStructured,
  ]);
  const canShowAnimationPreview =
    shouldExportAnimation && canvasBounds && animationTimeline;

  const handleFormatKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    formatIndex: number
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
        ? availableFormats.length - 1
        : (formatIndex +
            (event.key === "ArrowRight" ? 1 : -1) +
            availableFormats.length) %
          availableFormats.length;
    const nextFormat = availableFormats[nextIndex].value;
    setExportFormat(nextFormat);
    document.getElementById(`export-format-${nextFormat}`)?.focus();
  };

  const copyActiveFormat = async () => {
    if (!formatDefinition?.supportsClipboard) {
      feedback.warning(t("export.copyUnavailable"), {
        description: t("export.copyUnavailableDescription"),
      });
      return false;
    }

    const prepared = await prepareExport(exportContext, activeFormat);
    if (!prepared.ok) {
      feedback.error(t("export.copyFailed"), {
        description: t("export.copyTextFailedDescription", {
          format: activeFormat.toUpperCase(),
        }),
      });
      return false;
    }

    const delivered = await deliverExportClipboard(prepared.value);
    if (!delivered.ok) {
      feedback.error(t("export.copyFailed"), {
        description:
          activeFormat === "png"
            ? t("export.copyPngFailedDescription")
            : t("export.copyTextFailedDescription", {
                format: activeFormat.toUpperCase(),
              }),
      });
    }
    return delivered.ok;
  };

  const saveActiveFormat = async () => {
    const prepared = await prepareExport(exportContext, activeFormat);
    if (!prepared.ok) return false;
    return deliverExportDownload(prepared.value).ok;
  };

  return (
    <TooltipProvider>
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                aria-label={
                  shouldExportAnimation
                    ? t("export.tooltip.animation")
                    : t("export.tooltip.blueprint")
                }
                tone="subtle"
                shape="square"
                size="md"
                className="size-8 text-muted-foreground hover:text-primary transition-colors"
              >
                <Download className="size-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            {shouldExportAnimation
              ? t("export.tooltip.animation")
              : t("export.tooltip.blueprint")}
          </TooltipContent>
        </Tooltip>

        <DialogContent className="sm:max-w-xl gap-0 p-0 max-h-[85vh] min-w-0 overflow-hidden border-none shadow-2xl">
          <div className="border-b border-border bg-muted/20 px-5 py-4">
            <DialogHeader>
              <DialogTitle className="text-base">{t("export.title")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="min-h-0 min-w-0 space-y-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-2 border-b border-border">
              <div
                role="tablist"
                aria-label={t("export.title")}
                className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto"
              >
              {availableFormats.map((format, formatIndex) => (
                <button
                  id={`export-format-${format.value}`}
                  key={format.value}
                  type="button"
                  role="tab"
                  aria-selected={activeFormat === format.value}
                  tabIndex={activeFormat === format.value ? 0 : -1}
                  onClick={() => setExportFormat(format.value)}
                  onKeyDown={(event) =>
                    handleFormatKeyDown(event, formatIndex)
                  }
                  className={cn(
                    "relative shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    activeFormat === format.value
                      ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary"
                      : ""
                  )}
                >
                  {format.label}
                </button>
              ))}
              </div>

              <div
                data-testid="export-actions"
                className="flex shrink-0 items-center gap-1 pb-1"
              >
              {formatDefinition?.supportsClipboard && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ActionButton
                      tone="subtle"
                      size="md"
                      shape="square"
                      icon={Copy}
                      aria-label={t("export.copy")}
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onAction={copyActiveFormat}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{t("export.copy")}</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <ActionButton
                    tone="subtle"
                    size="md"
                    shape="square"
                    icon={Download}
                    aria-label={t("export.save")}
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onAction={saveActiveFormat}
                  />
                </TooltipTrigger>
                <TooltipContent>{t("export.save")}</TooltipContent>
              </Tooltip>
              </div>
            </div>

            <div
              className={cn(
                "w-full min-w-0 overflow-hidden rounded-lg border border-border bg-background",
                shouldExportStructured || shouldExportAnimation
                  ? "h-72"
                  : "aspect-video"
              )}
            >
              <div className="flex h-full min-h-0 min-w-0 [&>div]:min-w-0 [&>div]:flex-1 [&>div]:rounded-none [&>div]:border-0">
                {activeFormat === "gif" && canShowAnimationPreview ? (
                    <AnimationExportPreview
                      size={canvasBounds}
                      timeline={animationTimeline}
                      showColor={includeColor}
                    />
                  ) : activeFormat === "png" ? (
                    canShowAnimationPreview ? (
                      <AnimationExportPreview
                        size={canvasBounds}
                        timeline={animationTimeline}
                        showColor={includeColor}
                      />
                    ) : (
                      <div className="flex h-full min-h-0 min-w-0 flex-1 bg-muted/20 p-3">
                        <ExportPreview
                          grid={grid}
                          showColor={includeColor}
                          showGrid={exportShowGrid}
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-muted/20">
                      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
                        <ScrollArea
                          scrollbars="both"
                          className="min-h-0 min-w-0 flex-1 bg-background"
                        >
                          <pre className="min-h-full min-w-full w-max bg-background p-2 font-mono text-[10px] leading-relaxed text-foreground whitespace-pre">
                            {previewState.content || previewFallback}
                          </pre>
                        </ScrollArea>
                      </div>
                      {shouldTruncatePreview && previewState.truncated && (
                        <div className="border-t border-border bg-muted/30 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {t("export.truncated", {
                            format: activeFormatMeta.label,
                          })}
                        </div>
                      )}
                    </div>
                )}
              </div>
            </div>

            {supportsColorToggle && (
              <div
                data-testid="export-options"
                className="flex min-h-8 flex-wrap items-center justify-end gap-x-5 gap-y-2 border-t border-border pt-3"
              >
              <ExportOptionToggle
                checked={includeColor}
                label={t("export.color")}
                onCheckedChange={() => setIncludeColor((prev) => !prev)}
              />
              {activeFormat === "png" && (
                <ExportOptionToggle
                  checked={exportShowGrid}
                  label={t("export.grid")}
                  onCheckedChange={() => setExportShowGrid(!exportShowGrid)}
                />
              )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
