import { useCallback } from "react";
import { useCanvasRuntime } from "@/domains/canvas/public";
import {
  deliverExportDownload,
  prepareExport,
  type ExportFormat,
} from "@/domains/export/public";

export type CanvasSessionExportErrorCode = "image-too-large" | "save-failed";

type CanvasSessionExportResult =
  | { ok: true }
  | { ok: false; errorCode: CanvasSessionExportErrorCode };

export function useCanvasSessionExport() {
  const canvas = useCanvasRuntime();
  const save = useCallback(
    async (
      sessionId: string,
      format: ExportFormat
    ): Promise<CanvasSessionExportResult> => {
      const session = await canvas.materializeSession(sessionId);
      if (!session) return { ok: false, errorCode: "save-failed" };
      const prepared = prepareExport(
        {
          canvasMode: session.mode,
          surface: session.surface,
          structuredScene: session.structuredScene,
          structuredComponents: session.structuredComponents,
          includeColor: true,
          showGrid: false,
          slideDeck: session.slideDeck,
          documentName: session.name,
        },
        format
      );
      const delivered = prepared.ok
        ? await deliverExportDownload(prepared.value)
        : prepared;
      return delivered.ok
        ? { ok: true }
        : {
            ok: false,
            errorCode:
              delivered.error.code === "image-too-large"
                ? "image-too-large"
                : "save-failed",
          };
    },
    [canvas]
  );

  return { save };
}
