import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/shared/lib/utils"
import { rx } from "@/shared/styles/recipes"
import type { SurfaceKind } from "@/shared/styles/tokens"

type SurfaceProps = React.ComponentProps<"div"> & {
  asChild?: boolean
  kind?: SurfaceKind
  animated?: boolean
}

function Surface({
  asChild = false,
  kind = "embedded",
  animated = false,
  className,
  ...props
}: SurfaceProps) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="surface"
      data-surface-kind={kind}
      className={cn(rx.surface({ kind, animated }), className)}
      {...props}
    />
  )
}

export { Surface }
