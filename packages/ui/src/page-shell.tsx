import * as React from "react"

import { Separator } from "./separator.js"
import { cn } from "./utils.js"

type PageFrameElement = "div" | "header" | "main" | "section" | "footer"
type PageFrameBoundary = "none" | "start" | "end" | "both"

type PageShellProps = React.ComponentProps<"div">

type PageFrameProps = React.ComponentProps<"div"> & {
  as?: PageFrameElement
  boundaries?: PageFrameBoundary
  bleed?: boolean
}

function PageShell({ className, ...props }: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn(
        "relative isolate flex min-h-dvh flex-col overflow-x-clip bg-background px-2 text-foreground",
        className
      )}
      {...props}
    />
  )
}

function PageFrame({
  as: Component = "div",
  bleed = false,
  boundaries = "both",
  className,
  children,
  ...props
}: PageFrameProps) {
  const extent = bleed ? "left-[-100vw] w-[200vw]" : "inset-x-0"
  const hasStart = boundaries === "start" || boundaries === "both"
  const hasEnd = boundaries === "end" || boundaries === "both"

  return (
    <Component
      data-slot="page-frame"
      data-boundaries={boundaries}
      data-bleed={bleed || undefined}
      className={cn("relative border-x border-separator", className)}
      {...props}
    >
      {hasStart ? (
        <div
          aria-hidden="true"
          data-slot="page-frame-boundary-track"
          data-boundary-track="start"
          className={cn("pointer-events-none absolute top-0", extent)}
        >
          <Separator variant="structural" data-boundary="start" />
        </div>
      ) : null}
      {children}
      {hasEnd ? (
        <div
          aria-hidden="true"
          data-slot="page-frame-boundary-track"
          data-boundary-track="end"
          className={cn("pointer-events-none absolute bottom-0", extent)}
        >
          <Separator variant="structural" data-boundary="end" />
        </div>
      ) : null}
    </Component>
  )
}

export { PageFrame, PageShell }
export type {
  PageFrameBoundary,
  PageFrameElement,
  PageFrameProps,
  PageShellProps,
}
