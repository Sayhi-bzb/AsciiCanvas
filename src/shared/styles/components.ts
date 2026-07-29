import { cn } from "@/shared/lib/utils";
import { rx } from "@/shared/styles/recipes";

const hostControl = cn(
  "text-muted-foreground transition-colors outline-none",
  "hover:bg-accent hover:text-accent-foreground",
  "focus-visible:ring-ring/50 focus-visible:ring-[3px]"
);

const hostIconControl = cn(
  "inline-flex size-8 flex-none items-center justify-center rounded-lg border-0 p-0 shadow-none",
  "[&_svg]:size-4 [&_svg]:shrink-0",
  hostControl
);

export const uiClass = {
  sessionShell: cn(
    rx.surface({ kind: "overlay", elevated: true }),
    "relative flex items-center gap-1.5 p-1.5 rounded-2xl border-primary backdrop-blur-md pointer-events-auto"
  ),
  toolbarShell: cn(
    "relative flex items-center gap-1 rounded-lg bg-muted p-[3px] pointer-events-auto"
  ),
  hostControl,
  hostIconControl,
  hostControlActive: cn("bg-accent text-foreground"),
  iconRail: cn(
    "flex rounded-lg bg-muted p-[3px]"
  ),
  iconRailItem: hostIconControl,
  dropdownPanel: cn(
    "z-50 min-w-48 overflow-hidden rounded-lg border-0 bg-muted p-[3px] text-popover-foreground shadow-none outline-none"
  ),
  dropdownSubPanel: cn(
    "z-50 min-w-36 overflow-hidden rounded-lg border-0 bg-muted p-[3px] text-popover-foreground shadow-none outline-none"
  ),
  dropdownItem: cn(
    "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors"
  ),
};
