import type { GridMap, SelectionArea } from "@/shared/types";
import {
  createPngBlobFromGrid,
  createSelectionPngBlob,
} from "../formats/raster";
import { exportProtocolToJSON } from "../formats/protocol";
import { exportStructuredF12Text } from "../formats/structuredText";
import { exportToAnsi, exportToString } from "../formats/text";
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
  if (
    !definition?.modes.includes(context.canvasMode) ||
    definition.artifactKind !== "text"
  ) {
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
      case "ascanvas":
        return exportSucceeded(
          textArtifact(
            format,
            exportProtocolToJSON(context),
            `ascii-canvas-${getTimestamp()}.ascanvas`,
            "application/vnd.ascii-canvas+json;charset=utf-8"
          )
        );
      case "ansi":
        return exportSucceeded(
          textArtifact(
            format,
            exportToAnsi(context.grid, {
              includeColor: context.includeColor,
            }),
            `ascii-canvas-${getTimestamp()}.ans`,
            "text/plain;charset=utf-8"
          )
        );
      case "png":
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
  if (textResult.ok || format !== "png") return textResult;

  try {
    const blob = await createPngBlobFromGrid(
      context.grid,
      context.showGrid,
      context.includeColor
    );
    return blob
      ? exportSucceeded({
          kind: "blob",
          format: "png",
          content: blob,
          filename: `ascii-city-${getTimestamp()}.png`,
          mimeType: "image/png",
        })
      : exportFailed(
          context.grid.size === 0 ? "empty-content" : "canvas-unavailable"
        );
  } catch (cause) {
    return exportFailed("encoding-failed", cause);
  }
};
