import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./checkbox.js";

describe("Checkbox", () => {
  it("exposes checked state and shared interaction styling", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Render feature"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    );

    const checkbox = screen.getByRole("checkbox", { name: "Render feature" });
    expect(checkbox).toHaveAttribute("data-slot", "checkbox");
    expect(checkbox).toHaveClass("focus-visible:ring-2", "data-[state=checked]:bg-primary");
    fireEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("preserves disabled semantics", () => {
    render(<Checkbox aria-label="Unavailable" disabled />);
    expect(screen.getByRole("checkbox", { name: "Unavailable" })).toBeDisabled();
  });
});
