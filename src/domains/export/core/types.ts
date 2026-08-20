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

export type BlobExportArtifact = ExportArtifactBase & {
  kind: "blob";
  content: Promise<Blob>;
};

export type ExportArtifact = TextExportArtifact | BlobExportArtifact;

export type ExportErrorCode =
  | "unsupported-format"
  | "empty-content"
  | "canvas-unavailable"
  | "image-too-large"
  | "encoding-failed"
  | "clipboard-unavailable"
  | "clipboard-write-failed"
  | "download-failed";

export type ExportError = {
  code: ExportErrorCode;
  cause?: unknown;
};

export class ExportPipelineError extends Error {
  readonly code: ExportErrorCode;
  readonly cause?: unknown;

  constructor(code: ExportErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = "ExportPipelineError";
    this.code = code;
    this.cause = cause;
  }
}

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

export const exportFailedFromCause = (
  cause: unknown,
  fallback: ExportErrorCode
): ExportResult<never> =>
  cause instanceof ExportPipelineError
    ? exportFailed(cause.code, cause.cause)
    : exportFailed(fallback, cause);
