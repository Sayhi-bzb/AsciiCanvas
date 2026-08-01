import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/domains/canvas/public";
import { AnimationEffectsPanel } from "./AnimationEffectsPanel";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

describe("AnimationEffectsPanel color picker", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    act(() => useEditorStore.setState(initialState, true));
  });

  it("focuses the neutral panel without opening the ANSI tooltip", async () => {
    render(<AnimationEffectsPanel />);

    const trigger = screen.getByRole("button", { name: "Pick color" });
    fireEvent.click(trigger);

    const colorDialog = await screen.findByRole("dialog", { name: "Color" });
    await waitFor(() => expect(colorDialog).toHaveFocus());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(colorDialog.querySelector("input")).not.toBeInTheDocument();

    fireEvent.keyDown(colorDialog, { key: "Escape" });

    await waitFor(() => expect(colorDialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
