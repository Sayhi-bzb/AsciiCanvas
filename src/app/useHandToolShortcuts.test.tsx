import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolType } from "@/domains/canvas/public";
import type { CanvasMode } from "@/domains/sessions/public";
import { useHandToolShortcuts } from "./useHandToolShortcuts";

const renderHandShortcuts = ({
  canvasMode = "freeform",
  isCanvasTextEditing = false,
  setTool = vi.fn(),
}: {
  canvasMode?: CanvasMode;
  isCanvasTextEditing?: boolean;
  setTool?: (tool: ToolType) => void;
} = {}) =>
  renderHook(
    (props) => useHandToolShortcuts(props),
    {
      initialProps: {
        canvasMode,
        isCanvasTextEditing,
        setTool,
      },
    }
  );

afterEach(() => {
  document.body.replaceChildren();
});

describe("useHandToolShortcuts", () => {
  it("temporarily pans with Space without changing the persistent tool", () => {
    const setTool = vi.fn();
    const { result } = renderHandShortcuts({ setTool });

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(result.current).toBe(true);
    expect(setTool).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: " ", code: "Space", repeat: true });
    expect(result.current).toBe(true);

    fireEvent.keyUp(window, { key: " ", code: "Space" });
    expect(result.current).toBe(false);
    expect(setTool).not.toHaveBeenCalled();
  });

  it("selects Hand with Shift+H and preserves plain H", () => {
    const setTool = vi.fn();
    renderHandShortcuts({ setTool });

    fireEvent.keyDown(window, { key: "h" });
    expect(setTool).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "H", shiftKey: true });
    expect(setTool).toHaveBeenCalledOnce();
    expect(setTool).toHaveBeenCalledWith("pan");
  });

  it("ignores shortcuts in animation mode", () => {
    const setTool = vi.fn();
    const { result } = renderHandShortcuts({
      canvasMode: "animation",
      setTool,
    });

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    fireEvent.keyDown(window, { key: "H", shiftKey: true });

    expect(result.current).toBe(false);
    expect(setTool).not.toHaveBeenCalled();
  });

  it("ignores external editables", () => {
    const setTool = vi.fn();
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "");
    document.body.append(input, editable);
    const { result } = renderHandShortcuts({ setTool });

    fireEvent.keyDown(input, { key: " ", code: "Space" });
    fireEvent.keyDown(input, { key: "H", shiftKey: true });
    fireEvent.keyDown(editable, { key: " ", code: "Space" });
    fireEvent.keyDown(editable, { key: "H", shiftKey: true });

    expect(result.current).toBe(false);
    expect(setTool).not.toHaveBeenCalled();
  });

  it("allows the managed textarea unless canvas text editing is active", () => {
    const textarea = document.createElement("textarea");
    textarea.dataset.canvasManagedInput = "true";
    document.body.append(textarea);
    const setTool = vi.fn();
    const { result, rerender } = renderHandShortcuts({ setTool });

    fireEvent.keyDown(textarea, { key: " ", code: "Space" });
    expect(result.current).toBe(true);
    fireEvent.keyUp(textarea, { key: " ", code: "Space" });

    rerender({
      canvasMode: "freeform",
      isCanvasTextEditing: true,
      setTool,
    });
    fireEvent.keyDown(textarea, { key: " ", code: "Space" });
    fireEvent.keyDown(textarea, { key: "H", shiftKey: true });

    expect(result.current).toBe(false);
    expect(setTool).not.toHaveBeenCalled();
  });

  it("clears temporary pan on blur and when entering animation", () => {
    const { result, rerender } = renderHandShortcuts();

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(result.current).toBe(true);
    act(() => window.dispatchEvent(new Event("blur")));
    expect(result.current).toBe(false);

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    rerender({
      canvasMode: "animation",
      isCanvasTextEditing: false,
      setTool: vi.fn(),
    });
    expect(result.current).toBe(false);
  });
});
