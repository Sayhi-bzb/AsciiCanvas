import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "./utils.js"

type SeparatorVariant = "default" | "structural"

type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  variant?: SeparatorVariant
}

const separatorGeometry: Record<SeparatorVariant, string> = {
  default:
    "rounded-full data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-0.5",
  structural:
    "rounded-none data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  variant = "default",
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-separator",
        separatorGeometry[variant],
        className
      )}
      {...props}
    />
  )
}

export { Separator }
export type { SeparatorProps, SeparatorVariant }
