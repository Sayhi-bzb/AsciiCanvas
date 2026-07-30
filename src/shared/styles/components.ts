import { cn } from "@/shared/lib/utils";

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

const hostContainer = "rounded-lg border-0 bg-muted shadow-none";

export const uiClass = {
  dialogOverlay: cn(
    "fixed inset-0 z-50 bg-black/50",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
  ),
  dialogShell: cn(
    "fixed left-1/2 top-1/2 z-50 grid w-full max-w-[calc(100%-2rem)]",
    "-translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border-0 bg-background p-0 shadow-none outline-none sm:max-w-lg",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
    "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
  ),
  dialogHeader: cn(
    "relative flex flex-col gap-1.5 border-b border-accent bg-accent/40 px-4 py-3 pr-12 text-left"
  ),
  dialogBody: "px-4 py-4",
  dialogFooter: cn(
    "flex flex-col-reverse gap-2 border-t border-accent bg-accent/25 px-4 py-3",
    "sm:flex-row sm:justify-end"
  ),
  dialogClose: cn(hostIconControl, "absolute right-2 top-2 z-10"),
  dialogDivider: "border-accent",
  hostContainer,
  toolbarShell: cn(
    hostContainer,
    "relative flex items-center gap-1 p-[3px] pointer-events-auto"
  ),
  hostControl,
  hostIconControl,
  hostControlActive: cn("bg-accent text-foreground"),
  iconRail: cn(hostContainer, "flex p-[3px]"),
  iconRailItem: hostIconControl,
  dropdownPanel: cn(
    hostContainer,
    "z-50 min-w-48 overflow-hidden p-[3px] text-popover-foreground outline-none"
  ),
  dropdownSubPanel: cn(
    hostContainer,
    "z-50 min-w-36 overflow-hidden p-[3px] text-popover-foreground outline-none"
  ),
  dropdownItem: cn(
    "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors"
  ),
};
