import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AsciiCanvas } from "@/domains/canvas/components/AsciiCanvas";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";

vi.mock("@/domains/canvas/components/AsciiCanvas/hooks/useCanvasRenderer", () => ({
  useCanvasRenderer: vi.fn(),
}));

vi.mock("@/domains/canvas/components/AsciiCanvas/hooks/useCanvasInteraction", () => ({
  useCanvasInteraction: vi.fn(() => ({
    bind: {},
    draggingSelection: null,
  })),
}));

vi.mock("@/domains/canvas/components/AsciiCanvas/Minimap", () => ({
  Minimap: () => null,
}));

describe("AsciiCanvas focus management", () => {
  const initialState = useCanvasStore.getState();

  afterEach(() => {
    useCanvasStore.setState(initialState, true);
  });

  it("focuses the managed textarea immediately when a selection exists", () => {
    useCanvasStore.setState({
      selections: [
        {
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        },
      ],
      textCursor: null,
      canvasMode: "freeform",
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const textarea = container.querySelector("textarea");

    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
  });
});
