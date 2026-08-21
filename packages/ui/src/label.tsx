import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "./utils.js"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-4 font-medium text-foreground/85 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-default peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
