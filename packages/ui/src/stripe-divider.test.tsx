import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StripeDivider } from "./stripe-divider"

describe("StripeDivider", () => {
  it("owns the contained pattern and structural boundaries", () => {
    const { container } = render(<StripeDivider />)
    const divider = container.querySelector('[data-slot="stripe-divider"]')
    const pattern = container.querySelector(
      '[data-slot="stripe-divider-pattern"]'
    )
    const tracks = container.querySelectorAll(
      '[data-slot="stripe-divider-boundary-track"]'
    )
    const boundaries = container.querySelectorAll(
      '[data-slot="separator"][data-boundary]'
    )

    expect(divider).toHaveClass("relative", "h-8", "shrink-0")
    expect(divider).not.toHaveAttribute("data-bleed")
    expect(divider).toHaveAttribute("aria-hidden", "true")
    expect(pattern).toHaveClass("absolute", "inset-x-0", "inset-y-0")
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toHaveAttribute("data-boundary-track", "start")
    expect(tracks[1]).toHaveAttribute("data-boundary-track", "end")
    expect(tracks[0]).toHaveClass("absolute", "inset-x-0", "top-0")
    expect(tracks[1]).toHaveClass("absolute", "inset-x-0", "bottom-0")
    expect(boundaries).toHaveLength(2)
    expect(boundaries[0]).toHaveAttribute("data-boundary", "start")
    expect(boundaries[1]).toHaveAttribute("data-boundary", "end")
    expect(boundaries[0]).toHaveClass(
      "data-[orientation=horizontal]:h-px",
      "rounded-none",
      "bg-separator"
    )
    expect(boundaries[1]).toHaveClass(
      "data-[orientation=horizontal]:h-px",
      "rounded-none",
      "bg-separator"
    )
  })

  it("bleeds the pattern and both boundaries as one visual contract", () => {
    const { container } = render(<StripeDivider bleed />)
    const divider = container.querySelector('[data-slot="stripe-divider"]')
    const layers = container.querySelectorAll(
      '[data-slot="stripe-divider-pattern"], [data-slot="stripe-divider-boundary-track"]'
    )
    const boundaries = container.querySelectorAll(
      '[data-slot="separator"][data-boundary]'
    )

    expect(divider).toHaveAttribute("data-bleed", "true")
    expect(layers).toHaveLength(3)
    for (const layer of layers) {
      expect(layer).toHaveClass("left-[-100vw]", "w-[200vw]")
    }
    for (const boundary of boundaries) {
      expect(boundary).toHaveClass("data-[orientation=horizontal]:w-full")
      expect(boundary).not.toHaveClass("w-[200vw]")
    }
  })

  it("forwards product placement props", () => {
    const { container } = render(
      <StripeDivider id="page-stripe" className="mx-auto max-w-6xl" />
    )

    expect(container.querySelector("#page-stripe")).toHaveClass(
      "mx-auto",
      "max-w-6xl"
    )
  })
})
