import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InlineRenameInput } from "./inline-rename-input";

describe("InlineRenameInput", () => {
  afterEach(cleanup);

  it("selects the name and commits a trimmed draft only on blur", () => {
    const onCommit = vi.fn();
    render(
      <InlineRenameInput
        value="Alpha"
        aria-label="Name"
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    act(() => input.focus());
    expect(input).toHaveFocus();
    expect(input).toHaveProperty("selectionStart", 0);
    expect(input).toHaveProperty("selectionEnd", 5);

    fireEvent.change(input, { target: { value: "  Beta  " } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith("Beta");
    expect(input).toHaveValue("Beta");
  });

  it("commits with Enter and cancels with Escape", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineRenameInput
        value="Alpha"
        aria-label="Name"
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "Beta" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue("Alpha");

    act(() => input.focus());
    fireEvent.change(input, { target: { value: "Gamma" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith("Gamma");
  });

  it("restores the original name instead of committing an empty value", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineRenameInput
        value="Alpha"
        aria-label="Name"
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue("Alpha");
  });

  it("does not commit Enter while an IME composition is active", () => {
    const onCommit = vi.fn();
    render(
      <InlineRenameInput
        value="Alpha"
        aria-label="Name"
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "名字" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });

    expect(input).toHaveFocus();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
