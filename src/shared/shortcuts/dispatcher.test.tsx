import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ShortcutProvider,
  useShortcutLayer,
  type ShortcutLayer,
} from "./dispatcher";

function RegisteredLayer(props: ShortcutLayer) {
  useShortcutLayer(props);
  return null;
}

describe("ShortcutProvider", () => {
  it("dispatches by priority and stops after a layer claims the event", () => {
    const calls: string[] = [];
    render(
      <ShortcutProvider>
        <RegisteredLayer
          id="low"
          priority={10}
          onKeyDown={() => {
            calls.push("low");
            return { claimed: true };
          }}
        />
        <RegisteredLayer
          id="high"
          priority={20}
          onKeyDown={() => {
            calls.push("high");
            return { claimed: true };
          }}
        />
      </ShortcutProvider>
    );

    fireEvent.keyDown(window, { key: "x" });
    expect(calls).toEqual(["high"]);
  });

  it("continues past unclaimed layers and centralizes preventDefault", () => {
    const calls: string[] = [];
    render(
      <ShortcutProvider>
        <RegisteredLayer
          id="first"
          priority={20}
          onKeyDown={() => {
            calls.push("first");
            return { claimed: false };
          }}
        />
        <RegisteredLayer
          id="second"
          priority={10}
          onKeyDown={() => {
            calls.push("second");
            return { claimed: true, preventDefault: true };
          }}
        />
      </ShortcutProvider>
    );

    const event = new KeyboardEvent("keydown", {
      key: "x",
      bubbles: true,
      cancelable: true,
    });
    act(() => window.dispatchEvent(event));
    expect(calls).toEqual(["first", "second"]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("classifies managed canvas and external editable targets", () => {
    const kinds: string[] = [];
    render(
      <ShortcutProvider>
        <RegisteredLayer
          id="classifier"
          priority={10}
          onKeyDown={(_event, context) => {
            kinds.push(context.targetKind);
            return { claimed: true };
          }}
        />
      </ShortcutProvider>
    );
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    textarea.dataset.canvasManagedInput = "true";
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const dialogButton = document.createElement("button");
    dialog.append(dialogButton);
    document.body.append(input, textarea, dialog);

    fireEvent.keyDown(input, { key: "x" });
    fireEvent.keyDown(textarea, { key: "x" });
    fireEvent.keyDown(dialogButton, { key: "x" });
    expect(kinds).toEqual(["editable", "managed-canvas", "overlay"]);
  });

  it("ignores composing and already prevented events and unregisters layers", () => {
    const handler = vi.fn(() => ({ claimed: true }));
    const view = render(
      <ShortcutProvider>
        <RegisteredLayer id="guarded" priority={10} onKeyDown={handler} />
      </ShortcutProvider>
    );
    const composing = new KeyboardEvent("keydown", { key: "x" });
    Object.defineProperty(composing, "isComposing", { value: true });
    act(() => window.dispatchEvent(composing));

    const prevented = new KeyboardEvent("keydown", {
      key: "x",
      cancelable: true,
    });
    prevented.preventDefault();
    act(() => window.dispatchEvent(prevented));
    expect(handler).not.toHaveBeenCalled();

    view.unmount();
    fireEvent.keyDown(window, { key: "x" });
    expect(handler).not.toHaveBeenCalled();
  });
});
