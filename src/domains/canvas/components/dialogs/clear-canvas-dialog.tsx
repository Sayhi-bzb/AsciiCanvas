"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { useUiI18n } from "@/shared/i18n";

type ClearCanvasDialogProps = {
  isCollapsed: boolean;
  iconOnly?: boolean;
  label?: string;
  description?: string;
  onConfirm: () => void;
};

export function ClearCanvasDialog({
  isCollapsed,
  iconOnly = false,
  label = "Clear Canvas",
  description = "This will completely clear the current blueprint.",
  onConfirm,
}: ClearCanvasDialogProps) {
  const { t } = useUiI18n();

  return (
    <AlertDialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                tone="subtle"
                shape={isCollapsed || iconOnly ? "square" : "auto"}
                size={isCollapsed || iconOnly ? "md" : "sm"}
                className={cn(
                  "justify-start gap-2 text-destructive hover:bg-destructive/10 transition-colors",
                  isCollapsed || iconOnly ? "size-8 justify-center" : "w-full h-8 px-2"
                )}
              >
                <Trash2 className="size-4" />
                {!isCollapsed && !iconOnly && (
                  <span className="font-medium text-xs">{label}</span>
                )}
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          {(isCollapsed || iconOnly) && <TooltipContent side="left">{label}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("clear.title")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("dialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

