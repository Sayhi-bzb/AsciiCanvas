"use client";

import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type TooltipContentProps,
} from "@/shared/ui/tooltip";
import { useUiI18n } from "@/shared/i18n";

type ClearCanvasDialogProps = {
  isCollapsed: boolean;
  iconOnly?: boolean;
  label?: string;
  description?: string;
  tooltipSide?: TooltipContentProps["side"];
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement | null;
};

export function ClearCanvasDialog({
  isCollapsed,
  iconOnly = false,
  label = "Clear Canvas",
  description = "This will completely clear the current blueprint.",
  tooltipSide = "left",
  onConfirm,
  open,
  onOpenChange,
  trigger,
}: ClearCanvasDialogProps) {
  const { t } = useUiI18n();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger === null ? null : trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                tone="subtle"
                destructive
                shape={isCollapsed || iconOnly ? "square" : "auto"}
                size={isCollapsed || iconOnly ? "md" : "sm"}
                className={cn(
                  "justify-start gap-2",
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
          {(isCollapsed || iconOnly) && <TooltipContent side={tooltipSide}>{label}</TooltipContent>}
        </Tooltip>
      )}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("clear.title")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            tone="danger"
          >
            {t("dialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
