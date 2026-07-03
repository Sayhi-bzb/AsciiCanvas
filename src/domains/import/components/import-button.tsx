"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { feedback } from "@/shared/services/effects";
import { useUiI18n } from "@/shared/i18n";

export function ImportButton() {
  const { t } = useUiI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importCanvasSession = useCanvasStore(
    (state) => state.importCanvasSession
  );
  const [isImporting, setIsImporting] = useState(false);

  const openFilePicker = () => {
    if (isImporting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setIsImporting(true);
    try {
      const raw = await file.text();
      const session = importCanvasSession(raw);
      feedback.success(t("import.success"), {
        description: t("import.successDescription", { name: session.name }),
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

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.cast,application/json,text/plain"
        className="sr-only"
        onChange={handleFileChange}
      />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              tone="subtle"
              shape="square"
              size="md"
              disabled={isImporting}
              className="size-8 text-muted-foreground transition-colors hover:text-primary"
              onClick={openFilePicker}
            >
              <Upload className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isImporting ? t("import.importing") : t("import.tooltip")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}
