import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/shared/lib/utils"
import { rx } from "@/shared/styles/recipes"
import type { Density } from "@/shared/styles/tokens"

type SelectableItemProps = React.ComponentProps<"button"> & {
  asChild?: boolean
  density?: Density
  orientation?: "horizontal" | "vertical"
  selected?: boolean
  muted?: boolean
}

function SelectableItem({
  asChild = false,
  density = "compact",
  orientation = "horizontal",
  selected = false,
  muted = false,
  className,
  ...props
}: SelectableItemProps) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="selectable-item"
      data-selected={selected || undefined}
      className={cn(
        rx.selectableItem({ density, orientation, selected, muted }),
        className
      )}
      {...props}
    />
  )
}

export { SelectableItem }
