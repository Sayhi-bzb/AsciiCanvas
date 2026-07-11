import { clipboard } from "@/shared/services/effects";
import {
  exportFailed,
  exportSucceeded,
  type ExportArtifact,
  type ExportResult,
} from "../core/types";

export const deliverExportDownload = (
  artifact: ExportArtifact
): ExportResult<true> => {
  try {
    const blob =
      artifact.kind === "blob"
        ? artifact.content
        : new Blob([artifact.content], { type: artifact.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = artifact.filename;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return exportSucceeded(true);
  } catch (cause) {
    return exportFailed("download-failed", cause);
  }
};

export const deliverExportClipboard = async (
  artifact: ExportArtifact
): Promise<ExportResult<true>> => {
  try {
    const copied =
      artifact.kind === "text"
        ? await clipboard.writeText(artifact.content)
        : typeof ClipboardItem === "undefined"
          ? false
          : await clipboard.writeItems([
              new ClipboardItem({ [artifact.mimeType]: artifact.content }),
            ]);
    return copied
      ? exportSucceeded(true)
      : exportFailed(
          typeof ClipboardItem === "undefined" && artifact.kind === "blob"
            ? "clipboard-unavailable"
            : "clipboard-write-failed"
        );
  } catch (cause) {
    return exportFailed("clipboard-write-failed", cause);
  }
};
