import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable"

describe("Resizable styling", () => {
  it("uses the low-contrast separator contract without shrinking the hit target", () => {
    render(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>Start</ResizablePanel>
        <ResizableHandle aria-label="Resize" />
        <ResizablePanel>End</ResizablePanel>
      </ResizablePanelGroup>
    )

    const handle = screen.getByRole("separator", { name: "Resize" })
    expect(handle).toHaveClass(
      "w-0.5",
      "bg-separator",
      "after:w-1",
      "hover:bg-muted-foreground/25",
      "active:bg-muted-foreground/40",
      "focus-visible:ring-2",
      "focus-visible:ring-ring/45",
      "focus-visible:ring-inset"
    )
    expect(handle).not.toHaveClass(
      "w-px",
      "rounded-full",
      "bg-border",
      "focus-visible:ring-1"
    )
  })

  it("uses a straight two-pixel boundary for vertically stacked panels", () => {
    render(
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel>Start</ResizablePanel>
        <ResizableHandle aria-label="Resize rows" />
        <ResizablePanel>End</ResizablePanel>
      </ResizablePanelGroup>
    )

    const handle = screen.getByRole("separator", { name: "Resize rows" })
    expect(handle).toHaveClass(
      "aria-[orientation=horizontal]:h-0.5",
      "aria-[orientation=horizontal]:w-full"
    )
    expect(handle).not.toHaveClass("rounded-full")
  })

  it("keeps the optional grip on semantic surface and separator tokens", () => {
    const { container } = render(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>Start</ResizablePanel>
        <ResizableHandle aria-label="Resize" withHandle />
        <ResizablePanel>End</ResizablePanel>
      </ResizablePanelGroup>
    )

    expect(
      container.querySelector('[data-slot="resizable-handle-grip"]')
    ).toHaveClass("border-separator", "bg-background", "text-muted-foreground")
  })
})
