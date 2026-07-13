import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HandbookDialog } from "@/widgets/dialogs/handbook-dialog";

describe("HandbookDialog", () => {
  it("documents the current freeform and structured workflows", () => {
    render(<HandbookDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Open user manual" }));

    expect(screen.getByRole("heading", { name: "User Manual" })).toBeInTheDocument();
    expect(screen.getByText("Freeform")).toBeInTheDocument();
    expect(screen.getByText(/Drag to select a rectangle/)).toBeInTheDocument();
    expect(screen.getByText("Structured Canvas")).toBeInTheDocument();
    expect(screen.getByText(/Template or Components tab/)).toBeInTheDocument();
    expect(screen.getByText(/text\/bg\/box/)).toBeInTheDocument();
    expect(screen.getByText("Structured Editing")).toBeInTheDocument();
    expect(screen.getByText(/Double-click text to edit in place/)).toBeInTheDocument();
    expect(screen.getByText(/Select text inside edit mode/)).toBeInTheDocument();
    expect(screen.getByText(/Toolbar fill controls bg layers/)).toBeInTheDocument();
    expect(screen.getByText(/Structured copy keeps node data/)).toBeInTheDocument();
    expect(screen.getByText(/Animation mode keeps frame controls/)).toBeInTheDocument();
  });
});
