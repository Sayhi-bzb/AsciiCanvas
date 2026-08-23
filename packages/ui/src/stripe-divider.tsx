import * as React from "react"

import { cn } from "./utils.js"
import { Separator } from "./separator.js"

type StripeDividerProps = React.ComponentProps<"div"> & {
  bleed?: boolean
}

function StripeDivider({
  bleed = false,
  className,
  ...props
}: StripeDividerProps) {
  const extent = bleed ? "left-[-100vw] w-[200vw]" : "inset-x-0"

  return (
    <div
      data-slot="stripe-divider"
      data-bleed={bleed || undefined}
      aria-hidden="true"
      className={cn("relative h-8 shrink-0", className)}
      {...props}
    >
      <div
        data-slot="stripe-divider-pattern"
        className={cn("pointer-events-none absolute inset-y-0", extent)}
      />
      <div
        data-slot="stripe-divider-boundary-track"
        data-boundary-track="start"
        className={cn("pointer-events-none absolute top-0", extent)}
      >
        <Separator variant="structural" data-boundary="start" />
      </div>
      <div
        data-slot="stripe-divider-boundary-track"
        data-boundary-track="end"
        className={cn("pointer-events-none absolute bottom-0", extent)}
      >
        <Separator variant="structural" data-boundary="end" />
      </div>
    </div>
  )
}

export { StripeDivider }
export type { StripeDividerProps }
