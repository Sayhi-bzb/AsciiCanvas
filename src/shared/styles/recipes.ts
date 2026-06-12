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
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-sm",
};

const controlShape: Record<Shape, string> = {
  auto: "rounded-md",
  square: "rounded-lg",
  pill: "rounded-full",
};

export const rx = {
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
      shape === "square" && size === "sm" && "size-8 px-0",
      shape === "square" && size === "md" && "size-9 px-0",
      shape === "square" && size === "lg" && "size-10 px-0",
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
      density === "default" && "h-9 px-3 py-2 text-sm",
      density === "compact" && "h-8 px-2 text-xs",
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
      size === "sm" && "h-7 text-xs",
      size === "md" && "h-8 text-sm",
      size === "lg" && "h-12 text-sm",
      outlined &&
        "shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]"
    ),
};
