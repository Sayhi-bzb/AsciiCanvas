import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { rx } from "@/shared/styles/recipes";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

describe("compact UI density", () => {
  it("uses the compact global button size scale", () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </>
    );

    expect(screen.getByRole("button", { name: "Small" })).toHaveClass(
      "h-7",
      "text-xs"
    );
    expect(screen.getByRole("button", { name: "Medium" })).toHaveClass(
      "h-8",
      "text-xs"
    );
    expect(screen.getByRole("button", { name: "Large" })).toHaveClass(
      "h-9",
      "text-xs"
    );
  });

  it("uses 12px fields and 11px labels", () => {
    render(
      <>
        <Label htmlFor="density-input">Field label</Label>
        <Input id="density-input" />
      </>
    );

    expect(screen.getByText("Field label")).toHaveClass(
      "text-[11px]",
      "leading-4"
    );
    expect(screen.getByLabelText("Field label")).toHaveClass("h-8", "text-xs");
  });

  it("provides stable panel typography recipes", () => {
    expect(rx.panelText()).toContain("text-xs");
    expect(rx.panelLabel()).toContain("text-[11px]");
    expect(rx.panelHeading()).toContain("font-semibold");
  });
});
