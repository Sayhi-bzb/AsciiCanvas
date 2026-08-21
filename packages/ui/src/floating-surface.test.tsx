import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  FloatingSurface,
  SurfaceContent,
} from "./floating-surface.js"

describe("FloatingSurface", () => {
  it("provides the shared control-bar geometry", () => {
    render(<FloatingSurface data-testid="control-bar" variant="control-bar" />)

    expect(screen.getByTestId("control-bar")).toHaveClass(
      "bg-host-surface",
      "rounded-surface",
      "shadow-host",
      "ring-1",
      "ring-surface-ring",
      "flex",
      "gap-1",
      "p-1"
    )
  })

  it("provides a clipped panel shell through asChild", () => {
    render(
      <FloatingSurface variant="panel" asChild>
        <section data-testid="panel" className="w-40" />
      </FloatingSurface>
    )

    expect(screen.getByTestId("panel")).toHaveClass(
      "bg-host-surface",
      "overflow-hidden",
      "pointer-events-auto",
      "w-40"
    )
    expect(screen.getByTestId("panel")).toHaveAttribute(
      "data-floating-variant",
      "panel"
    )
  })
})

describe("SurfaceContent", () => {
  it("maps content density to shared panel padding", () => {
    render(
      <>
        <SurfaceContent data-testid="compact" />
        <SurfaceContent data-testid="default" density="default" />
      </>
    )

    expect(screen.getByTestId("compact")).toHaveClass("p-2.5")
    expect(screen.getByTestId("default")).toHaveClass("p-4")
  })
})
