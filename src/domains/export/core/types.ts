import type { GridMap } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { SlideDeck } from "@/domains/slides/public";

export type ExportFormat =
  | "txt"
  | "chardesk"
  | "ansi"
  | "md"
  | "png"
 ;

export type ExportContext = {
  canvasMode: CanvasMode;
  grid: GridMap;
  structuredScene: StructuredNode[];
  structuredComponents: StructuredComponentInstance[];
  includeColor: boolean;
  showGrid: boolean;
  slideDeck?: SlideDeck | null;
  documentName?: string;
};

type ExportArtifactBase = {
  format: ExportFormat;
  filename: string;
  mimeType: string;
};

export type TextExportArtifact = ExportArtifactBase & {
  kind: "text";
  content: string;
};

type BlobExportArtifact = ExportArtifactBase & {
  kind: "blob";
  content: Blob;
};

export type ExportArtifact = TextExportArtifact | BlobExportArtifact;

type ExportErrorCode =
  | "unsupported-format"
  | "empty-content"
  | "canvas-unavailable"
  | "encoding-failed"
  | "clipboard-unavailable"
  | "clipboard-write-failed"
  | "download-failed";

type ExportError = {
  code: ExportErrorCode;
  cause?: unknown;
};

export type ExportResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ExportError };

export const exportSucceeded = <T>(value: T): ExportResult<T> => ({
  ok: true,
  value,
});

export const exportFailed = (
  code: ExportErrorCode,
  cause?: unknown
): ExportResult<never> => ({
  ok: false,
  error: cause === undefined ? { code } : { code, cause },
});
