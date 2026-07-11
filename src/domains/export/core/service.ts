import type { GridMap, SelectionArea } from "@/shared/types";
import { exportAnimationToCast } from "../formats/cast";
import {
  createPngBlobFromGrid,
  createSelectionPngBlob,
} from "../formats/raster";
import { createAnimationGifBlob } from "../formats/gif";
import { exportProtocolToJSON } from "../formats/protocol";
import { exportStructuredF12Text } from "../formats/structuredText";
import {
  exportAnimationFrameToAnsi,
  exportToAnsi,
  exportToString,
} from "../formats/text";
import { getExportFormatDefinition } from "./registry";
import {
  exportFailed,
  exportSucceeded,
  type ExportArtifact,
  type ExportContext,
  type ExportFormat,
  type ExportResult,
  type TextExportArtifact,
} from "./types";

const textArtifact = (
  format: ExportFormat,
  content: string,
  filename: string,
  mimeType: string
): TextExportArtifact => ({
  kind: "text",
  format,
  content,
  filename,
  mimeType,
});

const getTimestamp = () => Date.now();

export const prepareSelectionPngExport = async (
  grid: GridMap,
  selections: SelectionArea[],
  showGrid: boolean,
  includeColor = true
): Promise<ExportResult<ExportArtifact>> => {
  try {
    const blob = await createSelectionPngBlob(
      grid,
      selections,
      showGrid,
      includeColor
    );
    return blob
      ? exportSucceeded({
          kind: "blob",
          format: "png",
          content: blob,
          filename: `ascii-selection-${getTimestamp()}.png`,
          mimeType: "image/png",
        })
      : exportFailed(
          selections.length === 0 ? "empty-content" : "canvas-unavailable"
        );
  } catch (cause) {
    return exportFailed("encoding-failed", cause);
  }
};

export const prepareTextExport = (
  context: ExportContext,
  format: ExportFormat
): ExportResult<TextExportArtifact> => {
  const definition = getExportFormatDefinition(format);
  if (!definition?.modes.includes(context.canvasMode) || definition.artifactKind !== "text") {
    return exportFailed("unsupported-format");
  }

  try {
    switch (format) {
      case "txt":
        return exportSucceeded(
          textArtifact(
            format,
            context.canvasMode === "structured"
              ? exportStructuredF12Text(
                  context.structuredScene,
                  context.structuredComponents
                )
              : exportToString(context.grid),
            `ascii-canvas-${getTimestamp()}.txt`,
            "text/plain;charset=utf-8"
          )
        );
      case "json":
        if (
          context.canvasMode === "animation" &&
          (!context.canvasBounds || !context.animationTimeline)
        ) {
          return exportFailed("missing-animation-state");
        }
        return exportSucceeded(
          textArtifact(
            format,
            exportProtocolToJSON(context),
            `ascii-canvas-${getTimestamp()}.json`,
            "application/json;charset=utf-8"
          )
        );
      case "ansi":
        return exportSucceeded(
          textArtifact(
            format,
            context.canvasMode === "animation" && context.canvasBounds
              ? exportAnimationFrameToAnsi(
                  context.canvasBounds,
                  Array.from(context.grid.entries()),
                  { includeColor: context.includeColor }
                )
              : exportToAnsi(context.grid, {
                  includeColor: context.includeColor,
                }),
            `ascii-canvas-${getTimestamp()}.ans`,
            "text/plain;charset=utf-8"
          )
        );
      case "cast":
        if (!context.canvasBounds || !context.animationTimeline) {
          return exportFailed("missing-animation-state");
        }
        return exportSucceeded(
          textArtifact(
            format,
            exportAnimationToCast(context.canvasBounds, context.animationTimeline, {
              includeColor: context.includeColor,
            }),
            `ascii-animation-${getTimestamp()}.cast`,
            "text/plain;charset=utf-8"
          )
        );
      case "png":
      case "gif":
        return exportFailed("unsupported-format");
    }
  } catch (cause) {
    return exportFailed("encoding-failed", cause);
  }
};

export const prepareExport = async (
  context: ExportContext,
  format: ExportFormat
): Promise<ExportResult<ExportArtifact>> => {
  const textResult = prepareTextExport(context, format);
  if (textResult.ok || !["png", "gif"].includes(format)) return textResult;

  try {
    if (format === "png") {
      const blob = await createPngBlobFromGrid(
        context.grid,
        context.showGrid,
        context.includeColor
      );
      return blob
        ? exportSucceeded({
            kind: "blob",
            format,
            content: blob,
            filename: `ascii-city-${getTimestamp()}.png`,
            mimeType: "image/png",
          })
        : exportFailed(context.grid.size === 0 ? "empty-content" : "canvas-unavailable");
    }

    if (!context.canvasBounds || !context.animationTimeline) {
      return exportFailed("missing-animation-state");
    }
    const blob = await createAnimationGifBlob(
      context.canvasBounds,
      context.animationTimeline,
      context.includeColor
    );
    return blob
      ? exportSucceeded({
          kind: "blob",
          format,
          content: blob,
          filename: `ascii-animation-${getTimestamp()}.gif`,
          mimeType: "image/gif",
        })
      : exportFailed("canvas-unavailable");
  } catch (cause) {
    return exportFailed("encoding-failed", cause);
  }
};
