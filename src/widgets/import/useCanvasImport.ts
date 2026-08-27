import { useRef, useState, type ChangeEvent } from "react";
import { useCanvasRuntime } from "@/domains/canvas/public";
import { feedback } from "@/shared/services/effects";
import { useUiI18n } from "@/shared/i18n";

export function useCanvasImport() {
  const canvas = useCanvasRuntime();
  const { t } = useUiI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importCanvasSession = canvas.commands.sessions.import;
  const [isImporting, setIsImporting] = useState(false);

  const openFilePicker = () => {
    if (isImporting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setIsImporting(true);
    try {
      const raw = await file.text();
      importCanvasSession(raw, {
        name: file.name.replace(/\.(?:slides\.md|chardesk|ans|txt)$/i, ""),
        sourceName: file.name,
      });
    } catch (error) {
      feedback.error(t("import.failed"), {
        description:
          error instanceof Error
            ? error.message
            : t("import.failedDescription"),
      });
    } finally {
      setIsImporting(false);
    }
  };

  return {
    fileInputRef,
    handleFileChange,
    isImporting,
    openFilePicker,
  };
}
