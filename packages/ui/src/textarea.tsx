import * as React from "react"

import { cn } from "./utils.js"
import { rx } from "./recipes.js"

type TextareaProps = React.ComponentProps<"textarea"> & {
  density?: "compact" | "default"
  appearance?: "default" | "quiet" | "editor"
}

function Textarea({
  className,
  density = "default",
  appearance = "default",
  ...props
}: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-density={density}
      data-appearance={appearance}
      className={cn(
        rx.field({
          density,
          appearance: appearance === "editor" ? "quiet" : appearance,
        }),
        "h-auto min-h-20 resize-y leading-5 placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground disabled:cursor-default",
        "aria-invalid:ring-invalid-ring",
        appearance === "editor" &&
          "rounded-none border-0 bg-transparent font-mono text-sm leading-6 shadow-none focus-visible:ring-0",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
export type { TextareaProps }
