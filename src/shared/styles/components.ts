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
  minimapShell: "absolute top-4 left-4 z-[60] select-none pointer-events-auto",
  minimapToggle: cn(
    rx.surface({ kind: "overlay", elevated: true }),
    "size-9 rounded-xl border-border backdrop-blur-md"
  ),
  minimapPanel: cn(
    rx.surface({ kind: "muted", elevated: true }),
    "w-[244px] overflow-hidden rounded-xl border-border backdrop-blur-sm"
  ),
  minimapHeader:
    "flex h-9 items-center justify-between gap-2 border-b px-2 text-xs",
  minimapCanvasWrap: "p-3 bg-background/70",
  minimapCanvas:
    "block size-[220px] rounded-lg opacity-100 transition-all active:scale-[0.99]",
  submenuPanel: cn(
    rx.surface({ kind: "overlay", elevated: true }),
    "w-auto p-1 flex flex-col gap-0.5 z-50 overflow-hidden min-w-[100px]"
  ),
};

