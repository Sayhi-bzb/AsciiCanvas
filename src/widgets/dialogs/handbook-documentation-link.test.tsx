import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setUiLanguage } from "@/shared/i18n";
import { HandbookDialog } from "./handbook-dialog";

describe("Handbook documentation link", () => {
  beforeEach(() => setUiLanguage("en"));
  afterEach(() => setUiLanguage("en"));

  it("opens the full documentation without replacing the editor", () => {
    render(<HandbookDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Open help" }));

    expect(
      screen.getByRole("link", { name: "Open full documentation" })
    ).toMatchObject({
      target: "_blank",
      rel: "noreferrer",
    });
    expect(
      screen.getByRole("link", { name: "Open full documentation" })
    ).toHaveAttribute("href", "/docs");
  });
});
