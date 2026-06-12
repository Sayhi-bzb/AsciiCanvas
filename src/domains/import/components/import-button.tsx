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

export function ImportButton() {
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
      feedback.success("Import complete", {
        description: `${session.name} opened in a new session.`,
      });
    } catch (error) {
      feedback.error("Import failed", {
        description:
          error instanceof Error
            ? error.message
            : "Could not import the selected JSON file.",
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
        accept=".json,application/json"
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
            {isImporting ? "Importing..." : "Import Canvas"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}
