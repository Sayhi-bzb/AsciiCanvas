import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Separator } from "./separator"

describe("Separator", () => {
  it("uses the low-contrast separator color", () => {
    const { container } = render(<Separator />)

    expect(container.querySelector('[data-slot="separator"]')).toHaveClass(
      "bg-separator"
    )
  })
})
