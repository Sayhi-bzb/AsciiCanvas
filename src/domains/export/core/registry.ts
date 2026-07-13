import type { CanvasMode } from "@/domains/sessions/public";
import type { ExportFormat } from "./types";

export type ExportFormatDefinition = {
  format: ExportFormat;
  label: string;
  subLabel: string;
  modes: readonly CanvasMode[];
  artifactKind: "text" | "blob";
  supportsColor: boolean;
  supportsClipboard: boolean;
  truncatePreview: boolean;
};

const ALL_STATIC_MODES: readonly CanvasMode[] = ["freeform", "structured"];

export const EXPORT_FORMATS: readonly ExportFormatDefinition[] = [
  {
    format: "txt",
    label: "TXT",
    subLabel: "plain",
    modes: ALL_STATIC_MODES,
    artifactKind: "text",
    supportsColor: false,
    supportsClipboard: true,
    truncatePreview: false,
  },
  {
    format: "json",
    label: "JSON",
    subLabel: "protocol",
    modes: ["freeform", "structured", "animation"],
    artifactKind: "text",
    supportsColor: true,
    supportsClipboard: true,
    truncatePreview: true,
  },
  {
    format: "ansi",
    label: "ANSI",
    subLabel: "terminal",
    modes: ALL_STATIC_MODES,
    artifactKind: "text",
    supportsColor: true,
    supportsClipboard: true,
    truncatePreview: true,
  },
  {
    format: "png",
    label: "PNG",
    subLabel: "image",
    modes: ALL_STATIC_MODES,
    artifactKind: "blob",
    supportsColor: true,
    supportsClipboard: true,
    truncatePreview: false,
  },
  {
    format: "gif",
    label: "GIF",
    subLabel: "animation",
    modes: ["animation"],
    artifactKind: "blob",
    supportsColor: true,
    supportsClipboard: false,
    truncatePreview: false,
  },
  {
    format: "cast",
    label: "CAST",
    subLabel: "asciinema",
    modes: ["animation"],
    artifactKind: "text",
    supportsColor: true,
    supportsClipboard: true,
    truncatePreview: true,
  },
] as const;

const FORMAT_ORDER: Record<CanvasMode, readonly ExportFormat[]> = {
  freeform: ["txt", "json", "ansi", "png"],
  structured: ["txt", "json", "ansi", "png"],
  animation: ["json", "cast", "gif"],
};

export const getAvailableExportFormats = (mode: CanvasMode) =>
  FORMAT_ORDER[mode].map(
    (format) => EXPORT_FORMATS.find((definition) => definition.format === format)!
  );

export const getExportFormatDefinition = (format: ExportFormat) =>
  EXPORT_FORMATS.find((definition) => definition.format === format);
