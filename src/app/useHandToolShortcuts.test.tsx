import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CanvasMode } from "@/domains/sessions/public";
import { useHandToolShortcuts } from "./useHandToolShortcuts";
import { ShortcutProvider } from "@/shared/shortcuts/dispatcher";

const renderHandShortcuts = ({
  canvasMode = "freeform",
  isCanvasTextEditing = false,
}: {
  canvasMode?: CanvasMode;
  isCanvasTextEditing?: boolean;
} = {}) =>
  renderHook(
    (props) => useHandToolShortcuts(props),
    {
      initialProps: {
        canvasMode,
        isCanvasTextEditing,
      },
      wrapper: ShortcutProvider,
    }
  );

afterEach(() => {
  document.body.replaceChildren();
});

describe("useHandToolShortcuts", () => {
  it("temporarily pans with Space", () => {
    const { result } = renderHandShortcuts();

    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(result.current).toBe(true);

    fireEvent.keyDown(window, { key: " ", code: "Space", repeat: true });
    expect(result.current).toBe(true);

    fireEvent.keyUp(window, { key: " ", code: "Space" });
    expect(result.current).toBe(false);
  });

  it("does not claim printable H shortcuts", () => {
    renderHandShortcuts();
    const event = new KeyboardEvent("keydown", {
      key: "H",
      code: "KeyH",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    act(() => window.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores shortcuts in animation mode", () => {
    const { result } = renderHandShortcuts({
      canvasMode: "animation",
    });

    fireEvent.keyDown(window, { key: " ", code: "Space" });

    expect(result.current).toBe(false);
  });

  it("ignores external editables", () => {
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "");
    document.body.append(input, editable);
    const { result } = renderHandShortcuts();

    fireEvent.keyDown(input, { key: " ", code: "Space" });
    fireEvent.keyDown(editable, { key: " ", code: "Space" });

    expect(result.current).toBe(false);
  });

  it("allows the managed textarea unless canvas text editing is active", () => {
    const textarea = document.createElement("textarea");
    textarea.dataset.canvasManagedInput = "true";
    document.body.append(textarea);
    const { result, rerender } = renderHandShortcuts();

    fireEvent.keyDown(textarea, { key: " ", code: "Space" });
    expect(result.current).toBe(true);
    fireEvent.keyUp(textarea, { key: " ", code: "Space" });

    rerender({
      canvasMode: "freeform",
      isCanvasTextEditing: true,
    });
    fireEvent.keyDown(textarea, { key: " ", code: "Space" });

    expect(result.current).toBe(false);
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
    });
    expect(result.current).toBe(false);
  });
});
