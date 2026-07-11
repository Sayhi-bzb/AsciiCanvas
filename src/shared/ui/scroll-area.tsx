import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/shared/lib/utils"

type ScrollbarMode = "vertical" | "horizontal" | "both"

function ScrollArea({
  className,
  children,
  scrollbars = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  scrollbars?: ScrollbarMode
}) {
  const showVertical =
    scrollbars === "vertical" || scrollbars === "both"
  const showHorizontal =
    scrollbars === "horizontal" || scrollbars === "both"

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      data-scrollbars={scrollbars}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {showVertical && <ScrollBar orientation="vertical" />}
      {showHorizontal && <ScrollBar orientation="horizontal" />}
      {scrollbars === "both" && (
        <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
      )}
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea }
