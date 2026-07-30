import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataSecurityDialog } from "./data-security-dialog";

describe("DataSecurityDialog", () => {
  it("states the local-first data boundary without overstating offline support", () => {
    render(<DataSecurityDialog open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Data security" });
    expect(dialog).toHaveTextContent("Stored locally");
    expect(dialog).toHaveTextContent("No uploads or analytics");
    expect(dialog).toHaveTextContent("You control transfers");
    expect(dialog).toHaveTextContent("Local storage is not encrypted");
    expect(dialog).not.toHaveTextContent("offline");
    expect(dialog).not.toHaveTextContent("URL");
  });
});
