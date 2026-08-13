import { cn } from "@/shared/lib/utils";
import type { ItemTone, Shape, Size, SurfaceKind, Tone } from "./tokens";

type ControlOptions = {
  tone?: Tone;
  size?: Size;
  shape?: Shape;
  outlined?: boolean;
};

type SurfaceOptions = {
  kind?: SurfaceKind;
  elevated?: boolean;
};

type FieldOptions = {
  density?: "compact" | "default";
  invalid?: boolean;
};

type ItemOptions = {
  active?: boolean;
  tone?: ItemTone;
  size?: Size;
  outlined?: boolean;
};

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

const hostSurface = "rounded-lg border-0 bg-host-surface";
const floatingHost = cn(hostSurface, "shadow-host");
const overlayPanel = "rounded-lg border-0 bg-overlay-surface shadow-overlay";
const quietInput = cn(
  "min-w-0 rounded-md border-0 bg-transparent text-xs shadow-none outline-none",
  "placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
);
const searchInput = cn(quietInput, "bg-search-surface");
const dialogHeader = "relative flex flex-col gap-1.5 text-left";

const controlBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-ring/50 focus-visible:ring-[3px] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const controlTone: Record<Tone, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  neutral: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  subtle: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  danger:
    "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  link: "text-primary underline-offset-4 hover:underline bg-transparent",
};

const controlSize: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-xs",
  lg: "h-9 px-4 text-xs",
};

const controlShape: Record<Shape, string> = {
  auto: "rounded-md",
  square: "rounded-lg",
  pill: "rounded-full",
};

export const rx = {
  dialogOverlay: cn(
    "fixed inset-0 z-(--layer-modal-backdrop) bg-dialog-overlay",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
  ),
  dialogShell: cn(
    "fixed left-1/2 top-1/2 z-(--layer-modal) grid w-full max-w-[calc(100%-2rem)]",
    "-translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-lg border-0 bg-dialog-surface p-4 shadow-dialog outline-none sm:max-w-lg",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
    "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
  ),
  dialogHeader,
  dialogHeaderWithClose: cn(dialogHeader, "pr-12"),
  dialogBody: "min-w-0",
  dialogFooter: cn(
    "flex flex-col-reverse gap-2",
    "sm:flex-row sm:justify-end"
  ),
  dialogClose: cn(hostIconControl, "absolute right-2 top-2 z-10"),
  hostContainer: cn(hostSurface, "shadow-none"),
  hostSurface,
  floatingHost,
  overlayPanel,
  quietInput,
  searchInput,
  contentScrollArea: cn(
    "group/content-scroll-area",
    "[&_[data-slot=scroll-area-scrollbar]]:opacity-0",
    "hover:[&_[data-slot=scroll-area-scrollbar]]:opacity-100",
    "focus-within:[&_[data-slot=scroll-area-scrollbar]]:opacity-100",
    "[&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/25"
  ),
  toolbarShell: cn(
    floatingHost,
    "relative flex items-center gap-1 p-[3px] pointer-events-auto"
  ),
  hostControl,
  hostIconControl,
  hostControlActive: "bg-accent text-foreground",
  iconRail: cn(hostSurface, "flex p-[3px] shadow-none"),
  iconRailItem: hostIconControl,
  dropdownPanel: cn(
    overlayPanel,
    "z-(--layer-popover) min-w-48 overflow-hidden p-[3px] text-popover-foreground outline-none"
  ),
  dropdownSubPanel: cn(
    overlayPanel,
    "z-(--layer-popover) min-w-36 overflow-hidden p-[3px] text-popover-foreground outline-none"
  ),
  dropdownItem: cn(
    "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors"
  ),
  control: ({
    tone = "primary",
    size = "md",
    shape = "auto",
    outlined = false,
  }: ControlOptions = {}) =>
    cn(
      controlBase,
      controlTone[tone],
      controlSize[size],
      controlShape[shape],
      shape === "square" && size === "sm" && "size-7 px-0",
      shape === "square" && size === "md" && "size-8 px-0",
      shape === "square" && size === "lg" && "size-9 px-0",
      tone === "link" && "h-auto px-0",
      outlined &&
        "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground"
    ),

  surface: ({ kind = "panel", elevated = false }: SurfaceOptions = {}) =>
    cn(
      kind === "panel" && "bg-background border border-border rounded-xl",
      kind === "overlay" && "bg-popover/95 border border-border rounded-xl",
      kind === "muted" && "bg-muted/40 border border-border rounded-lg",
      elevated && "shadow-xl"
    ),

  field: ({ density = "default", invalid = false }: FieldOptions = {}) =>
    cn(
      "w-full rounded-md border bg-background transition-colors outline-none",
      density === "default" && "h-8 px-2.5 py-1.5 text-xs",
      density === "compact" && "h-7 px-2 py-1 text-[11px]",
      "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      invalid && "border-destructive aria-invalid:border-destructive"
    ),

  item: ({
    active = false,
    tone = "subtle",
    size = "md",
    outlined = false,
  }: ItemOptions = {}) =>
    cn(
      "transition-colors outline-none focus-visible:ring-2 ring-sidebar-ring",
      tone === "subtle" &&
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      tone === "neutral" &&
        "text-sidebar-foreground bg-background hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      active && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
      size === "sm" && "h-6 text-[11px]",
      size === "md" && "h-7 text-xs",
      size === "lg" && "h-10 text-xs",
      outlined &&
        "shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]"
    ),

  panelText: () => "text-xs leading-4",
  panelLabel: () =>
    "text-[11px] leading-4 font-medium text-muted-foreground",
  panelHeading: () => "text-xs leading-4 font-semibold",
};
