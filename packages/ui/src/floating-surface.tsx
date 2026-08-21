import * as React from "react"

import { cn } from "./utils.js"
import { Surface } from "./surface.js"

type FloatingSurfaceVariant = "control-bar" | "panel"
type SurfaceContentDensity = "compact" | "default"

type FloatingSurfaceProps = Omit<React.ComponentProps<typeof Surface>, "kind"> & {
  variant?: FloatingSurfaceVariant
}

function FloatingSurface({
  variant = "panel",
  className,
  ...props
}: FloatingSurfaceProps) {
  return (
    <Surface
      kind="floating"
      data-floating-variant={variant}
      className={cn(
        "pointer-events-auto",
        variant === "control-bar" &&
          "relative flex items-center gap-1 p-[3px]",
        variant === "panel" && "overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

type SurfaceContentProps = React.ComponentProps<"div"> & {
  density?: SurfaceContentDensity
}

function SurfaceContent({
  density = "compact",
  className,
  ...props
}: SurfaceContentProps) {
  return (
    <div
      data-slot="surface-content"
      data-density={density}
      className={cn(density === "compact" ? "p-2" : "p-4", className)}
      {...props}
    />
  )
}

export { FloatingSurface, SurfaceContent }
