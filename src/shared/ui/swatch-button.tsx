import * as React from "react"

import { cn } from "@/shared/lib/utils"
import { rx } from "@/shared/styles/recipes"
import { ColorSwatch } from "@/shared/ui/color-swatch"

type SwatchButtonProps = Omit<React.ComponentProps<"button">, "color"> & {
  color: string
  selected?: boolean
  swatchClassName?: string
  swatchShape?: "rounded" | "circle"
}

function SwatchButton({
  color,
  selected = false,
  swatchClassName,
  swatchShape = "circle",
  className,
  children,
  ...props
}: SwatchButtonProps) {
  return (
    <button
      type="button"
      data-slot="swatch-button"
      data-selected={selected || undefined}
      aria-pressed={props["aria-pressed"] ?? selected}
      className={cn(rx.swatchButton({ selected }), className)}
      {...props}
    >
      <ColorSwatch
        aria-hidden="true"
        color={color}
        shape={swatchShape}
        className={cn("flex size-[18px] items-center justify-center", swatchClassName)}
      >
        {children}
      </ColorSwatch>
    </button>
  )
}

export { SwatchButton }
