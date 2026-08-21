import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "./utils.js"
import { rx } from "./recipes.js"

type SelectableItemProps = React.ComponentProps<"button"> & {
  asChild?: boolean
  orientation?: "horizontal" | "vertical"
  selected?: boolean
  muted?: boolean
}

function SelectableItem({
  asChild = false,
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
        rx.selectableItem({ orientation, selected, muted }),
        className
      )}
      {...props}
    />
  )
}

export { SelectableItem }
