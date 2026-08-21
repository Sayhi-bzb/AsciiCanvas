import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Separator } from "./separator"

describe("Separator", () => {
  it("uses a two-pixel rounded horizontal separator by default", () => {
    const { container } = render(<Separator />)

    expect(container.querySelector('[data-slot="separator"]')).toHaveClass(
      "bg-separator",
      "rounded-full",
      "data-[orientation=horizontal]:h-0.5",
      "data-[orientation=horizontal]:w-full"
    )
  })

  it("uses the same geometry for vertical separators", () => {
    const { container } = render(<Separator orientation="vertical" />)

    expect(container.querySelector('[data-slot="separator"]')).toHaveClass(
      "rounded-full",
      "data-[orientation=vertical]:h-full",
      "data-[orientation=vertical]:w-0.5"
    )
  })
})
