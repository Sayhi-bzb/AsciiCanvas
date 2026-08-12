import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/domains/canvas/testing";
import { ShortcutProvider } from "@/shared/shortcuts/dispatcher";
import { useManagedCanvasInput } from "./useManagedCanvasInput";

describe("useManagedCanvasInput", () => {
  it("does not fill a selection from a capture-prevented shortcut", () => {
    const fillSelectionsWithChar = vi.fn();
    const model = {
      ...useEditorStore.getState(),
      textCursor: null,
      selections: [
        { start: { x: 1, y: 1 }, end: { x: 2, y: 2 } },
      ],
      selectedStructuredNodeIds: [],
      fillSelectionsWithChar,
    };
    const { result } = renderHook(
      () =>
        useManagedCanvasInput({
          canvasMode: "structured",
          model,
          size: { width: 800, height: 600 },
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        }),
      { wrapper: ShortcutProvider }
    );
    const stopPropagation = vi.fn();

    act(() => {
      result.current.textareaProps.onKeyDown?.({
        defaultPrevented: true,
        stopPropagation,
      } as never);
    });

    expect(stopPropagation).not.toHaveBeenCalled();
    expect(fillSelectionsWithChar).not.toHaveBeenCalled();
  });
});
