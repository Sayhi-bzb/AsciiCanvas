import { useCallback } from "react";
import {
  deliverExportDownload,
  prepareExport,
  type ExportContext,
  type ExportFormat,
} from "@/domains/export/public";
import { useUiI18n } from "@/shared/i18n";
import { feedback } from "@/shared/services/effects";

export function useAppMenuExport(context: ExportContext) {
  const { t } = useUiI18n();

  const save = useCallback(
    async (format: ExportFormat) => {
      const prepared = prepareExport(context, format);
      const delivered = prepared.ok
        ? await deliverExportDownload(prepared.value)
        : prepared;
      if (!delivered.ok) {
        feedback.error(t("export.saveFailed"), {
          description:
            delivered.error.code === "image-too-large"
              ? t("export.imageTooLargeDescription")
              : t("export.saveFailedDescription", {
                  format: format.toUpperCase(),
                }),
        });
      }
      return delivered.ok;
    },
    [context, t]
  );

  return { save };
}
