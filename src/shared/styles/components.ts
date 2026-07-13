import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes";

export const uiClass = {
  sessionShell: cn(
    rx.surface({ kind: "overlay", elevated: true }),
    "relative flex items-center gap-1.5 p-1.5 rounded-2xl border-primary backdrop-blur-md pointer-events-auto"
  ),
  toolbarShell: cn(
    "relative flex items-center gap-1 rounded-lg bg-muted p-[3px] pointer-events-auto"
  ),
  submenuPanel: cn(
    "z-50 flex w-auto min-w-[100px] flex-col gap-0.5 overflow-hidden rounded-lg border-0 bg-muted p-[3px] shadow-none"
  ),
};

