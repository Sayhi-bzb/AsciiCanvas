import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "./utils.js"
import { rx } from "./recipes.js"
import type { SurfaceKind } from "./tokens.js"

export type SurfaceProps = React.ComponentProps<"div"> & {
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
