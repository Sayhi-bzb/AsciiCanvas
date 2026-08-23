import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PageFrame, PageShell } from "./page-shell"

describe("PageShell", () => {
  it("owns the clipped viewport surface", () => {
    const { container } = render(<PageShell id="shell" className="custom" />)
    const shell = container.querySelector("#shell")

    expect(shell).toHaveAttribute("data-slot", "page-shell")
    expect(shell).toHaveClass(
      "isolate",
      "min-h-dvh",
      "overflow-x-clip",
      "bg-background",
      "px-2",
      "custom"
    )
  })
})

describe("PageFrame", () => {
  it("renders semantic frames with contained boundaries by default", () => {
    const { container } = render(
      <PageFrame as="header" id="header">
        Header
      </PageFrame>
    )
    const frame = container.querySelector("#header")
    const tracks = container.querySelectorAll(
      '[data-slot="page-frame-boundary-track"]'
    )

    expect(frame?.tagName).toBe("HEADER")
    expect(frame).toHaveClass("relative", "border-x", "border-separator")
    expect(frame).toHaveAttribute("data-boundaries", "both")
    expect(frame).not.toHaveAttribute("data-bleed")
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toHaveClass("inset-x-0", "top-0")
    expect(tracks[1]).toHaveClass("inset-x-0", "bottom-0")
  })

  it.each([
    ["none", []],
    ["start", ["start"]],
    ["end", ["end"]],
    ["both", ["start", "end"]],
  ] as const)("renders the %s boundary contract", (boundaries, expected) => {
    const { container } = render(<PageFrame boundaries={boundaries} />)
    const rendered = Array.from(
      container.querySelectorAll('[data-slot="separator"][data-boundary]')
    ).map((element) => element.getAttribute("data-boundary"))

    expect(rendered).toEqual(expected)
  })

  it("bleeds boundary tracks without changing separator ownership", () => {
    const { container } = render(<PageFrame bleed />)
    const frame = container.querySelector('[data-slot="page-frame"]')
    const tracks = container.querySelectorAll(
      '[data-slot="page-frame-boundary-track"]'
    )

    expect(frame).toHaveAttribute("data-bleed", "true")
    for (const track of tracks) {
      expect(track).toHaveClass("left-[-100vw]", "w-[200vw]")
    }
  })
})
