import { useCallback } from "react";
import {
  deliverExportClipboard,
  deliverExportDownload,
  prepareExport,
  type ExportContext,
  type ExportFormat,
} from "@/domains/export/public";
import { useUiI18n } from "@/shared/i18n";
import { feedback } from "@/shared/services/effects";

export function useAppMenuExport(context: ExportContext) {
  const { t } = useUiI18n();

  const copy = useCallback(
    async (format: ExportFormat) => {
      const prepared = await prepareExport(context, format);
      if (!prepared.ok) {
        feedback.error(t("export.copyFailed"), {
          description: t("export.copyTextFailedDescription", {
            format: format.toUpperCase(),
          }),
        });
        return false;
      }

      const delivered = await deliverExportClipboard(prepared.value);
      if (!delivered.ok) {
        feedback.error(t("export.copyFailed"), {
          description:
            format === "png"
              ? t("export.copyPngFailedDescription")
              : t("export.copyTextFailedDescription", {
                  format: format.toUpperCase(),
                }),
        });
      }
      return delivered.ok;
    },
    [context, t]
  );

  const save = useCallback(
    async (format: ExportFormat) => {
      const prepared = await prepareExport(context, format);
      const delivered = prepared.ok
        ? deliverExportDownload(prepared.value)
        : prepared;
      if (!delivered.ok) {
        feedback.error(t("export.saveFailed"), {
          description: t("export.saveFailedDescription", {
            format: format.toUpperCase(),
          }),
        });
      }
      return delivered.ok;
    },
    [context, t]
  );

  return { copy, save };
}
