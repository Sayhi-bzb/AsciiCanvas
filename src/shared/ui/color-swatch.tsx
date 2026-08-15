import * as React from "react"

import { cn } from "@/shared/lib/utils"

type ColorSwatchProps = Omit<React.ComponentProps<"span">, "color"> & {
  color: string
  shape?: "rounded" | "circle"
}

function ColorSwatch({
  color,
  shape = "rounded",
  className,
  style,
  ...props
}: ColorSwatchProps) {
  return (
    <span
      data-slot="color-swatch"
      className={cn(
        "border border-swatch-border shadow-sm",
        shape === "circle" ? "rounded-full" : "rounded-[3px]",
        className
      )}
      style={{ ...style, backgroundColor: color }}
      {...props}
    />
  )
}

export { ColorSwatch }
