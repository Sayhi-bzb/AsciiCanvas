import * as React from "react"

import { cn } from "@/shared/lib/utils"
import { rx } from "@/shared/styles/recipes"

type InputProps = React.ComponentProps<"input"> & {
  density?: "compact" | "default"
  appearance?: "default" | "quiet" | "search"
}

function Input({
  className,
  type,
  density = "default",
  appearance = "default",
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      data-density={density}
      data-appearance={appearance}
      className={cn(
        rx.field({ density, appearance }),
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium disabled:cursor-default",
        "aria-invalid:ring-invalid-ring",
        className
      )}
      {...props}
    />
  )
}

export { Input }
