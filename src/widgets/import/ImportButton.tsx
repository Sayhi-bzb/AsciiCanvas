"use client";

import { Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type TooltipContentProps,
} from "@/shared/ui/tooltip";
import { useUiI18n } from "@/shared/i18n";
import { useCanvasImport } from "./useCanvasImport";

type ImportButtonProps = {
  tooltipSide?: TooltipContentProps["side"];
};

export function ImportButton({ tooltipSide = "left" }: ImportButtonProps = {}) {
  const { t } = useUiI18n();
  const {
    fileInputRef,
    handleFileChange,
    isImporting,
    openFilePicker,
  } = useCanvasImport();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.cast,application/json,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

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
          <TooltipContent side={tooltipSide}>
            {isImporting ? t("import.importing") : t("import.tooltip")}
          </TooltipContent>
        </Tooltip>
    </>
  );
}
