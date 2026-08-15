import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { rx } from "@/shared/styles/recipes";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { IconButton } from "@/shared/ui/icon-button";
import { Label } from "@/shared/ui/label";
import { SelectableItem } from "@/shared/ui/selectable-item";
import { Surface } from "@/shared/ui/surface";
import { SwatchButton } from "@/shared/ui/swatch-button";

describe("compact UI density", () => {
  it("uses the compact global button size scale", () => {
    render(
      <>
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </>
    );

    expect(screen.getByRole("button", { name: "Extra small" })).toHaveClass(
      "h-6",
      "text-[11px]"
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

  it("expresses active control state through the button contract", () => {
    render(
      <>
        <Button active>Active tool</Button>
        <Button pressed>Pressed toggle</Button>
        <Button open>Open panel</Button>
      </>
    );

    expect(screen.getByRole("button", { name: "Active tool" })).toHaveClass(
      "bg-accent",
      "text-foreground"
    );
    expect(screen.getByRole("button", { name: "Pressed toggle" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Open panel" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("owns icon, selection, swatch, destructive, and joined behavior", () => {
    render(
      <>
        <IconButton aria-label="Compact icon" size="xs">
          <svg />
        </IconButton>
        <SelectableItem selected>Selected row</SelectableItem>
        <SwatchButton aria-label="Selected color" color="#ff0000" selected />
        <Button tone="subtle" destructive joined="middle">
          Destructive segment
        </Button>
      </>
    );

    expect(screen.getByRole("button", { name: "Compact icon" })).toHaveClass("size-6");
    expect(screen.getByRole("button", { name: "Selected row" })).toHaveClass(
      "bg-accent",
      "text-foreground"
    );
    expect(screen.getByRole("button", { name: "Selected color" })).toHaveClass(
      "ring-2",
      "ring-primary"
    );
    expect(screen.getByRole("button", { name: "Destructive segment" })).toHaveClass(
      "rounded-none",
      "text-destructive",
      "hover:bg-destructive-muted"
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

  it("expresses search fields through the input contract", () => {
    render(<Input aria-label="Search" appearance="search" />);

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveClass(
      "bg-search-surface",
      "border-0"
    );
  });

  it("provides stable panel typography recipes", () => {
    expect(rx.panelText()).toContain("text-xs");
    expect(rx.panelHeading()).toContain("font-semibold");
  });

  it("uses one compact interaction recipe for every menu family", () => {
    const item = rx.menuItem();
    const destructiveItem = rx.menuItem({ variant: "destructive" });

    expect(item).toContain("min-h-7");
    expect(item).toContain("rounded-md");
    expect(item).toContain("data-[highlighted]:bg-accent");
    expect(item).toContain("data-[state=checked]:bg-accent");
    expect(destructiveItem).toContain("bg-destructive-muted");
  });

  it("maps surface kinds to semantic surface recipes", () => {
    render(
      <>
        <Surface data-testid="embedded-surface" />
        <Surface data-testid="floating-surface" kind="floating" />
        <Surface data-testid="overlay-surface" kind="overlay" />
      </>
    );

    expect(screen.getByTestId("embedded-surface")).toHaveClass("bg-host-surface", "shadow-none");
    expect(screen.getByTestId("floating-surface")).toHaveClass("bg-host-surface", "shadow-host");
    expect(screen.getByTestId("overlay-surface")).toHaveClass("bg-overlay-surface", "shadow-overlay");
  });
});
