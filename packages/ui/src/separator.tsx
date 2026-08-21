import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "./utils.js"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 rounded-full bg-separator data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-0.5",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
