import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes";

export const uiClass = {
  sessionShell: cn(
    rx.surface({ kind: "overlay", elevated: true }),
    "relative flex items-center gap-1.5 p-1.5 rounded-2xl border-primary backdrop-blur-md pointer-events-auto"
  ),
  toolbarShell: cn(
    rx.surface({ kind: "overlay", elevated: true }),
    "relative flex items-center gap-1 p-1.5 rounded-2xl backdrop-blur-md border-primary pointer-events-auto"
  ),
  minimapShell: cn(
    rx.surface({ kind: "muted", elevated: true }),
    "absolute top-4 left-4 z-[60] overflow-hidden select-none pointer-events-auto p-1 rounded-xl backdrop-blur-sm border-border"
  ),
  minimapCanvas:
    "block size-40 rounded-lg opacity-90 transition-all hover:opacity-100 active:scale-[0.98]",
  submenuPanel: cn(
    rx.surface({ kind: "overlay", elevated: true }),
    "w-auto p-1 flex flex-col gap-0.5 z-50 overflow-hidden min-w-[100px]"
  ),
};
