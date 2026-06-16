"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Film, ImageIcon } from "lucide-react";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  CanvasMode,
  GridMap,
  StructuredNode,
} from "@/shared/types";
import { Button } from "@/shared/ui/button";
import { ActionButton } from "@/shared/ui/action-button";
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
import { clipboard, feedback } from "@/shared/services/effects";
import { cn } from "@/shared/lib/utils";
import { ExportPreview } from "./export-preview";
import { AnimationExportPreview } from "./animation-export-preview";
import {
  copyCanvasToPngClipboard,
  downloadTextFile,
  exportAnimationFrameToAnsi,
  exportAnimationToGIF,
  exportProtocolToJSON,
  exportStructuredF12Text,
  exportToAnsi,
  exportToPNG,
  exportToString,
} from "../utils/export";
import { exportAnimationToCast } from "@/domains/cast";

type ExportDialogProps = {
  grid: GridMap;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  canvasBounds: AnimationCanvasSize | null;
  animationTimeline: AnimationTimeline | null;
  exportShowGrid: boolean;
  setExportShowGrid: (show: boolean) => void;
};

type ExportFormat = "txt" | "json" | "ansi" | "png" | "gif" | "cast";

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

export function ExportDialog({
  grid,
  canvasMode,
  structuredScene,
  canvasBounds,
  animationTimeline,
  exportShowGrid,
  setExportShowGrid,
}: ExportDialogProps) {
  const shouldExportStructured = canvasMode === "structured";
  const shouldExportAnimation = canvasMode === "animation";
  const [exportFormat, setExportFormat] = useState<ExportFormat>("txt");
  const [includeColor, setIncludeColor] = useState(true);
  const availableFormats = useMemo(
    () =>
      shouldExportAnimation
        ? [
            { value: "json" as const, label: "JSON", subLabel: "protocol" },
            { value: "cast" as const, label: "CAST", subLabel: "asciinema" },
            { value: "gif" as const, label: "GIF", subLabel: "animation" },
          ]
        : [
            { value: "txt" as const, label: "TXT", subLabel: "plain" },
            { value: "json" as const, label: "JSON", subLabel: "protocol" },
            { value: "ansi" as const, label: "ANSI", subLabel: "terminal" },
            { value: "png" as const, label: "PNG", subLabel: "image" },
          ],
    [shouldExportAnimation]
  );
  const activeFormat = availableFormats.some(
    (format) => format.value === exportFormat
  )
    ? exportFormat
    : availableFormats[0].value;
  const protocolJsonExport = useMemo(
    () =>
      canvasMode === "animation" && (!canvasBounds || !animationTimeline)
        ? ""
        : exportProtocolToJSON({
            canvasMode,
            grid,
            structuredScene,
            canvasBounds,
            animationTimeline,
            includeColor,
          }),
    [
      canvasMode,
      canvasBounds,
      animationTimeline,
      includeColor,
      structuredScene,
      grid,
    ]
  );
  const plainTextExport = useMemo(() => exportToString(grid), [grid]);
  const structuredF12Export = useMemo(
    () => exportStructuredF12Text(structuredScene),
    [structuredScene]
  );
  const ansiExport = useMemo(
    () =>
      shouldExportAnimation && canvasBounds
        ? exportAnimationFrameToAnsi(canvasBounds, Array.from(grid.entries()), {
            includeColor,
          })
        : exportToAnsi(grid, { includeColor }),
    [shouldExportAnimation, canvasBounds, grid, includeColor]
  );
  const castExport = useMemo(
    () =>
      shouldExportAnimation && canvasBounds && animationTimeline
        ? exportAnimationToCast(canvasBounds, animationTimeline, {
            includeColor,
          })
        : "",
    [animationTimeline, canvasBounds, includeColor, shouldExportAnimation]
  );
  const textExport = useMemo(() => {
    if (activeFormat === "json") return protocolJsonExport;
    if (activeFormat === "ansi") return ansiExport;
    if (activeFormat === "cast") return castExport;
    if (activeFormat === "txt") {
      return shouldExportStructured ? structuredF12Export : plainTextExport;
    }
    return "";
  }, [
    activeFormat,
    ansiExport,
    castExport,
    plainTextExport,
    protocolJsonExport,
    shouldExportStructured,
    structuredF12Export,
  ]);
  const isTextPreview =
    activeFormat === "txt" ||
    activeFormat === "json" ||
    activeFormat === "ansi" ||
    activeFormat === "cast";
  const supportsColorToggle =
    activeFormat === "json" ||
    activeFormat === "ansi" ||
    activeFormat === "cast" ||
    activeFormat === "png" ||
    activeFormat === "gif";
  const shouldTruncatePreview =
    activeFormat === "json" || activeFormat === "ansi" || activeFormat === "cast";
  const lineCount = useMemo(() => {
    if (shouldTruncatePreview || !textExport) return 0;
    return textExport.split("\n").length;
  }, [shouldTruncatePreview, textExport]);
  const charCount = textExport.length;
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
  const previewLineCount = useMemo(
    () => (previewState.content ? previewState.content.split("\n").length : 0),
    [previewState.content]
  );
  const previewCharCount = previewState.content.length;
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
  const saveIcon = activeFormat === "gif" ? Film : activeFormat === "png" ? ImageIcon : Download;
  const canShowAnimationPreview =
    shouldExportAnimation && canvasBounds && animationTimeline;

  const copyActiveFormat = async () => {
    if (activeFormat === "gif") {
      feedback.warning("Copy unavailable", {
        description: "GIF is save-only in this export panel.",
      });
      return false;
    }

    if (activeFormat === "png") {
      const copied = await copyCanvasToPngClipboard(
        grid,
        exportShowGrid,
        includeColor
      );
      if (!copied) {
        feedback.error("Copy failed", {
          description: "Could not write PNG image to clipboard.",
        });
      }
      return copied;
    }

    const copied = await clipboard.writeText(textExport);
    if (!copied) {
      feedback.error("Copy failed", {
        description: `Could not write ${activeFormat.toUpperCase()} export to clipboard.`,
      });
    }
    return copied;
  };

  const saveActiveFormat = async () => {
    switch (activeFormat) {
      case "txt":
        return downloadTextFile(
          `ascii-canvas-${Date.now()}.txt`,
          textExport,
          "text/plain;charset=utf-8"
        );
      case "json":
        return downloadTextFile(`ascii-canvas-${Date.now()}.json`, textExport);
      case "cast":
        return downloadTextFile(
          `ascii-animation-${Date.now()}.cast`,
          textExport,
          "text/plain;charset=utf-8"
        );
      case "ansi":
        return downloadTextFile(
          `ascii-canvas-${Date.now()}.ans`,
          textExport,
          "text/plain;charset=utf-8"
        );
      case "png":
        return exportToPNG(grid, exportShowGrid, includeColor);
      case "gif":
        if (!canvasBounds || !animationTimeline) return false;
        return exportAnimationToGIF(canvasBounds, animationTimeline, includeColor);
    }
  };

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
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
            {shouldExportAnimation ? "Export Animation" : "Export Blueprint"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-xl gap-0 p-0 max-h-[85vh] min-w-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-muted/30 p-5 pb-3">
          <DialogHeader>
            <DialogTitle className="text-base">Export</DialogTitle>
          </DialogHeader>
        </div>

        <div className="min-h-0 min-w-0 space-y-4 px-5 py-4">
          <div className="min-w-0 space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availableFormats.map((format) => (
                <button
                  key={format.value}
                  type="button"
                  onClick={() => setExportFormat(format.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left transition-colors",
                    activeFormat === format.value
                      ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-muted/20 text-foreground hover:bg-accent/45"
                  )}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.24em]">
                    {format.label}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {format.subLabel}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "w-full relative group min-w-0",
              shouldExportStructured || shouldExportAnimation ? "h-72" : "aspect-video"
            )}
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl blur opacity-25" />
            <div className="relative h-full border rounded-xl bg-background overflow-hidden shadow-inner p-3 min-w-0">
              <div className="flex h-full min-w-0 flex-col gap-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mt-1 truncate text-sm font-semibold text-foreground">
                      {activeFormatMeta.label}
                    </div>
                  </div>

                  {isTextPreview ? (
                    <div className="flex min-w-0 shrink-0 items-center">
                      <div className="max-w-[11rem] text-right text-[10px] font-medium text-muted-foreground">
                        {shouldTruncatePreview && previewState.truncated
                          ? `Previewing ${previewLineCount} lines · ${previewCharCount}/${charCount} chars`
                          : `${lineCount} lines · ${charCount} chars`}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                      {activeFormat === "gif" ? "save-only" : "preview"}
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 min-w-0 flex-1">
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
                      <div className="flex h-full min-h-0 min-w-0 flex-1 rounded-lg border border-border bg-muted/20 p-3">
                        <ExportPreview
                          grid={grid}
                          showColor={includeColor}
                          showGrid={exportShowGrid}
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
                      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-2">
                        <pre
                          className="min-h-0 min-w-0 w-0 max-w-full flex-1 overflow-x-auto overflow-y-auto rounded-md bg-background p-2 font-mono text-[10px] leading-relaxed text-foreground whitespace-pre"
                        >
                          {previewState.content || previewFallback}
                        </pre>
                      </div>
                      {shouldTruncatePreview && previewState.truncated && (
                        <div className="border-t border-border bg-muted/30 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Preview truncated. Copy or save for full {activeFormatMeta.label}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 py-2">
            <ActionButton
              tone="neutral"
              size="full"
              shape="auto"
              icon={Copy}
              whileHover={{ scale: 1 }}
              label="Copy"
              disabled={activeFormat === "gif"}
              className="rounded-2xl border border-border bg-muted/20 text-foreground transition-colors hover:bg-accent/45 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
              onAction={copyActiveFormat}
            />
            <ActionButton
              tone="neutral"
              size="full"
              shape="auto"
              icon={saveIcon}
              whileHover={{ scale: 1 }}
              label="Save"
              className="rounded-2xl border border-border bg-muted/20 text-foreground transition-colors hover:bg-accent/45 hover:text-foreground"
              onAction={saveActiveFormat}
            />
          </div>

          {supportsColorToggle && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Color
                </div>
                <Button
                  tone={includeColor ? "primary" : "neutral"}
                  size="sm"
                  onClick={() => setIncludeColor((prev) => !prev)}
                  className="h-6 px-2 rounded-md text-[10px] uppercase font-bold"
                >
                  {includeColor ? "ON" : "OFF"}
                </Button>
              </div>
              {activeFormat === "png" && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Grid
                  </div>
                  <Button
                    tone={exportShowGrid ? "primary" : "neutral"}
                    size="sm"
                    onClick={() => setExportShowGrid(!exportShowGrid)}
                    className="h-6 px-2 rounded-md text-[10px] uppercase font-bold"
                  >
                    {exportShowGrid ? "ON" : "OFF"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
