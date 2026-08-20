import { useCallback } from "react";
import {
  deliverExportDownload,
  prepareExport,
  type ExportContext,
  type ExportFormat,
} from "@/domains/export/public";

export type AppMenuExportErrorCode = "image-too-large" | "save-failed";

type AppMenuExportResult =
  | { ok: true }
  | { ok: false; errorCode: AppMenuExportErrorCode };

export function useAppMenuExport(context: ExportContext) {
  const save = useCallback(
    async (format: ExportFormat): Promise<AppMenuExportResult> => {
      const prepared = prepareExport(context, format);
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
    [context]
  );

  return { save };
}
